# Booking changes (guest requests, staff apply)

Owner, 2026-11-26: a guest who booked 6 and one can't join must be able to ask for it, and the
backend must adjust the passengers, the invoice and any refund. The same flow covers a new date,
the lead guest's name and email, and the names of everyone travelling.

Code: `backend/src/modules/bookings/booking-changes.ts` (tests `backend/tests/booking-changes.test.ts`).

## Guest

Voucher page → **Manage booking** (from the confirmation email, or **Change guests or date** in My Trips):

- Lead name and phone: saved straight away (unchanged, `manage-booking.ts`).
- **Request a change**: number of guests (adults / youth / infants), a new date and preferred time,
  a new email, the names of everyone travelling, a note. `POST /api/bookings/manage/change-request`
  (voucher link token or the signed-in owner, 5 a minute). The older `/manage/change-date` still works.
- Nothing changes yet. The request is an OPEN "Other" flag starting `Change request`, the details are
  in the audit log (`CHANGE_REQUESTED`), the guest gets an email with an estimate of the new total
  at the price they booked, and staff get an alert. One open request per booking.

## Staff

Admin → Requests → **Change requests** → **Review change** (or Manage booking → **Change Guests / Invoice**
for a change asked by phone). Managers only (ADMIN, OPERATOR).

The form previews every edit (`POST /api/admin/bookings/:id/change/preview`) before **Apply**
(`POST /api/admin/bookings/:id/change`). Decline: `POST /api/admin/requests/:flagId/decline-change`.

Apply, in one transaction:

- Seats: the difference on the same departure, or moved to the new departure. A private vehicle stays
  fully booked whatever the party size (size limit still checked). Bókun's own seats are checked and
  the booking is rebooked in Bókun (new booking, then the old one cancelled), as for Change tour date.
- Invoice: per-guest tours use the unit prices the guest booked at (or the new date's prices, if staff
  choose); the discount is kept in proportion (a fixed-amount code stays fixed). Private tours are per
  vehicle, so fewer guests don't change the price. Add-ons stay as booked. The booking's
  `priceSnapshot.changes` keeps every change (from/to totals, who, when).
- Less than paid: refund by **POLICY** (default: the difference back if the guest asked before the
  deadline, 24 h shared/shuttle, 72 h private; nothing after), **FULL** or **NONE**. Money kept is
  added to the total as "non-refundable" so paid and total agree. The refund goes through Stripe
  when `STAFF_REFUNDS_VIA_PROVIDER=true` (the payment's amount is lowered; the webhook knows it by
  `metadata.kind = BOOKING_CHANGE` and raises no flag), otherwise a REFUND_DUE flag ("Change refund");
  **Mark refunded** on it lowers what the booking counts as paid and leaves the booking live.
- More than paid: a PAYMENT_DUE flag, and the voucher shows **Still to pay** with **Pay balance**
  (also for bookings paid in full at checkout). A deposit booking's balance simply grows.
- The guest is emailed the updated booking (and the updated PDF ticket when the date moved); an
  email change also notifies the old address.

Multi-day trips: each day is its own booking; change each day.

Partner commission: earned once on the first payment; refunds reverse it in proportion. An extra
payment after a change does not add commission.

## Sign-in lifetime

Owner, 2026-11-26: guests, partners and staff sign in again after 3 days (`SESSION_MAX_DAYS`, 1-30,
in `backend/src/lib/auth/auth.ts`). Cookie and token both end then; tokens issued before the change
for 7 days stop working once they are 3 days old.
