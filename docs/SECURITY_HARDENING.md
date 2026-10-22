# Security hardening (P0 items from the 14 and 17 October audits)

Migration `9b_auth_hardening` is additive: one nullable column (`User.sessionsValidAfter`) and three
indexes on `Booking`. Rollback: revert the code; the old release ignores the column. To drop it:
`ALTER TABLE "User" DROP COLUMN "sessionsValidAfter"; DROP INDEX "Booking_customerId_idx", "Booking_tourDepartureId_status_idx", "Booking_status_paymentExpiresAt_idx";`

## Who owns a booking

`ownsBooking()` in `backend/src/lib/auth/admin-guard.ts` is the one rule, used by My trips, the
voucher page, cancel and reviews. A signed-in account owns a booking when:

- it made the booking while signed in (`Booking.customerId`), or
- the booking was made with the account's email **and that email is verified**.

An unverified email proves nothing: anyone can register with someone else's address.

## Email verification

- Registering sends "Confirm your Vista Chase email" with a one-time link to `/verify-email?token=…`
  (only the SHA-256 hash is stored in `User.verificationToken`).
- `POST /api/auth/verify-email {token}` marks the email verified and links guest bookings made with
  it. `POST /api/auth/resend-verification` (signed in) sends a fresh link; My trips shows a banner
  with a "Send confirmation link" button while the email is unverified.
- A password reset also verifies the email (the link reached the inbox).
- Signing in no longer links bookings by email unless the email is verified.

**Needs real email** (`EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`). Until then the
links are only written to the server log (with the token redacted), so customers can't verify.
Bookings they make while signed in still show under My trips.

## Sessions

`User.sessionsValidAfter`: sign-ins (JWTs) issued before it are refused on every database-checked
request (`getSessionUser`, which the staff guard, My trips, voucher, cancel, reviews and `/me` use).
It is set when:

- a password is reset (every earlier sign-in ends), and
- an **unverified** account is made staff (below).

## Staff accounts

Making an existing customer account staff (`POST /api/admin/staff` or `PATCH /api/admin/staff/:id`)
when its email was never verified now replaces its password, ends its sign-ins and issues the same
one-time "choose your password" link as a new invite (emailed when email is set up, and shown once to
the admin). Someone who registered a future staff member's email can no longer inherit staff access.
Verified accounts keep their password.

## Guest cancel

`POST /api/bookings/cancel` accepts only the signed-in owner or the voucher link's signed token
(`t`). The booking email alone is refused (403). If the automatic refund fails, the booking is still
cancelled and a `REFUND_DUE` flag ("Refund owed") is raised for staff, who close it with
**Mark refunded**. The guest's email says the refund will follow.

## Stripe refunds (webhook)

Subscribe the endpoint to `charge.refunded`, `refund.created`, `refund.updated` and
`charge.refund.updated` (Stripe dashboard → Developers → Webhooks).

- Partner commission is reversed per refund id (refunds are fetched from Stripe when the event
  doesn't list them, as newer API versions don't).
- A fully refunded charge marks the payment `REFUNDED`; a partial refund leaves it `SUCCEEDED`.
- A cancelled booking whose payment is fully refunded moves to `REFUNDED`.
- A refund on a booking that is still active (usually one made in the dashboard) raises one flag
  for staff per refunded total.

## Email

- The console email log redacts every link token (`?t=`, `?token=`, `&sig=` and hex runs of 32+).
- `EMAIL_PROVIDER=ses` used to report sends that never happened. It now fails loudly and doesn't
  count as configured. Use Resend.
