# Booking flow and requirements matrix

Part 1 traces the customer booking flow end to end and explains why production shows "Dates on request". Part 2 maps every item of *List of features needed for booking software.docx* to the codebase.

Status vocabulary (used in every audit document):

| Status | Meaning |
|---|---|
| **Verified working** | Exercised in this audit against the real backend (test database) or by the automated test suite, with the result observed. |
| **Partially working** | Real code path exists and works for part of the requirement; gaps listed. |
| **UI only / mocked** | Screen exists but has no real backend behaviour, or the backend returns placeholder data. |
| **API only** | Backend endpoint exists and is tested, but no screen uses it. |
| **Missing** | No code. |
| **Broken** | Code exists and fails. |
| **Not verified** | Could not be exercised from the audit environment (production server, third-party credentials). |

Audit environment: a clone of `main` (`578ffdb`) in an isolated container with PostgreSQL 16 + Redis, the backend on `:4000` against a seeded **test** database, and a production build of the frontend on `:3000`. The production server, Bókun, Stripe, Resend, CloudFront and `vistachase-frontend.onrender.com` were **not reachable** from it (network policy), so anything depending on them is *Not verified*.

---

## Part 1 — Customer booking flow

### Why production shows "Dates on request"

The product page's booking panel (`frontend/src/components/tours/TourDetailView.tsx`) has three branches:

| Branch | Condition | What shows |
|---|---|---|
| Enquiry | `tour.bookingMode === "ENQUIRY"` (custom private tours, multi-day) | Vehicle picker + "Request this tour" → `/contact-us` |
| **No departures** | `tour.departures.length === 0` | Guest count + **"Request your date"** + "Dates on request" + AI concierge — the panel in the screenshots |
| Calendar | departures exist | Calendar → times → party → estimate → **Book now** → `/book` checkout |

The calendar was **not removed**: the code is intact and works (verified below). Production falls into the second branch because `/api/tours` returns tours **without departures**. Departures are created only by the Bókun availability sync (`backend/src/modules/bokun/availability-sync.ts`), which runs:

- in the separate worker process (`backend/src/worker.ts`, BullMQ on Redis) — **the AWS PM2 setup has no worker** (only `vistachase-frontend` and `vistachase-backend`); or
- inside the API when `RUN_JOBS_IN_API=true` (`backend/src/jobs/in-process.ts`);
- and in both cases it returns `{ skipped: "Bókun keys are not set" }` unless `BOKUN_ACCESS_KEY` and `BOKUN_SECRET_KEY` are set (`backend/src/jobs/tasks.ts`).

The old Render backend ran the sync successfully (its log: `bokun-availability done {"products":10,"created":13,"updated":610,…}`). Unless the AWS backend `.env` has `RUN_JOBS_IN_API=true` **and** the Bókun keys, no departures are ever created there. This is configuration, not code — see the fix in *Restoring the calendar in production* below. *(The AWS `.env` itself could not be inspected from the audit environment: **Not verified**.)*

### Step-by-step trace

| # | Step | Frontend | API | Server rules | Data | Status |
|---|---|---|---|---|---|---|
| 1 | Product page | `app/[slug]/page.tsx` → `TourDetailView` | `GET /api/tours/:slug` | Only ACTIVE departures from today, past the booking cutoff removed (**this branch**) | `Tour`, `TourDeparture` | **Verified working** (test stack: 11 departures listed; a past departure inserted via SQL was not listed) |
| 2 | Live price | price block + per-departure line | same | Prices are the departure's (from Bókun), dollars in the API, cents in the DB; struck "original" price is a display markup (`frontend/src/lib/pricing.ts`) | `TourDeparture.price/childPrice` | **Verified working** |
| 3 | Date / calendar | `DepartureCalendar` | same | Only bookable days selectable; sold-out days struck through | | **Verified working** (8 selectable days; selecting a day switched the departure) |
| 4 | Adults / children | Adults + Children steppers (**this branch**, per-guest departures); one guest count for private vehicles | – | Total capped by seats left; children at the child fare when the departure has one | | **Verified working** (3 adults + 1 child → $597 + $199 = $796) |
| 5 | Departure time | time chips under the calendar when a day has several | – | | | Present in code; **not exercised** (fixtures have one time per day) |
| 6 | Capacity validation | – | `POST /api/reservations/hold`, `POST /api/bookings` | In a DB transaction: status ACTIVE, **booking cutoff (this branch)**, party size, seats = total − booked − live holds; private = whole vehicle | `ReservationHold`, `TourDeparture.capacity*` | **Verified working** (test suite `booking-engine`, `live-capacity`, `private-vehicle`, `booking-window`; HTTP: past departure refused, future departure held and released) |
| 7 | Guest / contact details | `/book` step 2 (`BookingCheckoutClient`) | hold placed on "Continue" | Zod validation | | **Verified working** to the hold (checkout opened with "3 adults, 1 child" pre-filled) |
| 8 | Summary, fees, total | `/book` step 4 | `POST /api/pricing/quote` | Server re-prices (`modules/pricing/booking-pricing.ts`): fare × adults + child fare × children, add-ons, promo. **No sales tax is added** (deliberate in code; GST treatment is a business/legal decision) | | **Verified** in tests (`payments-flow`, `domain`); UI not driven to payment |
| 9 | Confirmation | voucher page, email | `POST /api/bookings` → Stripe → webhook | Booking `PENDING_PAYMENT` → `CONFIRMED` on `payment_intent.succeeded`; Bókun reserve/confirm; voucher with signed QR | `Booking`, `Payment` | **Verified with the mock payment provider** in tests; **Stripe, Bókun and email Not verified** (no credentials in the audit environment) |
| – | Enquiry products | `EnquiryPanel` → `/contact-us` | `POST /api/enquiries` | Server refuses to *book* ENQUIRY products (`createBooking`) | `Enquiry` | **Verified** in tests (`enquiries`); email delivery Not verified |
| – | No dates yet | "Request your date" + concierge | `POST /api/enquiries` | No fake availability is shown | | Working as designed; becomes the calendar once departures sync |

### Changes made on this branch (booking)

1. **Server-side booking cutoff** — `backend/src/modules/departures/booking-window.ts`. A hold or booking for a departure that has left, or is within `BOOKING_CUTOFF_MINUTES` (default **60**) of leaving, is refused with a clear message; such departures are not listed. Before this change a past departure (still ACTIVE in the database) could be held and booked, because `/api/tours` returned every ACTIVE departure with no date filter and neither `createReservationHold` nor `createBooking` checked the time. Applied in `reservation.repository.ts`, `booking.repository.ts`, `tour.repository.ts`. Tests: `backend/tests/booking-window.test.ts`.
2. **Adults and children on the product page** — `TourDetailView.tsx` (steppers, estimate lines), `app/book/page.tsx` + `BookingCheckoutClient.tsx` (`?adults=&children=` pre-fill; `?guests=` still works for existing links and the AI concierge). The server still re-prices at checkout.
3. Infants are chosen at checkout (free, no seat), as before.

### Restoring the calendar in production (configuration)

On the server, in `backend/.env` (never commit it):

```
RUN_JOBS_IN_API=true            # no separate worker on AWS; the API runs the 5-min hold expiry and 15-min Bókun sync
BOKUN_ACCESS_KEY=…              # from Bókun → Settings → API keys
BOKUN_SECRET_KEY=…
BOKUN_API_URL=https://api.bokun.io
BOOKING_CUTOFF_MINUTES=60       # optional; online booking closes this long before departure
```

Then `pm2 restart vistachase-backend --update-env`. Within ~10 s the log should show `[jobs] bokun-availability done {"products":…,"created":…}`; staff can also press **Sync with Bókun** on `/admin/operations`. Verify with `curl -s http://127.0.0.1:4000/api/tours/banff-highlights-tour | grep -c departureTime` (> 0). Products also need their Bókun IDs in `backend/prisma/catalog/product-map.json` (`bokunReadiness()` lists any that are missing). Do **not** run a separate worker *and* `RUN_JOBS_IN_API=true` together.

---

## Part 2 — Requirements matrix (*List of features needed for booking software.docx*)

Columns: **Where** = frontend page / backend endpoint / data model. **Perm** = who should use it. **Tests** = automated coverage today.

### Booking

| Feature | Status | Where (evidence) | Perm | Tests | Gap / next step |
|---|---|---|---|---|---|
| Quick Book | **Missing** | No staff booking screen. `POST /api/bookings` is the customer endpoint (could be reused with a staff "book on behalf" flag). | OPERATOR+ | – | Staff form: product → departure → party → guest → pay link or mark paid (needs an approval rule for "paid offline"). Roadmap P2. |
| Sales Feed | **Partially working** | `/admin` shows the 8 latest bookings (`GET /api/admin/metrics`); `GET /api/admin/bookings` exists (**API only**). | staff | `admin-api` | Paginated feed screen with filters (date, product, status, partner). P5. |
| Calendar | **Verified working** (customer) / **Missing** (staff) | `DepartureCalendar`, `GET /api/tours/:slug` | public / staff | `booking-window`, `live-capacity` | Staff calendar across products with seats and close-out actions. P2. |
| Daily Departures | **Partially working** | `/admin/dispatch` (`GET /api/admin/dispatch?date=`), `/admin/operations` runs | DISPATCHER+ | `admin-dispatch`, `operations-dispatch` | Combine into one day view per departure (seats, guests, pickups, vehicle, guide). P2. |

### Experiences / Products

| Feature | Status | Where | Perm | Tests | Gap |
|---|---|---|---|---|---|
| Experiences overview | **Partially working** | Public catalogue (`/api/tours`); content imported from `prisma/catalog/*.json` by the seed. **No admin product editor.** | ADMIN | `routes`, `search-pickup` | Admin list/edit of products (text, images, booking mode, visibility). P1/P2. |
| Price Schedules | **Partially working** | Per-departure adult/child/vehicle prices synced from Bókun; promo codes from `PROMO_CODES` env. No local price-schedule model. | ADMIN | `availability-sync`, `payments-flow` | Decide the source of truth (recommended: **Bókun**, the site mirrors it). Local schedules only for non-Bókun products. P1. |
| Resource Management | **Partially working** | `Vehicle`, `Driver`, `OperationRun`; `/api/operations/fleet`, `/drivers`; assign vehicle/driver to a run. Departure capacity is not derived from assigned vehicles. | OPERATOR+ | `operations-dispatch`, `admin-dispatch` | Link resources to departures; warn when bookings exceed assigned seats. P2. |

### Sales Tools

| Feature | Status | Where | Perm | Tests | Gap |
|---|---|---|---|---|---|
| OTAs | **Missing** (external) | None in this codebase. Bókun's channel manager distributes to OTAs (Viator, GetYourGuide, Expedia…). | ADMIN | – | Configure in Bókun; the site keeps reading availability from Bókun. Needs OTA contracts. P4 (third-party). |
| Google Things to Do | **Missing** (external) | None. Google lists bookable experiences through approved connectivity partners (booking systems), subject to Google's eligibility rules. | ADMIN | – | Ask Bókun whether it can connect your products to Google Things to Do for your account; otherwise choose an approved partner. Product pages already carry `TouristTrip` JSON-LD. P4 (third-party approval). |
| Online portal for third-party sellers / affiliate websites | **Partially working** | `/partners` (apply), `/partners/login`, `/partners/dashboard` (`GET /api/affiliates/me`), referral cookie `vc_ref`. Model A only. | AFFILIATE | `affiliates` (6) | Click tracking, campaigns, materials, reseller booking on behalf (Model C). See `AFFILIATE_PLATFORM_DESIGN.md`. P3. |
| Your Resellers | **Partially working** | `/admin/partners` (approve/suspend, commission rate; `PATCH /api/affiliates/admin/:id`) | ADMIN | `affiliates` | Contracts, net rates, payout status. P3. |
| PromoCode generation | **Missing** | Codes are a static env list (`PROMO_CODES`); the code used is **not stored on the booking**. | ADMIN | `payments-flow` (promo pricing) | `PromoCode` table (percent/fixed, validity, limits, product scope, partner), store `promoCodeId` + `discountAmount` on `Booking`. P3. |

### Market Platforms

| Feature | Status | Gap |
|---|---|---|
| My Contracts | **Missing** | `ResellerContract` model + screens (P3). |
| Contract Terms | **Missing** | Terms per contract: products, net rate / commission, payment terms, cancellation terms, validity (P3). |
| Conversations | **Missing** | Message thread per partner/contract with audit trail; email notification (P3/P5). |

### Operations

| Feature | Status | Where | Tests | Gap |
|---|---|---|---|---|
| Passenger list | **Partially working** | Dispatch manifest (`GET /api/admin/dispatch`), run manifest (`GET /api/operations/runs/:id`), check-in | `admin-dispatch`, `operations-dispatch` | Printable/CSV export per departure. P2. |
| Pick-up list | **Partially working** | Manifest carries pickup stop/time; `POST /api/operations/runs/:id/optimize-pickups` | `operations-dispatch` | Pickup-ordered sheet for drivers. P2. |
| Customers | **Partially working** | `User` table; bookings by email (`/api/account/trips`); **no staff customer list** | `customer-portal` | Staff customer search with booking history. P2. |
| Close-outs | **Missing** | Only `POST /api/admin/departures/capacity` (API only). A Bókun sync would overwrite local changes. | – | Close-outs belong in **Bókun** (source of truth); the site already marks unavailable Bókun dates CANCELLED on sync. Optional local "stop sale" flag for non-Bókun products. P2. |
| Resource Overview | **Partially working** | `/admin/operations` (fleet, drivers, runs) | `operations-dispatch` | Utilisation per day. P5. |

### Reports

| Feature | Status | Where | Gap |
|---|---|---|---|
| Sales Overview | **Partially working** | `/admin` metrics: counts, revenue from succeeded payments, recent bookings | Date range, by product/channel/partner. P5. |
| Income Statement | **Missing** | – | Needs refunds, fees, commissions per period; accounting export. P5. |
| Experience / Product Sales | **Missing** | – (data exists in `Booking` + `TourDeparture`) | Aggregation endpoint + screen. P5. |
| Custom Reports | **Missing** | – | CSV export with chosen columns/filters first; a builder later. P5. |
| PromoCode Usage | **Missing** | – (code not persisted) | Depends on the `PromoCode` model (P3). P5. |

### Settings

The requirement is to keep the reference platform's settings *except Subscription and Legacy Content*. This application has **no settings module**: configuration lives in environment variables (`backend/.env.example`), staff roles are managed by `PATCH /api/admin/staff/:id` (API only), and partner settings on `/admin/partners`. Recommended scope (P5): company profile, staff & roles, booking cutoff and hold duration, cancellation policy text, notification recipients, promo codes, partner defaults, integrations status (Bókun, Stripe, Resend — read-only, never showing secrets). Subscription and Legacy Content are **excluded** as specified.
