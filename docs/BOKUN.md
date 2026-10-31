# Bókun

The website is the booking system guests use. With Bókun connected, every booking is in both: it is confirmed on the website first, then created in Bókun, and a cancellation on the website cancels it in Bókun too. Bókun's seat counts are read into the website calendar every 15 minutes, so seats sold on Bókun's other channels (Viator, GetYourGuide, agents, the Bókun dashboard) can't be sold again here.

Without the Bókun keys nothing calls Bókun and the site works as before.

## Switch it on

1. In Bókun: **Settings → API keys** → create a key. Copy the access key and the secret key. The key belongs to a booking channel; bookings from the website show under that channel in Bókun.
2. On the server, add to `backend/.env` (never paste the keys in chat or commit them):
   ```
   BOKUN_ACCESS_KEY=...
   BOKUN_SECRET_KEY=...
   BOKUN_API_URL=https://api.bokun.io
   ```
   For a Bókun test account use `BOKUN_API_URL=https://api.bokuntest.com`.
3. Restart the API: `pm2 restart vistachase-backend --update-env`. The Bókun jobs start inside the API even when `RUN_JOBS_IN_API` is off.
4. Open **Admin → Bookings → Bókun**. It should say "Connected". Press **Sync now**, then check **Seat sync**: every website departure should match a Bókun start time.
5. Press **Send upcoming bookings** once to add bookings made before Bókun was connected.

## Test account

A Bókun test account (website.bokuntest.com, `BOKUN_API_URL=https://api.bokuntest.com`) has its own product IDs, so the live IDs in `product-map.json` are refused there with "404 Activity not found". To test:

1. Create the tours as products in the test account (or note the ones it already has).
2. **Admin → Bookings → Bókun → Products → Check products** lists the account's products. Pick the matching one for each website tour and copy the `BOKUN_PRODUCT_OVERRIDES=slug:id,...` line it shows into `backend/.env`.
3. Restart the API (`pm2 restart vistachase-backend --update-env`) and press **Retry** on the stopped bookings.

With a test account, seat sync is off unless `BOKUN_AVAILABILITY_SYNC=true`, so made-up test seats never replace the real calendar's seat counts. Before going live: remove `BOKUN_PRODUCT_OVERRIDES`, set the live keys and `BOKUN_API_URL=https://api.bokun.io`, restart.

Optional settings: `BOKUN_AVAILABILITY_SYNC=false` keeps sending bookings but stops reading seats; `BOKUN_SYNC_DAYS` (default 90) is how far ahead seats are read.

## Products

Each website product is linked to its Bókun product by `bokunId` in `backend/prisma/catalog/product-map.json`. Only products with a Bókun ID and `bookingMode: "BOKUN"` sync. Activity tickets, custom private tours and multi-day requests have no Bókun booking.

Start times must match: a website departure at 08:30 is matched to the Bókun start at 08:30 on the same day. **Seat sync** in the Bókun tab lists website departures Bókun doesn't offer; a booking on one of them can't be created in Bókun and is flagged.

## What happens to a booking

| On the website | In Bókun | Code |
|---|---|---|
| Booking confirmed (paid, free, Quick Book, staff approval) | Reserved for external payment, then confirmed with the amount the guest paid. Bókun's confirmation code is saved on the booking (Admin booking detail → "Bókun"). Bókun doesn't email the guest; the website sends the confirmation. | `src/modules/bokun/bokun-sync.ts`, `bokun-booking.ts` |
| Booking cancelled (guest, staff, approved request) | Cancelled in Bókun without a refund (refunds go through Stripe). If it never reached Bókun, nothing is sent. | same |
| Every 15 minutes | Bókun's seats left and seats booked set our seat counts on matching departures. Prices, times and statuses stay the website's. | `src/modules/bokun/availability-sync.ts` |

The change for Bókun is queued in the same database transaction as the booking's status change (`BookingSyncTask`), sent a moment later, and retried with backoff (1, 5, 15, 60, 180, 360 minutes) if Bókun can't be reached. A Bókun outage never blocks or loses a website booking.

## When something needs a person

A booking stops and gets a flag (**Admin → Bookings → Flags**, note starting "Bókun:") when:
- Bókun has no seats or no matching start time for it;
- Bókun refuses it (wrong product setup, the key's channel can't reserve for external payment);
- Bókun didn't answer while creating it, so it may already be in Bókun. It is never sent again automatically: look for the booking reference in Bókun first.
- a cancellation is refused by Bókun.

Fix it in Bókun by hand and resolve the flag, or press **Retry** in the Bókun tab. The nightly booking check emails any confirmed booking that isn't in Bókun.
