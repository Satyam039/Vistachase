# Testing and production readiness

## 1. Test results (this branch, 2026-10-10)

Environment: isolated container, PostgreSQL 16 + Redis 7 locally, **test database** `vistachase_test` (force-reset and seeded by `backend/tests/global-setup.ts`; its name must contain "test"). No production system was contacted.

| Check | Command | Result |
|---|---|---|
| Backend typecheck | `cd backend && npm run typecheck` | **pass** (exit 0) |
| Backend build | `cd backend && npm run build` | **pass** (`dist/server.js`, `dist/worker.js`) |
| Backend tests | `cd backend && npx vitest run` (env as in CI) | **30 files, 127 tests, all passed** — baseline on `main` before changes: 29 files, 121 tests passed. New: `booking-window.test.ts` (3), 2 in `affiliates.test.ts`, 1 in `api-date-format.test.ts`. Full suite run 3× consecutively after the booking-window change: stable. |
| Frontend typecheck | `cd frontend && npx tsc --noEmit -p .` | **pass** |
| Frontend lint | `cd frontend && npx eslint src --quiet` | **pass** |
| Frontend build | `cd frontend && FEATURE_FALLBACK_CATALOG=true npm run build` | **pass** |
| Whitespace | `git diff --check` | **clean** |

Expected noise in the test log: `stderr` lines from tests that simulate a Bókun outage and a bad Stripe signature — they assert the failure handling.

### End-to-end checks on the local stack (real backend on the test DB + production frontend build, Chromium)

| Scenario | Result |
|---|---|
| Product page `/banff-highlights-tour` lists departures | 11 departures from the API; calendar shows 8 selectable days |
| Select another date | Selection changed "Sat Oct 10 · 19:39" → "Sun Oct 11 · 08:30" |
| Adults/children | 3 adults + 1 child → breakdown "3 × $199 (adults) $597 · 1 × $199 (child) $199 · Estimated total $796" (fixtures have no separate child fare; hint shows "Same fare as adults") |
| Book now → checkout | URL carried `guests=4&adults=3&children=1`; checkout opened with "3 adults, 1 child" |
| Hold on a **past** departure (inserted via SQL) | `POST /api/reservations/hold` → `{"success":false,"error":"Online booking for this departure closed 60 minutes before departure…"}` |
| Past departure in the listing | not listed by `/api/tours/:slug` |
| Hold on a future departure, then release | hold created (10 min, 2 seats) → `DELETE /api/reservations/hold?token=` → `released: true`, status `RELEASED` |
| Header logo (desktop and 390 px phone, 3× DPR) | `/media/brand/emblem-ink.svg` loads; four legs visible |
| Page errors | none |

### Not tested (and why)

| Area | Reason |
|---|---|
| AWS production server (PM2, `.env`, `127.0.0.1:3000/4000` health) | not reachable from the audit environment |
| CloudFront media URLs (`degvemzxmpurb.cloudfront.net`) | blocked by the environment's network policy |
| Live Bókun, Stripe, Resend, Anthropic, WhatsApp provider | no credentials in the audit environment; covered by mocked tests |
| Affiliate attribution through a real browser cookie across pages | the server-side attribution and self-referral rules are tested; the cookie is set by Next middleware (code reviewed) |
| Authorization boundaries partner ↔ customer ↔ admin | covered by existing tests (`affiliates`, `admin-api`, `security-hardening`, `tracking-privacy`); no new reseller role exists yet |

## 2. Production readiness checklist

| Item | Status | How to check on the server |
|---|---|---|
| Departures syncing from Bókun | **Fails today** (audit F-1) | `curl -s http://127.0.0.1:4000/api/tours/banff-highlights-tour \| grep -c departureTime` > 0; `pm2 logs vistachase-backend \| grep bokun-availability` |
| `RUN_JOBS_IN_API=true` (no worker on AWS) | unknown | `grep -c '^RUN_JOBS_IN_API=true' backend/.env` |
| Redis | unknown | `curl -s http://127.0.0.1:4000/api/health` → `"cache":"ok"` |
| Database backups + restore test | unknown | RDS console / backup job; restore into a scratch DB |
| `VOUCHER_SECRET` set separately from `JWT_SECRET` | unknown | `grep -c '^VOUCHER_SECRET=' backend/.env` (don't print values) |
| Stripe live webhook | unknown | Stripe dashboard → webhook endpoint `/api/webhooks/stripe` recent deliveries 2xx |
| Email domain verified | unknown | Resend dashboard |
| Sentry DSNs | optional | test error |
| Media CDN (`NEXT_PUBLIC_MEDIA_CDN_URL`) | optional | `curl -sI https://degvemzxmpurb.cloudfront.net/media/videos/lake-louise-summer.mp4` → 200 `video/mp4` before enabling |

## 3. CI and deployment workflows (reviewed)

- `.github/workflows/ci.yml` — original CI: Postgres + Redis services; backend `npm ci`, prisma generate, `migrate deploy` + schema drift check, typecheck, build, tests; frontend tsc, eslint, build with the fallback catalog. Unchanged.
- `.github/workflows/deploy-aws.yml` — on push to `main` (and manual): builds backend and frontend on the runner, then over SSH: restores generated sitemap/robots files, refuses to deploy over tracked server changes, `git pull --ff-only`, builds next to the live release (`.next-build`), swaps, restarts PM2, health-checks `:4000/api/tours` and `:3000/` for up to 90 s, and rolls back to `dist-prev` / `.next-prev` on failure. Last run (#6, `578ffdb`) succeeded. Gap: does not wait for CI (roadmap P0-8).

## 4. Safe deployment steps for this branch

The branch contains **no database migrations**. New optional env: `BOOKING_CUTOFF_MINUTES` (default 60).

1. **Before merging** — on the server, add the job/Bókun settings (P0-1) to `backend/.env` if you want the calendar back immediately:
   ```bash
   cd /home/ubuntu/Vistachase
   cp backend/.env ~/vistachase-deploy-backup/backend.env.$(date +%F)   # keep a copy; never commit .env
   nano backend/.env    # add RUN_JOBS_IN_API=true, BOKUN_ACCESS_KEY=…, BOKUN_SECRET_KEY=…, BOKUN_API_URL=https://api.bokun.io
   ```
   (The deploy restarts PM2 without `--update-env`; to load new env vars run `pm2 restart vistachase-backend --update-env` once after editing.)
2. Merge the pull request into `main`. The **Deploy VistaChase to AWS** workflow builds, swaps and health-checks automatically.
3. Verify:
   ```bash
   curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
   curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/api/tours
   pm2 logs vistachase-backend --lines 50 | grep -E 'bokun-availability|expire-holds'
   curl -s http://127.0.0.1:4000/api/tours/banff-highlights-tour | grep -c departureTime
   ```
   Then open a product page: the calendar, adults/children and Book now should appear; the header horse shows four legs.
4. **Logo on the CDN:** if the brand SVGs are also served from S3/CloudFront, upload the three updated `backend/media/brand/emblem-*.svg` files and invalidate `/media/brand/emblem-*` (owner approval for AWS changes).

## 5. Rollback

- **Automatic:** the deploy workflow restores `backend/dist-prev` and `frontend/.next-prev` and restarts PM2 if health checks fail.
- **Manual (code):** revert the merge commit on GitHub (`git revert -m 1 <merge-sha>` in a PR) and let the workflow deploy the revert. No migrations to undo.
- **Manual (build only, on the server):**
  ```bash
  cd /home/ubuntu/Vistachase
  rm -rf backend/dist && cp -a backend/dist-prev backend/dist
  rm -rf frontend/.next && cp -a frontend/.next-prev frontend/.next
  pm2 restart vistachase-backend vistachase-frontend
  ```
- **Configuration only:** remove the added lines from `backend/.env` (or restore the copy from step 1) and `pm2 restart vistachase-backend --update-env`.
- **Booking cutoff only:** set `BOOKING_CUTOFF_MINUTES=0` (bookings until departure) and restart with `--update-env`.

Never use `git reset --hard`, `git clean` or `git stash pop` on the server; the stash `production-cdn-backup-before-main-sync` and `~/vistachase-deploy-backup/` stay untouched.
