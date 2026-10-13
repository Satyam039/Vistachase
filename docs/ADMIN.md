# Staff admin: bookings, departures, pickup stops, manifests, audit log, staff

Everything here lives under `/admin` (frontend) and `/api/admin` (backend, `src/routes/admin.routes.ts`).
Every request checks the signed-in person's **current role in the database**, and every change is
written to the audit log with who made it.

| Screen | Who | What |
| --- | --- | --- |
| Bookings → Bookings | all staff (actions: Admin, Operator) | Search, booking detail with payments, flags and history; edit notes; resend voucher; **cancel** with a refund decision |
| Bookings → Flags | all staff (actions: Admin, Operator; Mark refunded: Admin) | Payments that didn't match or came late, refunds owed, Quick Book payments due |
| Bookings → Quick Book | Admin, Operator | Book a departure for a guest on the phone or at the desk |
| Departures | all staff (changes: Admin, Operator) | List, add many dates at once, edit seats and prices, take off sale, manifest |
| Departures → Manifest | all staff | Printable passenger list per departure, CSV download |
| Pickup stops | all staff (changes: Admin, Operator) | Add, edit, turn stops on and off |
| Audit log | Admin | Every recorded action, filterable, paged |
| Staff | Admin | Give or remove staff roles |

## Roles take effect at once

`getAuthenticatedStaff` (`src/lib/auth/admin-guard.ts`) reads the role from the database on every
request instead of trusting the role inside the 7-day sign-in token. Removing someone's staff role
(Staff → "Remove staff access") or deleting the account ends their access on their next request;
they don't need to be signed out. `/api/auth/me` also returns the database role.

## Cancelling and refunds

Staff can cancel a pending, confirmed or unsynced booking at any time (the guest's own 72-hour limit
doesn't apply). The seats go back on sale at once, exactly as for a guest cancellation.

Refund choice:

- **Policy**: full refund for 1–6 guests; the 20% deposit is kept for 7+ guests and multi-day trips.
- **Full**: everything paid.
- **None**: nothing (no-show, or money kept by agreement).

With `STAFF_REFUNDS_VIA_PROVIDER` unset or `false` (the default while payments are not live), **no
money is sent**: the refund is recorded as a **Refund owed** flag. Staff send the money by hand
(e-transfer, card terminal, Stripe dashboard) and press **Mark refunded** with its reference; the
booking becomes REFUNDED and any partner commission is reversed for that amount, once.

With `STAFF_REFUNDS_VIA_PROVIDER=true`, online payments are refunded through the payment provider
(as the guest self-cancel does); whatever couldn't be refunded that way (offline payments, failures)
is still recorded as owed. A cancellation with no refund leaves partner commission as it is.

## Quick Book

Books a LOCAL, active departure for a guest with the server's price (same pricing, seat checks and
party limits as the website; staff may book after online booking closes, up to departure time).

- **Cash, e-transfer, card terminal, other**: an offline payment (provider `offline`) is recorded
  and the booking is confirmed with the usual confirmation email (optional).
- **Not paid yet**: the booking is confirmed without payment, a **Payment due** flag is raised and
  the guest's email shows the amount due. **Record payment** on the flag records it later. Cancelling
  the booking closes the flag.

Quick Book never calls Stripe. Each form carries an idempotency key, so a double submit makes one
booking.

## Flags

`BookingFlag` rows (migration `6_admin_controls`). Raised by the system when a payment's amount
doesn't match the booking (PAYMENT_AMOUNT_MISMATCH) or money arrives after the booking expired or was
cancelled (LATE_PAYMENT), and by staff actions (REFUND_DUE, PAYMENT_DUE). The migration copies the
flags recorded before it (audit log rows) as open flags. Mismatch and late-payment flags are closed
with **Resolve** and a note of what was done (refunded in Stripe, rebooked, …).

## Departures

- **Add**: a tour or shuttle route, a date range with weekdays, one or more times, seats, price
  (per guest, or per vehicle for private tours) and child price. New departures are LOCAL (sold
  online). Ones that already exist are skipped, never changed.
- **Edit**: seats (never below booked + held), price, child price, return time. Existing bookings
  keep the price they were sold at (`priceSnapshot`). The date and time can't change: take the
  departure off sale and add a new one.
- **Take off sale** (CANCELLED) only when it has no active bookings or seat holds: cancel or move
  the bookings first. Departures are never deleted, so the deploy's schedule seed
  (`scripts/seed-departures.ts`, insert-missing only) never adds a cancelled one back.

## Pickup stops

Turned-off stops disappear from the checkout and the AI concierge's stop list. Stops are never
deleted (bookings point to them). The deploy's pickup seed adds a listed stop only when no stop has
its name or its address, so keep the address when renaming a seeded stop. The public pickup finder
page still reads its fixed list in `src/lib/maps/maps.provider.ts`.

## Manifests

`GET /api/admin/departures/:id/manifest` (JSON for the printable page, `?format=csv` for a
spreadsheet). Travelling bookings only (confirmed, unsynced, completed), in pickup order, with
contact, party, pickup, add-ons, requests, payment due and boarded. Viewing and exporting are
audited because manifests carry guest contact details. CSV cells that a spreadsheet would run as a
formula are prefixed with `'`.

## Audit log

`GET /api/admin/audit-logs`: filters for action, record type and id, person (or "system"), booking
reference and Mountain Time dates; 100 rows a page, newest first (`before` = last id shown).

## Migration safety

- **Before a deploy restarts the API**, `scripts/backup-before-migrate.js` checks for migrations not
  yet applied. If there are any, it saves `pg_dump --format=custom` to
  `~/backups/pre-migrate-<time>-<migrations>.dump` (`BACKUP_DIR`), keeps the newest 10
  (`MIGRATION_BACKUPS_KEEP`), and **stops the deploy before anything is built or restarted if the
  backup fails** (the live site keeps the previous release). The server needs `pg_dump`
  (`sudo apt install postgresql-client`, same major version as the database or newer).
  `MIGRATE_WITHOUT_BACKUP=true` in `backend/.env` skips it on purpose.
- Restore: `pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" <file>` (stop the API first).
- **CI** runs `scripts/check-migrations.js`: a migration that drops, renames, truncates, deletes rows,
  changes a column type or makes a column required fails the build unless the file carries
  `-- migration-safety: allow <reason>`. CI also checks that the migrations match `schema.prisma`.
- Applied migrations are never edited (Prisma checksums them).
