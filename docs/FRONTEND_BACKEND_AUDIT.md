# Frontend and backend audit

Date: 2026-10-10. Code: `main` at `578ffdb` plus branch `claude/vista-chase-frontend-px8k69`. Status vocabulary: see `BOOKING_FLOW_AND_REQUIREMENTS_MATRIX.md` (Verified working · Partially working · UI only/mocked · API only · Missing · Broken · Not verified).

## How the audit was done

- Read every route file, the Prisma schema, the booking, pricing, reservation, affiliate, Bókun, payment, email, jobs and auth modules, and the frontend pages/components that call the API (`docs/API_INVENTORY.md` lists all 61 endpoints with guards).
- Traced each major feature: UI → request → guard/validation → service → database/provider → response → UI state.
- Ran the backend test suite against an isolated PostgreSQL 16 + Redis (a **test** database, force-reset per run; never production): **30 files, 127 tests, all passing** after this branch's changes (baseline on `main`: 29 files, 121 tests passing).
- Ran the real backend (`:4000`, test database) and a production build of the frontend (`:3000`) and drove the booking flow in Chromium; made controlled API calls (holds created and released, a past departure inserted and removed) on the test database only. No real bookings, payments or customer records were touched.
- **Not reachable** from the audit environment (network policy): the AWS production server and its `.env`/PM2, Bókun, Stripe, Resend, Anthropic, CloudFront/S3. Everything depending on them is marked *Not verified*.

## Executive summary

1. **Production shows "Dates on request" because no departures reach the AWS database** — the Bókun availability sync is not running there (no worker under PM2, and the API runs it only with `RUN_JOBS_IN_API=true` plus Bókun keys). The calendar code is intact and works. Fix is configuration (P0, see *Restoring the calendar* in `BOOKING_FLOW_AND_REQUIREMENTS_MATRIX.md`).
2. **Past departures could be booked** (no server-side time check). **Fixed** on this branch with a configurable booking cutoff, enforced in holds, bookings and listings.
3. **Partners earned commission on unpaid and refunded bookings, and could refer themselves. Fixed** on this branch.
4. **Logo showed three legs** in the header/menu SVGs. **Fixed** (restored from the official raster).
5. **WhatsApp/AI/tracking pickup time could read "1970-01-01T09:00:00.000Z"**. **Fixed**.
6. Several staff features are **API only** (bookings, enquiries, staff roles, audit log) and most of the requested back-office (Quick Book, reports, promo generation, contracts, close-outs) is **missing** — see the roadmap.

## Findings

Severity: **Critical** (money/data loss or outage), **High** (customer-facing failure or security weakness with a realistic path), **Medium**, **Low**.

| ID | Area | Finding | Evidence | Severity | Impact | Status / fix |
|---|---|---|---|---|---|---|
| F-1 | Production config | Departures never sync on AWS: no `vistachase-worker` under PM2; in-API jobs need `RUN_JOBS_IN_API=true`; sync skips without `BOKUN_ACCESS_KEY/SECRET_KEY`. Same jobs expire unpaid `PENDING_PAYMENT` bookings. | `backend/src/jobs/in-process.ts`, `jobs/tasks.ts`, `server.ts:44`; AWS PM2 list in the deploy log shows only two processes | **Critical** | No online bookings (every product falls to "Dates on request"); unpaid bookings keep seats | **Open — configuration.** Set `RUN_JOBS_IN_API=true` + Bókun keys on the AWS backend, restart with `--update-env`. *AWS `.env` Not verified.* |
| F-2 | Booking rules | No server-side time check: `/api/tours` listed every ACTIVE departure (including past ones); holds and bookings did not check the departure time. | `tour.repository.ts` (no date filter), `reservation.repository.ts`, `booking.repository.ts` | **High** | Guests could pay for a departure that already left | **Fixed** — `modules/departures/booking-window.ts`, `BOOKING_CUTOFF_MINUTES` (default 60). Tests `booking-window.test.ts`; HTTP check on the test stack. |
| F-3 | Affiliates | Commission counted on PENDING_PAYMENT and REFUNDED bookings (only CANCELLED excluded). | `affiliate.repository.ts` `getAffiliateDashboard` | **High** | Over-stated partner earnings; disputes | **Fixed**; test added. |
| F-4 | Affiliates | Self-referral credited (partner booking through own link). | `booking.repository.ts` used `findActiveAffiliateByCode` only | **Medium** | Commission abuse | **Fixed** (`referringAffiliateId`); test added. |
| F-5 | Brand | Header/menu emblem SVGs missing the far hind leg (vector masters lack it). | `backend/media/brand/emblem-*.svg`; official raster `horse-emblem-gold.png` has it | **Medium** | Brand quality | **Fixed** (traced from the raster, verified overlay; rasters already correct). |
| F-6 | Messaging | Pickup time fell back to `departureTime.toISOString()` → guests' WhatsApp read "1970-01-01T09:00:00.000Z"; AI tool and tracking API had the same fallback. | `whatsapp.provider.ts:308`, `ai.tools.ts:143`, `tracking.provider.ts:285`; observed in `whatsapp-t60` test output | **Medium** | Confusing guest message | **Fixed** (`formatTimeOfDay`; `pickupTime` added to the API date replacer); test added; output now "09:00". |
| S-1 | Auth | Staff role is read from the JWT (7-day expiry) without a database check; a demoted/disabled staff member keeps access until the token expires. Logout clears the cookie but does not revoke the token. | `lib/auth/admin-guard.ts`, `lib/auth/auth.ts` | **High** | Former staff could keep admin access up to 7 days | Open (P0): re-read role/active flag from DB in `getAuthenticatedStaff` (cache 60 s) or add a token version. |
| S-2 | Secrets | `JWT_SECRET` ≥ 32 chars enforced at start; `DATABASE_URL` required. Booking links (voucher, check-in, review) are signed with `VOUCHER_SECRET`, **falling back to `JWT_SECRET`** when unset; Stripe keys are checked at use. | `server.ts:16-37`, `lib/security/signed-links.ts:10` | Low | One leaked secret would cover both sessions and booking links | Set a separate `VOUCHER_SECRET` in production and require it at start-up when `NODE_ENV=production` (P0, small). |
| S-3 | CSRF / headers | State-changing requests from foreign origins refused; helmet CSP/HSTS; cookies httpOnly + SameSite=Lax + Secure in production. | `app.ts:43-90`, `auth.routes.ts:15-18` | – | – | Good. |
| S-4 | Holds | Hold token = timestamp + `Math.random` (not cryptographic); `GET /api/reservations/hold` returns guest name/email to any token holder. | `reservation.repository.ts:30`, `getHoldStatus` | **Medium** | Guessing is impractical but the token isn't secret-grade | Open (P1): `crypto.randomBytes(24)`; drop email from the GET response. |
| S-5 | Rate limits | Present on login, register, booking, holds, quotes, enquiries, reviews, concierge; none on `GET/DELETE /api/reservations/hold`, `GET /api/tours/search`. | route files | Low | Scraping/abuse | Open (P2). |
| S-6 | Reviews | A review is accepted with booking reference + booking email (besides session or signed link); booking must be COMPLETED. | `reviews.routes.ts:45-52` | Low | Fake review by someone who knows both | Open (P2): require session or signed link. |
| S-7 | Payments | Stripe webhook signature verified on the raw body; handlers idempotent; PaymentIntent idempotency key per booking; amounts computed server-side. | `webhooks.routes.ts`, `payment.provider.ts:72`, `booking-pricing.ts` | – | – | **Verified** in tests with test signatures; **live Stripe Not verified**. |
| S-8 | Concierge | Public streaming endpoint calls the Anthropic API; rate-limited; booking data only after an email check. | `concierge.routes.ts`, `lib/ai/*` | Medium | API cost abuse | Partially mitigated. Add a daily budget/IP cap (P2). |
| S-9 | Tax | No sales tax is added to bookings (explicit in code). | `booking.repository.ts` header comment, `booking-pricing.ts` | – (business) | Possible GST obligation | **Owner/accountant decision**; code change is small once decided. |
| O-1 | Admin UI | Bookings list/edit, enquiries, staff roles, audit log exist as staff APIs with **no screens**. | `admin.routes.ts`; no frontend caller | Medium | Staff can't use them | Open (P2). |
| O-2 | Promo codes | Static env list; code and discount **not stored** on bookings; no limits/expiry. | `booking-pricing.ts`, `Booking` model | Medium | No usage reporting, no per-code control | Open (P3). |
| O-3 | Catalogue | Products come from the seed (`prisma/catalog/*.json`); no admin editor; re-seeding refuses once bookings exist. | `prisma/seed.*` | Medium | Content changes need a developer | Open (P2). |
| O-4 | Backups | Render had managed PostgreSQL backups; **AWS database/backups unknown**. | runbook vs AWS | **Critical if absent** | Data loss | *Not verified* — confirm RDS automated backups / snapshots and a restore test (P0). |
| O-5 | Redis on AWS | Rate limits, cache and BullMQ need `REDIS_URL`; behaviour on AWS unknown. | `lib/cache`, rate-limit middleware | High if absent | Rate limits ineffective | *Not verified* (check `/api/health` → `checks.cache`). |
| O-6 | Media/CDN | `frontend/public/media` (971 MB, 391 files committed) is served by Next before the `/media` rewrite; CloudFront is used for clips/posters when `NEXT_PUBLIC_MEDIA_CDN_URL` is set (PR #24). | `next.config.mjs`, `lib/media.ts` | Low | Repo size; EC2 bandwidth for images | CDN URLs *Not verified* from here. Long term: serve images from the CDN with an image loader and drop `public/media` from git. |
| O-7 | Deploy | Deploy workflow builds before touching the server, swaps builds, health-checks, rolls back. Does not wait for CI. | `.github/workflows/deploy-aws.yml` | Low | Untested code could deploy if it builds | Gate on CI (`workflow_run`) when convenient. |

## Feature status by area

| Area | Status | Notes / evidence |
|---|---|---|
| Public site, catalogue, search, destinations | **Verified working** (test stack) | Pages 200; `routes`, `search-pickup` tests |
| Customer calendar, departures, availability | **Verified working** on the test stack; **Broken in production** until F-1 is configured | `booking-window`, `live-capacity`, browser run |
| Price calculation (adult/child/vehicle, add-ons, promo) | **Verified working** (server re-prices) | `payments-flow`, `domain` tests |
| Reservation holds, expiry, capacity (shared + private vehicle) | **Verified working** | `booking-engine`, `live-capacity`, `private-vehicle`, HTTP hold/release |
| Booking creation, duplicate protection | **Verified working** (mock payment); idempotent webhook + PaymentIntent key | tests; live Stripe *Not verified* |
| Cancellation + refund (72 h policy) | **Verified working** in code/tests (mock provider) | `customer-portal`; live refunds *Not verified* |
| Bókun availability sync / booking push | **Verified** with mocked Bókun responses; **live Not verified** | `availability-sync`, `bokun-booking`, `bokun-sync` |
| Enquiries | **Verified working** (saved); email *Not verified* | `enquiries` |
| Email (confirmations, password reset, reviews) | **Not verified** (Resend credentials) | console provider in tests |
| Accounts, login, password reset | **Verified working** | `foundation`, `security-hardening` |
| Staff dispatch, check-in, operations runs, tracking | **Verified working** | `admin-dispatch`, `operations-dispatch`, `live-tracking`, `tracking-privacy` |
| WhatsApp T-60 | **Verified** with the console provider (now formats pickup time) | `whatsapp-t60`; live provider *Not verified* |
| AI concierge | **Verified** with mocked model calls | `ai-*`, `concierge-*`; live Anthropic *Not verified* |
| Partner programme (Model A) | **Partially working** (now correct commission + no self-referral) | `affiliates` (6 tests) |
| Admin back-office | **Partially working** / **API only** | O-1 |
| Reports | **Partially working** (`/admin` metrics only) | see requirements matrix |
| Media delivery (images from Next, clips via CloudFront when enabled) | **Partially working**; CDN *Not verified* | O-6 |

## Recommendations (ordered)

1. Configure F-1 on AWS and confirm departures appear (minutes, no deploy needed beyond restarting the backend with the new env).
2. Confirm database backups (O-4) and Redis (O-5); fix S-1.
3. Deploy this branch (cutoff, affiliate fixes, logo, pickup-time fix).
4. Then follow `docs/BACKEND_IMPLEMENTATION_ROADMAP.md`.
