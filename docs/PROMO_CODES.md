# Promo codes

Guests type a code on the checkout's **Review & pay** step and press **Apply**. A valid code shows
"Code SUMMER10 applied: 10% off. You save CAD 44.00." and the summary and the payment use the
discounted total. The server prices every booking again, so the browser can't change the discount.

## Creating codes (Admin → Promo codes)

`/admin/promo-codes`. Admins create, edit, turn off and delete codes; operators can see them.

- **Code**: 3–40 letters, numbers, `-` or `_`. Not case-sensitive (`summer10` = `SUMMER10`).
- **Discount**: percent off (1–100) or a CAD amount off per booking. It comes off the tour fare only,
  never off the airport transfer; a fixed amount never takes the fare below 0. A 100% code makes a
  free booking that is confirmed without payment.
- **First day / Last day** (optional): Banff time, the whole last day included. The day the guest
  books counts, not the tour date.
- **Use limit** (optional): bookings made with the code. Unpaid bookings that expire and cancelled
  or refunded bookings give their use back. Two guests can't both take the last use.
- **On/Off**: turned-off codes are refused at once.

Every change is in the audit log. Deleting a code doesn't change bookings already made with it
(the code and discount are kept in `Booking.priceSnapshot.promo`).

## Codes from the server setting

`PROMO_CODES` in `backend/.env` (`"CODE:percent,CODE:percent"`) still works and is listed read-only
on the same screen. A code created in Admin with the same name wins, so staff can turn one off
without editing the server. `TESTVISTA100` (100% off) works only when `NODE_ENV` isn't `production`.

## What a guest sees when a code fails

"Invalid or expired promo code", "This promo code has expired.", "…isn't active yet.", "…is no
longer active." or "…has already been fully used." If a code stops working between Apply and
Complete booking, the booking is refused with that message (the guest removes the code and books
at full price), never charged a different amount than shown.

Partner (affiliate) voucher codes typed in the same box are accepted and credit the partner, but
take nothing off.

## Bókun

Bookings with a code go to Bókun as before; the confirmation sends the amount actually paid, so
Bókun may show the discount as an open balance. Promo codes made in Bókun itself are not read by
the site: create the same code here.

Code: `backend/src/modules/pricing/promo-codes.ts` (lookup), `backend/src/modules/admin/promo-admin.ts`
(admin), `backend/src/routes/pricing.routes.ts` (`POST /api/pricing/quote`), migration `9i_promo_codes`.
