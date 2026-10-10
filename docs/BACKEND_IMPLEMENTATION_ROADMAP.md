# Backend implementation roadmap

Built from `FRONTEND_BACKEND_AUDIT.md` and `BOOKING_FLOW_AND_REQUIREMENTS_MATRIX.md`. Each stage is a separate reviewed pull request with tests; nothing is merged without `npm run typecheck`, the backend suite and a frontend build passing (`TESTING_AND_PRODUCTION_READINESS.md`).

**Estimates** are developer-days for one developer who knows the codebase, including tests and review fixes, excluding third-party waiting time. Assumptions: Bókun remains the source of truth for availability and prices; PostgreSQL + Redis as today; additive migrations only; Stripe for card payments.

**Done on this branch:** booking cutoff (F-2), partner commission on paid bookings only (F-3), no self-referral (F-4), logo (F-5), pickup-time formatting (F-6), adults/children on the tour page.

---

## P0 — Production safety (≈ 4–6 days + configuration)

| # | Item | Status / evidence | Change & files | Contract / schema | Rules & auth | Tests / acceptance | Est. |
|---|---|---|---|---|---|---|---|
| P0-1 | **Turn on departure sync + unpaid-booking expiry on AWS** | F-1 (config) | Server `backend/.env`: `RUN_JOBS_IN_API=true`, `BOKUN_ACCESS_KEY`, `BOKUN_SECRET_KEY`, `BOKUN_API_URL`; optional `BOOKING_CUTOFF_MINUTES`. `pm2 restart vistachase-backend --update-env`. Or run `npm run worker` as a third PM2 process (needs Redis) and leave the flag off. | – | Never both. | Log shows `bokun-availability done`; `/api/tours/<slug>` has departures; product page shows the calendar. | 0.5 (+ Bókun keys from the owner) |
| P0-2 | Confirm **database backups** and a restore test | O-4, Not verified | RDS automated backups (≥ 7 days) + PITR, or nightly `pg_dump` to S3 with lifecycle; document restore. | – | Owner approval for AWS changes. | Restore of last night's backup into a scratch DB succeeds. | 1 |
| P0-3 | Confirm **Redis** in production | O-5 | `REDIS_URL` set; `noeviction`. | – | – | `/api/health` → `checks.cache: "ok"`. | 0.25 |
| P0-4 | **Staff role revocation** | S-1 | `lib/auth/admin-guard.ts`: re-load user (role, active) from DB in `getAuthenticatedStaff` with a 60 s cache; add `tokenVersion` to `User` and the JWT, bump on role change/password reset/logout-everywhere. | Migration: `User.tokenVersion Int @default(0)` (additive) | Demoted users lose access within 60 s. | Test: demote → next request 403; password reset invalidates old token. | 1.5 |
| P0-5 | **Separate `VOUCHER_SECRET`**, required in production | S-2 | `server.ts` start-up check when `NODE_ENV=production`. | – | – | Start fails without it in production. | 0.25 |
| P0-6 | Hold tokens cryptographic; no PII on `GET hold` | S-4 | `reservation.repository.ts`: `crypto.randomBytes(24).toString("base64url")`; return name only. | Response drops `customerEmail` | – | Token length/entropy test; response shape test. | 0.5 |
| P0-7 | Error tracking and uptime alerts | – | `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` (already wired); external uptime check on `/api/health` and `/`. | – | – | Test error appears in Sentry; alert fires on downtime. | 0.5 |
| P0-8 | Deploy gated on CI | O-7 | `deploy-aws.yml`: trigger on `workflow_run` of "Vista Chase CI" (success, `main`) + manual. | – | – | Red CI → no deploy. | 0.5 |

## P1 — Core booking (≈ 8–10 days)

| # | Item | Status | Change & files | Contract / schema | Rules | Tests / acceptance | Est. |
|---|---|---|---|---|---|---|---|
| P1-1 | Product readiness for Bókun | `bokunReadiness()` lists missing IDs | Fill `prisma/catalog/product-map.json` Bókun IDs for every BOKUN product; admin page shows readiness (keys, channel, missing IDs). | `GET /api/admin/integrations/bokun` → `{apiKeys, onlineSalesChannel, productIdsMissing[], lastSync}` | ADMIN | Each BOKUN product has departures after sync. | 1 |
| P1-2 | Sync status visibility | Sync logs to console only | Persist each run in `BokunSyncLog` (model exists); show last run/errors on `/admin/operations`. | existing model | staff | Failed product shows its error. | 1 |
| P1-3 | Per-product booking cutoff | Global cutoff done (this branch) | Optional `Tour.bookingCutoffMinutes Int?` overriding the env default; take Bókun's cutoff when its API provides it. | Additive column | Server-side only | Per-product override test. | 1 |
| P1-4 | Passenger types from Bókun | Adult/child prices mapped; infants free | Map Bókun pricing categories (adult/child/infant/senior) per product to `TourDeparture.prices Json` (keep `price`/`childPrice` for compatibility); frontend shows the categories a product actually has. | `prices: [{category, label, priceCents, minAge, maxAge}]` | Prices only from the server | Category pricing tests; UI hides unused categories. | 2–3 |
| P1-5 | Enquiry workflow | Enquiries saved/emailed; API-only admin | Admin enquiry screen (list, reply status, notes) on the existing `GET/PATCH /api/admin/enquiries`. | – | staff | Enquiry moves NEW → REPLIED → CLOSED. | 1.5 |
| P1-6 | Product content editor | O-3 | Admin edit of text/images/booking mode/visibility for existing products (no slug changes); audit log. | `PATCH /api/admin/tours/:slug` (zod-validated fields) | ADMIN | Edited text shows on the product page; audit row written. | 2 |

## P2 — Booking operations (≈ 9–13 days)

| # | Item | Status | Change | Contract | Est. |
|---|---|---|---|---|---|
| P2-1 | **Quick Book** (staff books for a phone/walk-in guest) | Missing | Staff form reusing `createBooking` with `channel: "STAFF"`, payment link (Stripe Checkout/PaymentIntent link) or "paid offline" (ADMIN approval, audited). | `POST /api/admin/bookings` | 2.5 |
| P2-2 | Admin bookings screen | API only (O-1) | Search, detail, notes, resend voucher, cancel/refund with policy override (ADMIN, reason required). | existing endpoints + `POST /api/admin/bookings/:id/cancel` | 2 |
| P2-3 | **Daily Departures** + **Passenger list** + **Pick-up list** | Partially working | One day view: per departure seats/booked/held, guests, pickups ordered, vehicle/guide; CSV/print. | `GET /api/admin/departures?date=` | 2 |
| P2-4 | Staff **calendar** across products | Missing | Month grid of departures with fill rate; links to day view. | `GET /api/admin/calendar?from=&to=` | 1.5 |
| P2-5 | **Close-outs** | Missing | Close-outs are made in Bókun (sync marks them CANCELLED). For non-Bókun products: `stopSale` flag per departure/date range, respected by listing/hold/booking. | `POST /api/admin/close-outs` | 1.5 |
| P2-6 | **Customers** | Partially | Staff customer search (users + guest emails from bookings), history, notes. | `GET /api/admin/customers?q=` | 1.5 |
| P2-7 | Resource capacity link | Partially | Warn when booked seats exceed assigned vehicle seats; resource overview per day. | in day view | 1 |
| P2-8 | Hardening | S-5, S-6, S-8 | Rate limits on hold GET/DELETE and search; reviews only via session/signed link; concierge daily budget. | – | 1 |

## P3 — Affiliate / reseller platform (≈ 17–20 days)

Design: `AFFILIATE_PLATFORM_DESIGN.md`.

| # | Item | Est. |
|---|---|---|
| P3-1 | Click tracking + campaigns (`AffiliateClick`, `AffiliateCampaign`), dashboard clicks and conversion rate | 3 |
| P3-2 | Commission rules + append-only ledger; earn on payment, reverse on refund/cancel; dashboard reads the ledger | 4 |
| P3-3 | Promo-code table, admin generation, booking stores promo + discount; promo usage report | 3 |
| P3-4 | Payouts with manual ADMIN approval (no money movement) | 2 |
| P3-5 | Model C reseller portal: contracts, contract terms, net rates, reseller booking, conversations | 5–8 |

## P4 — Payments and integrations (≈ 4–7 days + third-party time)

| # | Item | Dependency | Est. |
|---|---|---|---|
| P4-1 | Live Stripe verification (webhook in Stripe dashboard, live keys, a real booking + refund) | Stripe account | 0.5 |
| P4-2 | Refund reconciliation: handle `charge.refunded` webhook (refunds made in the Stripe dashboard update the booking and reverse commission) | Stripe | 1.5 |
| P4-3 | Email deliverability (Resend domain SPF/DKIM/DMARC) and templates check | DNS access (owner approval) | 0.5 |
| P4-4 | OTAs via Bókun channel manager | OTA contracts, Bókun setup | config only |
| P4-5 | Google Things to Do | Google eligibility + connectivity partner | config only |
| P4-6 | Model B outbound-click tracking; verified provider postbacks where offered | Provider API | 1.5 |
| P4-7 | Sales tax (GST) if the accountant confirms it applies | Owner/accountant | 1 |

## P5 — Operations and analytics (≈ 11–13 days)

| # | Item | Est. |
|---|---|---|
| P5-1 | **Sales feed** (paginated, filters) | 1.5 |
| P5-2 | **Sales overview** by period/product/channel/partner | 2 |
| P5-3 | **Experience/product sales** report | 1 |
| P5-4 | **Income statement** (gross, refunds, discounts, commissions, net; CSV for the accountant) | 2 |
| P5-5 | **Custom reports** (CSV export with chosen columns/filters) | 2 |
| P5-6 | **Settings** screen (company, staff & roles, cutoff/hold duration, policy text, notification recipients, integrations status read-only) — excluding Subscription and Legacy Content | 2 |
| P5-7 | Audit-log viewer, recovery runbook for AWS | 1 |

## Sequencing

```
P0 (config + safety) ─┬─> P1 (Bókun readiness, categories, enquiries, editor)
                      └─> deploy this branch
P1 ─> P2 (Quick Book, day views, close-outs, customers)
P2 ─> P3.1–P3.3 (clicks, ledger, promo codes) ─> P3.4 payouts ─> P3.5 resellers
P4 runs alongside once the owner provides accounts/approvals
P5 after P3.3 (reports need the ledger and stored promo codes)
```

Totals (internal work, mid-points): P0 ≈ 5, P1 ≈ 9, P2 ≈ 13, P3 ≈ 18, P4 ≈ 5, P5 ≈ 12 → **≈ 62 developer-days**, plus third-party lead times.

## Needs third-party access or commercial approval

- **Bókun:** API keys, product IDs, online sales channel; OTA connections and Google Things to Do via Bókun or another approved partner.
- **Stripe:** live keys, webhook secret; Stripe Connect only if automated partner payouts are wanted (KYC/tax).
- **Resend:** verified sending domain (DNS change — owner approval).
- **Anthropic:** API key and budget for the concierge.
- **AWS:** backups/RDS, Redis, CloudFront/S3 changes — owner approval; no DNS or bucket-permission changes without approval.
- **Accountant:** GST treatment; income statement format.
- **Legal:** partner terms, privacy policy update for the referral cookie and click tracking.
