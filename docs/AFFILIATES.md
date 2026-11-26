# Affiliate and associate program (partner portal)

How the partner program works today: attribution, the commission ledger, payouts, the API, and how to deploy or roll it back. The UI still calls partners "partners"; routes, models and the `Affiliate` table keep their existing names. Design background: `AFFILIATE_PLATFORM_DESIGN.md`.

## Pages

| Page | Who | What |
|---|---|---|
| `/partners`, `/affiliate/register` | Public | Program page and the partner application form (owner's "Vista Chase Partner Application", 2026-11-18): partner details, wire transfer details (Canadian or international bank), payment authorization (checkbox + typed name, dated), plus a portal password. Required fields match the form. Answers go to `Affiliate.application` (JSON); bank details are AES-256-GCM encrypted into `Affiliate.payoutDetails` (key `PARTNER_DATA_KEY`, else derived from `JWT_SECRET`: set `PARTNER_DATA_KEY` before rotating `JWT_SECRET`). Admins see them in Admin → Partners → Edit (`GET /admin/:id/application?bank=1`, audited as `PARTNER_BANK_DETAILS_VIEWED`). New partners start PENDING. |
| `/affiliate/products` | Partner | Every product (shared, private, multi-day packages, shuttles, collection pages) with the partner's link `<product page>?ref=CODE`; Open starts a new tab. Activity tickets are left out (booked on the operator's site). |
| `/partners/login` | Partner | Sign in. |
| `/partners/dashboard` | Partner | Tabs: Overview (paid bookings, guests, value, net commission, pending / approved / paid / reversed, 30-day clicks and conversion), Links (link builder), Bookings, Commissions (statement), Payouts, Profile (business name, contact, phone, website, payout email). No guest names, emails or phone numbers anywhere. |
| `/admin/partners` | ADMIN | Tabs: Partners (approve, suspend, add, edit fallback rate and payout details), Commission rules, Commissions (approve, manual adjustment), Payouts (draft, mark paid, cancel), Report (period totals, CSV). |

## Sign-in and approval

Partners sign in at `/affiliate/login` with email + password, then the 6-digit code the API emails
(`POST /api/auth/login` returns `requireOtp`, the page posts the code to `/api/auth/verify-otp`
with `expectedPortal: "affiliate"`). Only ACTIVE partners get a code: PENDING, REJECTED and
SUSPENDED partners get a 403 with `partnerStatus` (only after the right password), and the page
shows an "Approval in progress" / "not approved" / "paused" pop-up. `verify-otp` checks the same.

Staff in Admin → Partners can Approve, Reject (status REJECTED, applicant emailed, can be approved
later) or Delete an application. Delete (`DELETE /api/affiliates/admin/:id`) works only when the
partner has no credited bookings, commission lines or payouts; it removes the partner and its
sign-in account (unless that account also booked as a guest: then the account stays as a guest
account), and writes a `PARTNER_DELETED` audit row.

## Approval, commission and the partner agreement (2026-11-26)

The owner asked for: commission set by hand on approval (no automatic 10%), a contract drafted from
the application and sent automatically, the application as a downloadable PDF, a change request form
for partners, and coupon codes made only by the Vista Chase team.

- **Application PDF.** Admin → Partners: the file icon on a row, or Edit → Application PDF
  (`GET /admin/:id/application/pdf`). Account numbers are masked; "PDF with bank details" (`?bank=1`)
  shows them and is audited as `PARTNER_BANK_DETAILS_VIEWED`. The "New partner application" email to
  `PARTNERS_TO` now has the masked PDF attached.
- **Approve** opens a dialog: commission % (required, 0-50, of the amount the guest pays), and the
  products it applies to (all products, or whole categories and/or single tours), optional additional
  terms. "Preview agreement (PDF)" downloads a DRAFT built from the application
  (`POST /admin/:id/contract/preview`). "Approve and send agreement" (`POST /admin/:id/approve`) makes the
  partner ACTIVE, saves the commission as rules, stores agreement version 1 (`AffiliateContract`, a
  snapshot the PDF is rebuilt from) and emails the partner the "account active" email plus the agreement
  PDF. `PATCH /admin/:id {status: "ACTIVE"}` is refused (409) for a partner whose commission was never set
  (`Affiliate.commissionSetAt` null); reactivating a suspended partner still works.
- **Rules the agreement writes** (modules/affiliates/partner-contract.ts): all products = one partner-wide
  rule at the rate; chosen products = one rule per category/tour at the rate plus a partner-wide 0% rule,
  so other products earn nothing (it outranks every all-partner rule). `Affiliate.commissionRate` is set
  to the rate (all products) or 0. **New agreement** on an active partner (`POST /admin/:id/contract`)
  ends the previous version's rules and sends version N+1; earned commission never changes.
- Staff adding an ACTIVE partner by hand must give a commission %.
- Partners download every version under Settings → Partner agreement (`GET /me/contracts`,
  `GET /me/contracts/:version/pdf`). The agreement wording is a draft based on how the program works
  here; Vista Chase should review it (`contractClauses()`).
- **Change requests.** Affiliate portal → Requests (`/affiliate/requests`, `GET|POST /me/requests`, 10
  per hour): category, subject, details, optional booking reference. The team is emailed; staff answer in
  Admin → Partners → Change requests (`GET /admin/requests`, `PATCH /admin/requests/:id` with status
  OPEN / IN_PROGRESS / DONE / DECLINED and a reply), which emails the partner.
- **Coupons.** Only staff create codes, in Admin → Promo codes, with an optional Partner (bookings with
  the code credit that partner; the partner must be ACTIVE) and where it applies. The affiliate portal's
  Coupons tab is read-only with "Ask for a coupon" (a change request); `POST/PATCH/DELETE /me/coupons`
  answer 403. `PARTNER_COUPON_MAX_PERCENT` is no longer used.
- **Partner page.** Click a partner's name (or Open) in Admin → Partners to open `/admin/partners/<id>`:
  totals, commission and agreements (PDFs), contact details, application and bank details (on request,
  audited), coupons, credited bookings (with guest names, staff only), change requests and payouts
  (`GET /admin/:id/overview`; bank details are never in this response).
- Migration `9q_partner_contracts_requests` (additive): `Affiliate.commissionSetAt`, tables
  `AffiliateChangeRequest` and `AffiliateContract`.

## Attribution

1. A visitor opens any page with `?ref=CODE`. `frontend/src/middleware.ts` stores the code in the httpOnly `vc_ref` cookie for 30 days (last click wins) and reports the landing to `POST /api/affiliates/click`.
2. Clicks are stats only. One click per visitor per partner per 24 hours; the visitor is an HMAC of IP and user agent (no raw IP stored); bots and unknown or inactive codes are ignored; clicks older than 13 months are deleted nightly.
3. When a booking is created, the backend reads `vc_ref` itself and credits only an ACTIVE partner, never the partner's own account or email. A partner code or id in the request body is ignored.

## Commission lifecycle

Commission lives in an append-only ledger (`CommissionLedger`). Money is stored in integer cents, CAD; the API returns dollars.

| Event | Ledger effect |
|---|---|
| Referred booking created, form submitted, link clicked | Nothing. |
| Payment verified and the booking confirmed (`confirmPaidBooking`) | One `EARNED` line, `PENDING`, in the same transaction. Key `EARN:<bookingId>` makes it exactly-once, even with concurrent confirms. A payment whose amount or currency doesn't match the booking earns nothing. |
| Day after the tour date (Mountain Time), nightly job at 03:00 | `PENDING` lines become `APPROVED`. Staff can approve earlier from the Commissions tab. |
| Refund (guest cancellation or Stripe `charge.refunded`, including dashboard refunds) | One `REVERSAL` line per refund, key `REFUND:<refundId>`, proportional to the refunded amount and never more than what remains. The cancel flow and the webhook can both see the same refund; only one reversal is written. If the earned line was already paid, the reversal is `APPROVED` and comes off the next payout. |
| Manual adjustment (staff) | One `ADJUSTMENT` line, `APPROVED`, with a required reason and an audit entry. |
| Payout drafted | The partner's `APPROVED`, unpaid lines are locked into the payout. Refused if the total isn't positive. |
| Payout marked paid (staff enters the transfer reference) | Lines become `PAID`. |
| Draft payout cancelled | Lines are released for the next payout. |

Changing a rate or a rule never rewrites earned lines; each line keeps a snapshot of the rule it used.

### Which rate applies

The most specific active rule wins, at the time the booking is paid:

1. partner + tour
2. partner + category
3. partner (all tours)
4. all partners + tour
5. all partners + category
6. all partners

Without a matching rule, the partner's own `commissionRate` applies (the column still defaults to 10%, but since 2026-11-26 a partner can't be approved until staff set the commission, see above). A rule is either a percentage of the amount paid or a fixed amount per booking (capped at the amount paid), never both; the database enforces this with a CHECK constraint. Percentages are rounded half up to the cent once per line.

**The real rates are Vista Chase's decision**, made per partner on approval. Partners approved before 2026-11-26 keep the rate they had (10% unless staff changed it) until staff send them an agreement.

### Payouts

The app never moves money. Staff draft a payout, pay the partner outside the app (bank transfer, Interac e-Transfer, PayPal), then mark the payout paid with the reference. The partner gets an email and sees it under Payouts.

## Emails

Sent fire-and-forget through the existing email provider; a failure never blocks the action.

- Application received: to the applicant, and to staff at `PARTNERS_TO` (falls back to `ENQUIRIES_TO`, then support@vistachase.com).
- Account active or paused: when staff change the status.
- Commission earned: when a referred booking is paid.
- Payout sent: when a payout is marked paid.

## API

All under `/api/affiliates`. Inputs are validated with zod; admin routes require role ADMIN; every admin write is in `AuditLog`.

| Method and path | Who | Notes |
|---|---|---|
| `POST /apply` | Public | 3 per hour per IP. |
| `POST /click` | Site middleware | 60 per minute. Always 204. |
| `GET /me` | Partner | Profile, totals, recent bookings. |
| `PATCH /me` | Partner | name, contactName, phone, website, payoutEmail only. |
| `GET /me/bookings?status&page&pageSize` | Partner | No guest details. |
| `GET /me/commissions?status&page&pageSize` | Partner | Ledger lines and totals. |
| `GET /me/payouts` | Partner | Excludes cancelled drafts. |
| `GET /admin`, `POST /admin` | Admin | List partners with commission sums; create a partner. |
| `PATCH /admin/:id` | Admin | status, commissionRate, name, phone, payoutEmail, website, bokunChannelId. Audit diff. |
| `GET /admin/rules`, `POST /admin/rules`, `PATCH /admin/rules/:id` | Admin | Create with `percent` or `fixedAmount`, optional partner, tour slug or category, validity dates. Update only `active` and `validTo`. |
| `GET /admin/commissions?status&affiliateId&page&pageSize` | Admin | |
| `POST /admin/commissions/approve` | Admin | `{ ids }`; only PENDING lines change. |
| `POST /admin/commissions/adjust` | Admin | `{ affiliateId, amount, reason, bookingReference? }`. |
| `GET /admin/payouts`, `POST /admin/payouts` | Admin | Draft from approved lines. |
| `POST /admin/payouts/:id/mark-paid`, `POST /admin/payouts/:id/cancel` | Admin | Drafts only. |
| `GET /admin/report?from&to&format=json\|csv` | Admin | CSV cells are quoted and protected against spreadsheet formula injection. |

## Database

Migration `backend/prisma/migrations/4_affiliate_ledger` is additive only: two nullable columns on `Affiliate` (`phone`, `payoutEmail`), three enums, and four new tables (`CommissionRule`, `CommissionLedger`, `AffiliatePayout`, `AffiliateClick`) with indexes and two CHECK constraints. No existing column, table or row is changed or dropped.

Existing paid partner bookings from before this change have no ledger lines. Production has no real paid bookings yet (payments aren't live), so no backfill is needed.

## Deploy

`backend/scripts/start-production.js` runs pending migrations when the API starts, so merging to main applies this migration on the next deploy.

1. Back up first: `pg_dump "$DATABASE_URL" -Fc -f ~/backups/pre-affiliate-ledger-$(date +%F).dump`.
2. Optionally set `PARTNERS_TO` in `backend/.env`.
3. Merge. After the deploy, check `npx prisma migrate status` reports the database up to date and open `/admin/partners`.

## Rollback

- Code: revert the merge commit and redeploy. The new tables are unused by the old code and can stay.
- Database, only if it must go back: restore the backup taken in step 1. Don't drop the new tables by hand on a live database without a backup.
