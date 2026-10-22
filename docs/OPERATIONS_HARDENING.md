# Operations hardening (P1 items from the 17 October audit)

No database migration. No change to how the live site looks.

## Rate limits

`checkRateLimit()` now counts in one atomic step: a small Redis script (INCR, plus EXPIRE on the
first hit) when `CACHE_PROVIDER=redis`, or in-process counters otherwise. Simultaneous requests
can no longer slip past a limit, and when Redis can't be reached the limits stay on (per process)
instead of switching off.

## Seat holds

`POST /api/reservations/hold` validates its input (seats 1–30, a real email, name and phone
lengths) and allows at most 3 active holds per email; a 4th gets 429 until one ends (holds still
expire after 10 minutes). Hold tokens must look like `hold_<32 hex>`.

## WhatsApp T-60

The tracking-link WhatsApp is now scheduled: every 5 minutes it messages each confirmed guest whose
pickup (their own pickup time, else the departure time, in Banff time) is within the next 65 minutes,
once per booking. It runs only when `WHATSAPP_PROVIDER=twilio` or `meta` is set, in the worker or in
the API with `RUN_JOBS_IN_API=true`; with the console logger nothing would reach guests. Messages no
longer name a made-up driver or vehicle before dispatch assigns real ones.

## Start-up warnings

The API prints a `[config]` block at start (see `pm2 logs vistachase-backend`) listing what is
missing or unsafe: the example `JWT_SECRET`, `NODE_ENV` not production, no `VOUCHER_SECRET`,
Stripe missing or in test mode, no webhook secret, `FEATURE_MOCK_PAYMENT=true`, email or WhatsApp
not configured, `FRONTEND_URL` unset or localhost. These are warnings, so a missing key never stops
the live site; only `DATABASE_URL` and `JWT_SECRET` are required, as before.
