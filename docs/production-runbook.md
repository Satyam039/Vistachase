# Production runbook

How Vista Chase runs in production, how to deploy it the first time, and what to do when something goes wrong. It matches `render.yaml`; update both together.

## What runs

| Service | What it is | Start |
|---|---|---|
| `vistachase-frontend` | Next.js site. Proxies `/api/*` and `/media/*` to the API, so the browser stays on one origin. | `npm run start` |
| `vistachase-backend` | Express API, 2 instances. Applies migrations at release (`preDeployCommand`). | `node dist/server.js` |
| `vistachase-worker` | Background jobs (`src/worker.ts`): expires unpaid holds and bookings every 5 min, nightly booking check at 02:00 MT, review requests at 10:00 MT. | `npm run worker` |
| `vistachase-db` | PostgreSQL 16, daily backups with point-in-time recovery. | managed |
| `vistachase-redis` | Redis, for rate limits, cache and the job queue. Must be `noeviction`. | managed |

## Settings

Secrets are entered in Render, never committed. The full list with comments is in `backend/.env.example` and `frontend/.env.example`.

Required for the backend:
- `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `VOUCHER_SECRET`, `FRONTEND_URL`
- `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` (on a verified domain), `ENQUIRIES_TO`, `OPS_ALERT_EMAIL`
- `PROMO_CODES`, the same codes as in Bókun

Required for the frontend: `BACKEND_URL` (read at build time), `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

Optional: `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`, `ANTHROPIC_API_KEY` (AI concierge), and the Bókun keys once the live integration is built.

The worker must have the same `VOUCHER_SECRET` and `JWT_SECRET` as the API. `render.yaml` copies them from the API service, because the review links the worker emails are checked by the API.

## First deploy

1. Create the services from `render.yaml` and enter the secrets marked `sync: false`.
2. Deploy. Release runs `prisma migrate deploy` and creates every table.
3. Load the catalog once, on the empty database. Run this from the backend shell:
   ```bash
   npm run prisma:seed
   ```
   It refuses to run once bookings exist, because it replaces the whole catalog.
4. Create the first admin. In Render, set `ADMIN_PASSWORD` (12+ characters) on the shell session only, then run:
   ```bash
   node scripts/create-admin.js admin@vistachase.com
   ```
5. Set up the Stripe webhook:
   - Endpoint: `https://<api-host>/api/webhooks/stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`
   - Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
6. Verify the sending domain in Resend (SPF, DKIM, DMARC) before switching `EMAIL_FROM`.
7. Make a real booking with a live card, check the confirmation email and voucher link, then cancel it more than 72 hours ahead and confirm the refund in Stripe.

Never run `prisma/seed-fixtures.js` in production. It creates demo staff accounts with known passwords, and it exits if `NODE_ENV=production`.

## How a booking flows

1. The guest holds seats for 10 minutes.
2. The booking is saved as `PENDING_PAYMENT`, with its seats taken.
3. The guest pays in Stripe's Payment Element.
4. Stripe's webhook confirms the booking: it becomes `CONFIRMED` and the voucher email is sent.
   - If the Bókun reservation fails at this step, the booking is `PAID_UNSYNCED` instead.

Unpaid bookings are cancelled after 30 minutes and their seats freed (worker). The nightly check emails `OPS_ALERT_EMAIL` the bookings that need a person.

## Monitoring

- **Uptime:** `GET /api/health` returns 200 with database and cache status. Alert if it fails for 2 minutes.
- **Errors:** Sentry, for the API and the site, when the DSNs are set.
- **Nightly email:** "N bookings need attention". Each line says what to do.

## When something goes wrong

| Symptom | Check | Fix |
|---|---|---|
| Guests paid but bookings stay "awaiting payment" | Stripe dashboard, webhook deliveries | Fix the endpoint or secret, then resend the failed events from Stripe. Confirming is idempotent. |
| Bookings marked `PAID_UNSYNCED` | Nightly email, API logs | Create the reservation in Bókun by hand, add its ID to the booking in admin notes. |
| Seats look booked but nobody paid | Is the worker running? | Restart `vistachase-worker`. It frees expired holds within 5 minutes. |
| No emails | Resend dashboard, `EMAIL_FROM` domain | Re-verify the domain; resend vouchers from Admin → booking → Resend voucher. |
| Site shows "trouble loading" | API health, database | The site no longer serves a hard-coded catalog in production, so fix the API. |

## Backups and restore

- Render keeps daily backups with point-in-time recovery on the standard database plan.
- Rehearse a restore to a new database before launch, and every quarter: restore, point a staging API at it, and open a recent booking.
- To restore production, restore to a new database, switch `DATABASE_URL` on the API and the worker, then redeploy.

## Rollback

- **App:** redeploy the previous successful Render deploy.
  - Migrations only ever add (`prisma/migrations`), so the older code still runs on the newer schema.
- **Cutover:** until the Webflow site is retired, point DNS back to Webflow.
