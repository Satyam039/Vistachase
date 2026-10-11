# Booking engine (first-party)

Vista Chase bookings, seat holds and seat counts live only in this site's PostgreSQL database. No external booking system is called when a guest holds seats, books, pays or cancels. The Bókun API integration was removed on 2026-10-10 (PR #26); its data fields are kept for a future sync (section 5).

## 1. How a booking is saved

1. **Departure.** The tour page lists only departures whose seats this site may sell (`inventorySource = LOCAL`, active, not past the booking cutoff). `GET /api/departures/checkout` also returns `bookable` and `notBookableReason`.
2. **Hold** (`POST /api/reservations/hold`, when the guest leaves the Contact step). First, seats from this departure's expired holds and unpaid bookings are freed (`freeExpiredSeats`). Then one transaction refuses enquiry-only tours, departures that aren't sellable, closed or cancelled ones, and bad party sizes, and runs one conditional `UPDATE` that holds the seats only if they are still free. The hold lasts 10 minutes. Its token is random (128 bits).
3. **Booking** (`POST /api/bookings`, optional `Idempotency-Key` header). The request is validated with zod. A key seen before returns the booking already made. Otherwise one transaction re-checks the departure, claims the hold once (`ACTIVE → CONVERTED`, linked by `ReservationHold.bookingId`), moves the seats from held to booked with one conditional `UPDATE`, prices the booking on the server, and saves it as `PENDING_PAYMENT` with `priceSnapshot`, `paymentExpiresAt` (30 minutes) and a `BOOKING_CREATED` audit row. Any refusal or database error rolls all of it back.
4. **Payment** starts outside the transaction. If it can't start, the booking is cancelled and its seats released.
5. **Result.**
   - The Stripe webhook (signed) confirms the booking only if the amount and currency Stripe reports match the booking. A mismatch is flagged (`PAYMENT_AMOUNT_MISMATCH` audit row and admin note) and the booking is not confirmed.
   - A failed or cancelled payment moves the booking to `CANCELLED` and frees its seats once.
   - When the payment window passes, the booking moves to `EXPIRED` and frees its seats. This happens lazily on the next hold or booking for that departure, or through the jobs runner.
   - A payment that arrives after the booking expired is recorded as `SUCCEEDED` and flagged (`LATE_PAYMENT`). The seats are not taken back automatically. The nightly reconciliation lists the booking for staff to refund or rebook.

A form submission never confirms a booking by itself. Only a verified payment does: an instant mock payment outside production, a free 100%-promo booking, or the Stripe webhook.

## 2. Statuses

Booking moves allowed (`src/modules/bookings/booking-status.ts`; each one is a conditional update plus an audit row):

| To | From |
|---|---|
| CONFIRMED | PENDING_PAYMENT |
| EXPIRED | PENDING_PAYMENT |
| CANCELLED | PENDING_PAYMENT, CONFIRMED, PAID_UNSYNCED |
| REFUNDED | CANCELLED |
| COMPLETED | CONFIRMED |

Holds: `ACTIVE → CONVERTED | EXPIRED | RELEASED`. Expired and released holds have the guest's name, email and phone cleared.

`paymentStatus` in API responses is derived from the payment rows: `NOT_REQUIRED`, `PENDING`, `PAID`, `FAILED` or `REFUNDED`.

## 3. Seats and inventory

- Only `src/modules/departures/inventory.ts` changes `capacityBooked` and `capacityHeld`, and every change is a single conditional SQL update. The database constraint `TourDeparture_capacity_check` also keeps booked plus held seats between 0 and `capacityTotal`.
- `TourDeparture.inventorySource`:
  - `LOCAL`: entered or confirmed by staff. This database is authoritative, and only these departures are listed and sold.
  - `EXTERNAL`: synced from a provider. Not sold until a sync exists and keeps it fresh.
  - `UNVERIFIED`: seeded or unknown. This is the default for new rows. `scripts/seed-departures.ts` creates only these.
- Staff confirm departures with `POST /api/admin/departures/inventory` (ADMIN or OPERATOR):
  ```json
  { "tourSlug": "banff-highlights-tour", "from": "2026-11-01", "to": "2026-11-30", "inventorySource": "LOCAL" }
  ```
  The same call with `"UNVERIFIED"` takes departures off sale. You can also pick departures with `departureIds`. `GET /api/admin/departures/inventory?tourSlug=…` lists departures with their source.

## 4. Production rollout (manual, needs approval)

The migration `prisma/migrations/3_local_booking_engine` is additive. It adds enums, nullable or defaulted columns, the `BookingSyncTask` table, and the capacity CHECK constraint as `NOT VALID`.

`scripts/start-production.js` runs `prisma migrate deploy` every time the API starts. If PM2 starts `vistachase-backend` through it (`npm start`), **the deploy that follows a merge applies this migration**. Check how PM2 starts the API with `pm2 describe vistachase-backend` and look at "script path" and "script args".

Before merging:

1. Back up the database:
   ```bash
   mkdir -p ~/backups && cd /home/ubuntu/Vistachase/backend && set -a && . ./.env && set +a
   pg_dump -Fc "$DATABASE_URL" > ~/backups/pre-booking-engine-$(date +%F-%H%M).dump && ls -lh ~/backups | tail -1
   ```
2. Run a read-only consistency check. It must return no rows:
   ```sql
   SELECT id, "capacityTotal", "capacityBooked", "capacityHeld" FROM "TourDeparture"
   WHERE "capacityBooked" < 0 OR "capacityHeld" < 0 OR "capacityBooked" + "capacityHeld" > "capacityTotal";
   ```
3. Review the migration SQL, then merge. If PM2 doesn't use `npm start`, run `npx prisma migrate deploy` yourself before restarting.
4. After the deploy, validate the constraint once: `ALTER TABLE "TourDeparture" VALIDATE CONSTRAINT "TourDeparture_capacity_check";`
5. Confirm the real departures with the admin endpoint above. Until then, tours show "Request a date".

Rolling back the code after the migration is safe while no booking has status `EXPIRED`. The previous release doesn't know that value.

Also recommended: set `RUN_JOBS_IN_API=true` (or run the worker) so expiry and the nightly reconciliation run on a schedule. Seat release no longer depends on it.

## 5. Future provider sync (Bókun), not built

What is already in the data model:
- `Booking.bokunBookingId` (unique external reference)
- `Booking.externalSyncStatus` (default `NOT_REQUIRED`)
- `Booking.lastSyncAttemptAt`
- the `BookingSyncTask` outbox: provider, operation, unique idempotency key, status, attempts, `nextAttemptAt`, `lastError`, `externalRef`, payload
- `TourDeparture.inventorySource = EXTERNAL` with `inventoryVerifiedAt`
- `Tour.bokunId`, `Affiliate.bokunChannelId`

Nothing writes sync tasks or sends anything yet. The roadmap, each step to be approved separately:

1. **Contract.** Get Vista Chase's Bókun API access and confirm the supported reservation flow for its products: availability, reserve, confirm, cancel and amend. Confirm rate limits, webhook signing, and a test channel. Nothing is assumed from the removed code.
2. **Mapping and availability.** Map tours and departures to Bókun activity, start-time and rate IDs. An availability pull marks departures `EXTERNAL` with a freshness time. Stale or missing data blocks online booking.
3. **Outbox writer.** In the same transaction that confirms a paid booking, write `BookingSyncTask(CREATE)` with key `BOKUN:<bookingId>:CREATE:1`. Cancellations and amendments write their own versioned tasks, so retries never duplicate.
4. **Dispatcher.** A worker job claims due tasks (`FOR UPDATE SKIP LOCKED`), re-checks availability in Bókun, reserves then confirms, stores `bokunBookingId`, and retries retryable errors with backoff. It runs behind a flag, off by default, against the test channel first.
5. **Inbound events.** Verified Bókun webhooks for cancellations and amendments update the local booking by `bokunBookingId`, idempotently.
6. **Reconciliation.** A nightly comparison of local and Bókun bookings for the coming weeks. Mismatches go to the ops email and are never deleted automatically.
7. **Go-live.** Shadow mode first (tasks built, not sent), then one product, then all.
