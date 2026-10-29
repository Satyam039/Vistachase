# Deposit payments

Guests can pay a 20% deposit at checkout instead of the full price, and pay the rest later. The
rules follow the published payment terms on `/privacy-policy-vista-chase`.

## Rules

| Rule | Value | Where |
| --- | --- | --- |
| Deposit | 20% of the total | `DEPOSIT_PERCENT` |
| Deposit offered when the departure is at least | 15 days away (within 14 days: pay in full) | `DEPOSIT_MIN_DAYS_BEFORE` |
| Balance due | 14 days before departure | `BALANCE_DUE_DAYS_BEFORE` |
| First reminder | 3 days before the balance is due | `BALANCE_REMINDER_DAYS_BEFORE_DUE` |
| Staff flag (PAYMENT_DUE) if still unpaid | 72 hours before departure | `BALANCE_OVERDUE_HOURS_BEFORE` |
| Cancel before the policy deadline | Same as any booking: everything paid, less 20% of the total on a private multi-day package (so a deposit alone is kept there) | `policyDecision` (cancellation-policy.ts) |
| Cancel after the deadline | No refund (same as all bookings) | `cancelBooking` |

Backend constants live in `backend/src/modules/bookings/deposit.ts`; the frontend copy is in
`frontend/src/lib/policy.ts`. Change both together.

A deposit doesn't change the cancellation deadline or the amount kept (policy section 11). The
deadline is 24 hours before departure for shared tours and shuttles and 72 hours for private tours
(before Day 1 for private packages).

## Flow

1. **Checkout.** `POST /api/bookings` with `paymentPlan: "DEPOSIT"`. The booking stores
   `paymentPlan`, `depositAmount` (cents) and `balanceDueAt`, and the PaymentIntent is for the
   deposit only (`metadata.kind = "DEPOSIT"`). The deposit webhook confirms the booking as usual.
   A deposit for a departure under 15 days away is refused with a clear message.
2. **Balance.** The voucher page and My trips show what is owed. "Pay balance" calls
   `POST /api/bookings/pay-balance` (`{ bookingReference, t }` with the voucher token, or a
   signed-in owner, or staff). It resumes an open balance PaymentIntent or creates one with the
   idempotency key `balance-<ref>-<n>` and `metadata.kind = "BALANCE"`. The webhook records it
   (`recordBalancePayment`): sets `balancePaidAt`, closes any PAYMENT_DUE flag, earns partner
   commission on the full total and emails a receipt. A wrong amount or a payment after the
   booking was cancelled raises a staff flag instead.
3. **Reminders.** The `balance-reminders` job (hourly, worker `20 * * * *` or in-process) sends
   stage 1 (3 days before due), stage 2 (due date) and stage 3 (72 hours before departure:
   overdue email plus a PAYMENT_DUE flag for staff). Each stage is claimed atomically so a guest
   never gets the same email twice, and only the latest stage is sent if several are due at once.
   **A booking is never cancelled automatically**: staff decide after calling the guest.
4. **Staff.** Admin "Record payment" on a deposit booking records a BALANCE payment and marks the
   balance paid once the total is covered. Staff policy refunds use the same "everything except
   the deposit" rule.
5. **Cancellation.** The guest's refund comes from the balance payment first, then the deposit
   payment above the deposit amount. A payment is marked REFUNDED only when it is fully refunded.

## Data

Migration `9c_deposit_payments` (additive only): enums `PaymentPlan` and `PaymentKind`; Booking
`paymentPlan` (default FULL), `depositAmount`, `balanceDueAt`, `balancePaidAt`,
`balanceReminderStage`; Payment `kind` (default FULL). Existing bookings are FULL and unchanged.

## Tests

`backend/tests/deposit-payments.test.ts` covers the terms, checkout, amount mismatch, balance
payment (Stripe and mock), My trips, reminders and staff flag, cancellation refunds, and staff
payments.
