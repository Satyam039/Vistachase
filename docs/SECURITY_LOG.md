# Admin → Security: form senders and blocking

Owner request 2026-11-15: see the IP and location of whoever sends the website's forms, and block spammers.

## What is recorded
One `SecurityEvent` row per enquiry, account signup, partner application, concierge chat start (one per IP per
30 minutes), live chat start and "chat → support" handoff, and one per blocked sender every 10 minutes. Each row
has the form, the result (went through / spam dropped / refused / blocked) and why, the IP, name, email, browser,
and the city/region/country looked up from the IP after the response (Cloudflare headers when present, else
ipinfo.io with `IPINFO_TOKEN`, else ipwho.is; cached a day per IP). Rows older than 180 days are deleted.
Code: `backend/src/modules/security/visitor-log.ts`.

## Blocking
Admins block an IP or email from Admin → Security (one click on a row, or typed in). A blocked sender gets 403 on
every public POST/PUT/PATCH/DELETE under `/api` (forms, signup, partner apply, chat, bookings). Never blocked:
`/api/admin`, staff sign-in (`/api/auth/login|logout|me`), `/api/seo`, `/api/operations`, webhooks, health.
Private/server addresses, the admin's own current IP and staff emails can't be blocked. Every block and unblock is
in the audit log (`SENDER_BLOCKED` / `SENDER_UNBLOCKED`). The blocklist is cached for 30 seconds per API process.

## Which IP
`clientIp()` only believes `X-Forwarded-For` when the request came from a local proxy (nginx / Next.js) and then
takes the right-most public address, the one our proxy added, so a visitor can't fake their IP by sending the header.
