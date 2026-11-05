#!/usr/bin/env bash
# Vista Chase go-live: moves the site on this server to https://www.vistachase.com in one run.
#
#   cd /home/ubuntu/Vistachase && git pull && bash scripts/go-live.sh           # the real run
#   bash scripts/go-live.sh --check                                            # only checks, changes nothing
#
# Run it as the user that owns PM2 (ubuntu), NOT with sudo: it calls sudo itself for nginx and certbot.
#
# What it does, in order (it stops at the first problem, before anything later is touched):
#   1. Checks that vistachase.com and www.vistachase.com point at this server (GoDaddy DNS).
#   2. Asks (hidden typing) for the live Stripe secret + publishable keys and the live Bókun keys,
#      and checks each key with Stripe / Bókun before using it. Press Enter to keep a saved value.
#   3. Adds the domain to nginx and gets a free Let's Encrypt certificate (certbot), with HTTP -> HTTPS.
#   4. Creates (or reuses) the live Stripe webhook https://www.vistachase.com/api/webhooks/stripe
#      with the 7 events the API handles, and saves its signing secret.
#   5. Writes backend/.env and frontend/.env.production.local (timestamped backups first, mode 600).
#   6. Rebuilds the frontend next to the live one, restarts both PM2 apps, runs health checks.
#      If the checks fail, the old .env files and the old build are put back and restarted.
#
# Safe to run again: every step checks what is already done. It never touches the database
# (no migrations, no deletes) and never prints a key. Nothing here is committed to git.

set -Eeuo pipefail

DOMAIN="vistachase.com"
WWW="www.vistachase.com"
SITE="https://${WWW}"
WEBHOOK_URL="${SITE}/api/webhooks/stripe"
WEBHOOK_EVENTS=(payment_intent.succeeded payment_intent.payment_failed payment_intent.canceled charge.refunded refund.created refund.updated charge.refund.updated)
BOKUN_LIVE_API="https://api.bokun.io"
CERT_EMAIL_DEFAULT="support@vistachase.com"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
BACKEND_ENV="$BACKEND/.env"
FRONTEND_ENV="$FRONTEND/.env.production.local"
STAMP="$(date +%Y%m%d-%H%M%S)"

CHECK_ONLY=false
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=true

# ---------- output helpers ----------
if [[ -t 1 ]]; then B=$'\e[1m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; N=$'\e[0m'; else B=; G=; Y=; R=; N=; fi
step() { echo; echo "${B}== $* ==${N}"; }
ok()   { echo "  ${G}OK${N}  $*"; }
warn() { echo "  ${Y}!!${N}  $*"; }
die()  { echo; echo "${R}${B}STOPPED:${N} $*"; echo "Nothing after this point was changed. Fix it and run the script again."; exit 1; }
trap 'echo "${R}Unexpected error on line $LINENO.${N} Nothing after this point was changed."' ERR

# ---------- .env helpers (values never go on a command line) ----------
env_get() { # file key -> value of the last KEY= line, quotes stripped
  [[ -f "$1" ]] || return 0
  KEY="$2" awk -F= 'BEGIN{k=ENVIRON["KEY"]} $1==k {sub(/^[^=]*=/,""); v=$0} END{gsub(/^["'\'']|["'\'']$/,"",v); printf "%s", v}' "$1"
}
env_set() { # file key value: replaces the first KEY= line (drops later duplicates) or appends
  local file="$1" tmp
  tmp="$(mktemp "${file}.XXXX")"
  touch "$file"
  KEY="$2" VAL="$3" awk 'BEGIN{k=ENVIRON["KEY"]; v=ENVIRON["VAL"]; done=0}
    { split($0,a,"="); if (a[1]==k) { if (!done) { print k "=" v; done=1 } next } print }
    END{ if (!done) print k "=" v }' "$file" > "$tmp"
  chmod 600 "$tmp"; mv "$tmp" "$file"
}
env_comment_out() { # file key: turns KEY=... into "# KEY=... (disabled by go-live <date>)"
  local file="$1" tmp
  [[ -f "$file" ]] || return 0
  tmp="$(mktemp "${file}.XXXX")"
  KEY="$2" S="$STAMP" awk 'BEGIN{k=ENVIRON["KEY"]} { split($0,a,"="); if (a[1]==k) print "# " $0 "  # disabled by go-live " ENVIRON["S"]; else print }' "$file" > "$tmp"
  chmod 600 "$tmp"; mv "$tmp" "$file"
}

ask_secret() { # prompt current-value -> echoes the new value (or the current one on Enter)
  local prompt="$1" current="$2" value
  if [[ -n "$current" ]]; then prompt="$prompt [Enter = keep saved ${current:0:8}…]"; fi
  read -rsp "  $prompt: " value </dev/tty; echo >&2
  value="$(printf '%s' "$value" | tr -d '[:space:]')"
  printf '%s' "${value:-$current}"
}

# Stripe API with the key fed through stdin, so it never appears in `ps`.
stripe_api() { # key method path [curl data args...]
  local key="$1" method="$2" path="$3"; shift 3
  printf 'user = "%s:"\n' "$key" | curl -sS -m 30 -K - -X "$method" "https://api.stripe.com/v1/$path" "$@"
}
json() { # js-expression-on-`d` < json
  node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{let d;try{d=JSON.parse(s)}catch{d={}};const r=('"$1"');process.stdout.write(r==null?"":String(r))})'
}

# ---------- 0. preflight ----------
step "0. Preflight"
[[ $EUID -ne 0 ]] || die "Run it without sudo (as the ubuntu user): bash scripts/go-live.sh"
for c in node npm npx pm2 curl awk python3; do command -v "$c" >/dev/null || die "'$c' is not installed or not on PATH for this user."; done
[[ -f "$BACKEND_ENV" ]] || die "$BACKEND_ENV not found. Run this from the server's Vistachase folder."
pm2 describe vistachase-backend >/dev/null 2>&1 || die "PM2 app vistachase-backend not found for this user."
pm2 describe vistachase-frontend >/dev/null 2>&1 || die "PM2 app vistachase-frontend not found for this user."
if ! $CHECK_ONLY; then sudo -n true 2>/dev/null || sudo -v || die "This user needs sudo for nginx and certbot."; fi
command -v dig >/dev/null || { warn "installing dnsutils (dig)"; sudo apt-get install -y -qq dnsutils >/dev/null; }
ok "repo $ROOT, PM2 apps found"

# ---------- 1. DNS ----------
step "1. DNS: does ${DOMAIN} point at this server?"
TOKEN="$(curl -s -m 3 -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' || true)"
SERVER_IP="$(curl -s -m 3 -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 || true)"
[[ "$SERVER_IP" =~ ^[0-9.]+$ ]] || SERVER_IP="$(curl -s -m 5 https://checkip.amazonaws.com | tr -d '[:space:]' || true)"
[[ "$SERVER_IP" =~ ^[0-9.]+$ ]] || die "Couldn't find this server's public IP."
echo "  This server's public IP: ${B}${SERVER_IP}${N}"

dns_ok=true
for name in "$DOMAIN" "$WWW"; do
  a="$(dig +short A "$name" @8.8.8.8 | grep -E '^[0-9.]+$' | sort -u | tr '\n' ' ' || true)"
  aaaa="$(dig +short AAAA "$name" @8.8.8.8 | grep ':' | tr '\n' ' ' || true)"
  if [[ "$a" == "$SERVER_IP " ]]; then ok "$name -> $SERVER_IP"
  else warn "$name -> ${a:-nothing} (needs to be only $SERVER_IP)"; dns_ok=false; fi
  if [[ -n "$aaaa" ]]; then warn "$name also has an IPv6 (AAAA) record: $aaaa- delete it in GoDaddy."; dns_ok=false; fi
done
if ! $dns_ok; then
  cat <<EOF

  In GoDaddy -> ${DOMAIN} -> DNS, set exactly these (delete the old Webflow A/CNAME/AAAA records for @ and www):
     Type A      Name @      Value ${SERVER_IP}
     Type CNAME  Name www    Value ${DOMAIN}
  Make sure ${SERVER_IP} is an Elastic IP (AWS -> EC2 -> Elastic IPs), or it changes on the next restart.
  Then wait 10-30 minutes and run this script again.
EOF
  die "DNS doesn't point at this server yet."
fi

if $CHECK_ONLY; then
  step "Current settings (--check)"
  for k in NODE_ENV FRONTEND_URL SITE_URL CORS_ORIGINS SEO_BLOCK_INDEXING PAYMENT_PROVIDER BOKUN_API_URL; do echo "  backend  $k=$(env_get "$BACKEND_ENV" "$k")"; done
  sk="$(env_get "$BACKEND_ENV" STRIPE_SECRET_KEY)"; echo "  backend  STRIPE_SECRET_KEY=${sk:0:8}…"
  for k in NEXT_PUBLIC_APP_URL SITE_URL SEO_BLOCK_INDEXING; do echo "  frontend $k=$(env_get "$FRONTEND_ENV" "$k")"; done
  pk="$(env_get "$FRONTEND_ENV" NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)"; echo "  frontend NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${pk:0:8}…"
  echo; ok "DNS is ready. Run without --check to go live."; exit 0
fi

# ---------- 2. keys ----------
step "2. Live keys (typing is hidden; press Enter to keep a saved value)"
echo "  Stripe: Dashboard -> switch OFF Test mode -> Developers -> API keys."
cur_sk="$(env_get "$BACKEND_ENV" STRIPE_SECRET_KEY)"; [[ "$cur_sk" == sk_live_* || "$cur_sk" == rk_live_* ]] || cur_sk=""
cur_pk="$(env_get "$FRONTEND_ENV" NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)"; [[ "$cur_pk" == pk_live_* ]] || cur_pk=""
STRIPE_SK="$(ask_secret "Stripe LIVE secret key (sk_live_…)" "$cur_sk")"
[[ "$STRIPE_SK" == sk_live_* || "$STRIPE_SK" == rk_live_* ]] || die "That isn't a live secret key (it must start with sk_live_)."
STRIPE_PK="$(ask_secret "Stripe LIVE publishable key (pk_live_…)" "$cur_pk")"
[[ "$STRIPE_PK" == pk_live_* ]] || die "That isn't a live publishable key (it must start with pk_live_)."
live="$(stripe_api "$STRIPE_SK" GET balance | json 'd.livemode===true ? "yes" : (d.error ? d.error.message : "no")')"
[[ "$live" == "yes" ]] || die "Stripe didn't accept the secret key: $live"
ok "Stripe live secret key works"

echo "  Bókun: Settings -> Connections/API keys (the LIVE account, not bokuntest)."
cur_bapi="$(env_get "$BACKEND_ENV" BOKUN_API_URL)"
cur_ba=""; cur_bs=""
if [[ -z "$cur_bapi" || "$cur_bapi" == "$BOKUN_LIVE_API" ]]; then cur_ba="$(env_get "$BACKEND_ENV" BOKUN_ACCESS_KEY)"; cur_bs="$(env_get "$BACKEND_ENV" BOKUN_SECRET_KEY)"; fi
BOKUN_AK="$(ask_secret "Bókun LIVE access key" "$cur_ba")"
BOKUN_SK="$(ask_secret "Bókun LIVE secret key" "$cur_bs")"
if [[ -n "$BOKUN_AK" && -n "$BOKUN_SK" ]]; then
  if (cd "$BACKEND" && BOKUN_ACCESS_KEY="$BOKUN_AK" BOKUN_SECRET_KEY="$BOKUN_SK" BOKUN_API_URL="$BOKUN_LIVE_API" timeout 90 npx tsx scripts/bokun-probe.ts --list >/tmp/go-live-bokun.log 2>&1); then
    ok "Bókun live keys work"
  else
    tail -n 3 /tmp/go-live-bokun.log | sed 's/^/     /'
    die "Bókun didn't accept the live keys."
  fi
  rm -f /tmp/go-live-bokun.log
else
  warn "No Bókun live keys given: Bókun settings are left exactly as they are."
  BOKUN_AK=""; BOKUN_SK=""
fi

read -rp "  Email for the SSL certificate expiry notices [${CERT_EMAIL_DEFAULT}]: " CERT_EMAIL </dev/tty
CERT_EMAIL="${CERT_EMAIL:-$CERT_EMAIL_DEFAULT}"

# ---------- 3. nginx + certbot ----------
step "3. nginx + HTTPS certificate"
NGINX_CONF=""
for f in /etc/nginx/sites-enabled/*; do
  [[ -e "$f" ]] || continue
  if grep -q "proxy_pass" "$f" && grep -q "server_name" "$f"; then NGINX_CONF="$(readlink -f "$f")"; break; fi
done
[[ -n "$NGINX_CONF" ]] || die "Couldn't find the site's nginx file in /etc/nginx/sites-enabled."
ok "nginx file: $NGINX_CONF"
grep -q "X-Forwarded-Proto" "$NGINX_CONF" || warn "nginx doesn't pass X-Forwarded-Proto; sign-in cookies may not be marked Secure (sign-in still works)."

if ! grep -qE "server_name[^;]*[[:space:]]${WWW//./\\.}([[:space:];]|$)" "$NGINX_CONF"; then
  BK="/etc/nginx/go-live-backup-$STAMP"; sudo mkdir -p "$BK"; sudo cp -a "$NGINX_CONF" "$BK/"
  # Only the server block(s) that proxy to the site get the names; certbot's redirect blocks are left alone.
  sudo python3 - "$NGINX_CONF" "$DOMAIN $WWW" <<'PY'
import re, sys
path, names = sys.argv[1], sys.argv[2]
text = open(path).read()
out, i, changed = [], 0, 0
for m in re.finditer(r"(?m)^[ \t]*server[ \t]*\{", text):
    if m.start() < i: continue
    depth, j = 0, m.end() - 1
    while j < len(text):
        if text[j] == "{": depth += 1
        elif text[j] == "}":
            depth -= 1
            if depth == 0: break
        j += 1
    block = text[m.start():j + 1]
    if "proxy_pass" in block and not re.search(r"server_name[^;]*\swww\.vistachase\.com[\s;]", block):
        block = re.sub(r"(server_name[^;]*);", lambda s: s.group(1) + " " + names + ";", block, count=1)
        changed += 1
    out.append(text[i:m.start()]); out.append(block); i = j + 1
out.append(text[i:])
open(path, "w").write("".join(out))
print(f"  server blocks updated: {changed}")
PY
  if ! sudo nginx -t >/dev/null 2>&1; then sudo cp -a "$BK/$(basename "$NGINX_CONF")" "$NGINX_CONF"; die "nginx rejected the change (restored from $BK)."; fi
  sudo systemctl reload nginx
  ok "added ${DOMAIN} and ${WWW} to server_name (backup in $BK)"
else
  ok "nginx already has ${WWW}"
fi

# One certificate for every name this nginx file serves that resolves here (keeps e.g. new.vistachase.com working).
CERT_NAMES=("$DOMAIN" "$WWW")
for n in $(grep -hoE "server_name[^;]*" "$NGINX_CONF" | sed 's/server_name//' | tr ' ' '\n' | sort -u); do
  [[ "$n" == "$DOMAIN" || "$n" == "$WWW" || "$n" == "_" || "$n" =~ ^[0-9.]+$ || "$n" == localhost || "$n" != *.* ]] && continue
  if [[ "$(dig +short A "$n" @8.8.8.8 | grep -E '^[0-9.]+$' | sort -u | tr '\n' ' ' || true)" == "$SERVER_IP " ]]; then CERT_NAMES+=("$n"); fi
done
command -v certbot >/dev/null || { echo "  installing certbot…"; sudo apt-get update -qq && sudo apt-get install -y -qq certbot python3-certbot-nginx >/dev/null; }
D_ARGS=(); for n in "${CERT_NAMES[@]}"; do D_ARGS+=(-d "$n"); done
echo "  certificate for: ${CERT_NAMES[*]}"
sudo certbot --nginx --non-interactive --agree-tos -m "$CERT_EMAIL" --redirect \
  --cert-name "$DOMAIN" --expand --keep-until-expiring "${D_ARGS[@]}" \
  || die "certbot failed (see above). Usual causes: port 80 closed in the AWS Security Group, or DNS not updated everywhere yet."
sudo nginx -t >/dev/null 2>&1 && sudo systemctl reload nginx
code="$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$SITE/" || true)"
[[ "$code" =~ ^[23] ]] || die "https://${WWW} doesn't answer (HTTP ${code:-none}). Open port 443 (HTTPS) to 0.0.0.0/0 in the AWS Security Group, then run again."
ok "https://${WWW} answers with a valid certificate"

# ---------- 4. Stripe webhook ----------
step "4. Stripe live webhook"
EV_ARGS=(); for e in "${WEBHOOK_EVENTS[@]}"; do EV_ARGS+=(--data-urlencode "enabled_events[]=$e"); done
cur_whsec="$(env_get "$BACKEND_ENV" STRIPE_WEBHOOK_SECRET)"
cur_whid="$(env_get "$BACKEND_ENV" STRIPE_WEBHOOK_ENDPOINT_ID)"
WH_ID="$(stripe_api "$STRIPE_SK" GET "webhook_endpoints?limit=100" | WURL="$WEBHOOK_URL" json '((d.data||[]).find(w=>w.url===process.env.WURL)||{}).id')"
WHSEC=""
if [[ -n "$WH_ID" ]]; then
  stripe_api "$STRIPE_SK" POST "webhook_endpoints/$WH_ID" -d disabled=false "${EV_ARGS[@]}" -o /dev/null
  if [[ "$WH_ID" == "$cur_whid" && "$cur_whsec" == whsec_* ]]; then
    WHSEC="$cur_whsec"; ok "webhook $WH_ID already set up; events checked"
  else
    echo "  A live webhook for $WEBHOOK_URL already exists ($WH_ID)."
    echo "  Stripe -> Developers -> Webhooks -> that endpoint -> Signing secret -> Reveal."
    WHSEC="$(ask_secret "Its signing secret (whsec_…)" "")"
    [[ "$WHSEC" == whsec_* ]] || die "That isn't a webhook signing secret (it must start with whsec_)."
  fi
else
  resp="$(stripe_api "$STRIPE_SK" POST webhook_endpoints --data-urlencode "url=$WEBHOOK_URL" \
    --data-urlencode "description=Vista Chase website (created by scripts/go-live.sh)" "${EV_ARGS[@]}")"
  WH_ID="$(printf '%s' "$resp" | json 'd.id')"; WHSEC="$(printf '%s' "$resp" | json 'd.secret')"
  [[ "$WHSEC" == whsec_* ]] || die "Stripe didn't create the webhook: $(printf '%s' "$resp" | json 'd.error && d.error.message')"
  ok "created live webhook $WH_ID -> $WEBHOOK_URL (7 events)"
fi

# ---------- 5. .env files ----------
step "5. Writing settings (backups first)"
cp -a "$BACKEND_ENV" "$BACKEND_ENV.bak-golive-$STAMP"
[[ -f "$FRONTEND_ENV" ]] && cp -a "$FRONTEND_ENV" "$FRONTEND_ENV.bak-golive-$STAMP" || true
restore_env() {
  cp -a "$BACKEND_ENV.bak-golive-$STAMP" "$BACKEND_ENV"
  if [[ -f "$FRONTEND_ENV.bak-golive-$STAMP" ]]; then cp -a "$FRONTEND_ENV.bak-golive-$STAMP" "$FRONTEND_ENV"; else rm -f "$FRONTEND_ENV"; fi
}

env_set "$BACKEND_ENV" NODE_ENV production
env_set "$BACKEND_ENV" FRONTEND_URL "$SITE"
env_set "$BACKEND_ENV" SITE_URL "$SITE"
env_set "$BACKEND_ENV" CORS_ORIGINS "$SITE,https://$DOMAIN"
env_set "$BACKEND_ENV" SEO_BLOCK_INDEXING false
env_set "$BACKEND_ENV" PAYMENT_PROVIDER stripe
env_set "$BACKEND_ENV" FEATURE_MOCK_PAYMENT false
env_set "$BACKEND_ENV" STRIPE_SECRET_KEY "$STRIPE_SK"
env_set "$BACKEND_ENV" STRIPE_WEBHOOK_SECRET "$WHSEC"
env_set "$BACKEND_ENV" STRIPE_WEBHOOK_ENDPOINT_ID "$WH_ID"
if [[ -n "$BOKUN_AK" ]]; then
  env_set "$BACKEND_ENV" BOKUN_API_URL "$BOKUN_LIVE_API"
  env_set "$BACKEND_ENV" BOKUN_ACCESS_KEY "$BOKUN_AK"
  env_set "$BACKEND_ENV" BOKUN_SECRET_KEY "$BOKUN_SK"
  env_comment_out "$BACKEND_ENV" BOKUN_PRODUCT_OVERRIDES   # test-account product IDs; live uses product-map.json
fi
chmod 600 "$BACKEND_ENV"

env_set "$FRONTEND_ENV" NEXT_PUBLIC_APP_URL "$SITE"
env_set "$FRONTEND_ENV" SITE_URL "$SITE"
env_set "$FRONTEND_ENV" SEO_BLOCK_INDEXING false
env_set "$FRONTEND_ENV" NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY "$STRIPE_PK"
chmod 600 "$FRONTEND_ENV"
ok "backend/.env and frontend/.env.production.local updated (backups *.bak-golive-$STAMP)"

# ---------- 6. rebuild + restart + health ----------
step "6. Rebuilding the website (5-10 minutes; the live site keeps running meanwhile)"
cd "$FRONTEND"
rm -rf .next-build
if ! NEXT_BUILD_DIR=.next-build npx next build > /tmp/go-live-build.log 2>&1; then
  tail -n 20 /tmp/go-live-build.log; rm -rf .next-build; restore_env
  die "Frontend build failed. Old settings put back; the live site was not restarted."
fi
rm -rf .next-prev; [[ -d .next ]] && mv .next .next-prev; mv .next-build .next
ok "frontend built"
cd "$ROOT"

pm2 restart vistachase-backend --update-env >/dev/null
pm2 restart vistachase-frontend --update-env >/dev/null
healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS -m 10 http://127.0.0.1:4000/api/health -o /dev/null && curl -fsS -m 10 http://127.0.0.1:3000/ -o /dev/null; then return 0; fi
    sleep 3
  done
  return 1
}
if ! healthy; then
  echo "  ${R}Health checks failed: putting the old settings and build back.${N}"
  restore_env
  (cd "$FRONTEND" && [[ -d .next-prev ]] && rm -rf .next && cp -a .next-prev .next) || true
  pm2 restart vistachase-backend --update-env >/dev/null; pm2 restart vistachase-frontend --update-env >/dev/null
  pm2 logs vistachase-backend --lines 30 --nostream || true
  die "The site didn't come up with the new settings (old ones restored). Send the log above to Claude."
fi
pm2 save >/dev/null 2>&1 || true
ok "API and website healthy after restart"

step "7. Final checks"
fail=0
c="$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$SITE/")"; [[ "$c" == 200 ]] && ok "$SITE/ -> 200" || { warn "$SITE/ -> $c"; fail=1; }
c="$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$SITE/api/health")"; [[ "$c" == 200 ]] && ok "$SITE/api/health -> 200" || { warn "/api/health -> $c"; fail=1; }
loc="$(curl -s -o /dev/null -m 15 -w '%{redirect_url}' "http://$WWW/")"; [[ "$loc" == https://* ]] && ok "http:// redirects to https://" || warn "http:// doesn't redirect to https://"
if curl -s -m 15 "$SITE/robots.txt" | grep -qi "Disallow: /$"; then warn "robots.txt still blocks Google (SEO_BLOCK_INDEXING)"; fail=1; else ok "robots.txt lets Google in"; fi
# A value PM2 itself holds wins over .env (dotenv never overrides it): list any key that disagrees.
stale="$(pm2 jlist 2>/dev/null | BE="$BACKEND_ENV" node -e '
  const fs=require("fs"); let s=""; process.stdin.on("data",c=>s+=c).on("end",()=>{
    const want={}; for (const l of fs.readFileSync(process.env.BE,"utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) want[m[1]]=m[2].replace(/^["\x27]|["\x27]$/g,""); }
    let list=[]; try { list=JSON.parse(s.slice(s.indexOf("["))); } catch {}
    const app=list.find(p=>p.name==="vistachase-backend"); const env=(app&&app.pm2_env)||{};
    const keys=["NODE_ENV","FRONTEND_URL","SITE_URL","CORS_ORIGINS","PAYMENT_PROVIDER","STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET","BOKUN_API_URL","BOKUN_ACCESS_KEY","BOKUN_SECRET_KEY","BOKUN_PRODUCT_OVERRIDES","SEO_BLOCK_INDEXING"];
    process.stdout.write(keys.filter(k=>env[k]!==undefined && env[k]!==want[k]).join(" "));
  });' || true)"
if [[ -n "$stale" ]]; then
  warn "PM2 holds its own old value for: $stale. Those override .env, so the API may still use them. Send this line to Claude."
  fail=1
else
  ok "the API runs with the new .env values"
fi
if pm2 logs vistachase-backend --lines 80 --nostream 2>/dev/null | grep -q "Stripe is in TEST mode"; then warn "API log still mentions Stripe TEST mode (check the newest lines)"; fi
if [[ -n "$BOKUN_AK" ]]; then
  echo "  Bókun products on this site vs the live Bókun account:"
  (cd "$BACKEND" && timeout 120 npx tsx scripts/bokun-probe.ts --all 2>&1 | grep -vE '^\s+(categories|[0-9]+ departures)' | head -n 30 | sed 's/^/     /') || true
fi

echo
if [[ $fail -eq 0 ]]; then
  echo "${G}${B}Done: the site is live at $SITE with live Stripe${BOKUN_AK:+ and live Bókun}.${N}"
else
  echo "${Y}${B}Live, but some checks above need a look.${N}"
fi
cat <<EOF

Still to do by hand (2 minutes):
  1. Make one real booking with your own card, check the confirmation email, then refund it from Admin.
  2. Admin -> Bookings -> Bókun -> "Sync now", and check that booking shows up in Bókun.
  Backups of the old settings: backend/.env.bak-golive-$STAMP, frontend/.env.production.local.bak-golive-$STAMP
EOF
