# Affiliate and third-party seller platform — design

Goal: approved affiliates, travel agencies, resellers and partner websites promote Vista Chase products and generate bookings that are attributed, commissioned and reconciled correctly — without trusting anything the browser sends.

The screenshots of a third-party reseller portal (attractions/lodging tiles, product list with "Select", per-product date + adults/children search, a reseller login with the agency name in the header) are used **only as a functional reference** for Model C. No branding, layout or assets are to be copied.

## 1. What exists today (verified)

| Capability | Where | Status |
|---|---|---|
| Partner application → PENDING partner + AFFILIATE user, unique code | `POST /api/affiliates/apply`, `modules/affiliates/affiliate.repository.ts` | **Verified** (`tests/affiliates.test.ts`) |
| Admin approve / suspend, commission rate, Bókun channel id | `/admin/partners`, `PATCH /api/affiliates/admin/:id` (ADMIN) | **Verified** (tests) |
| Referral link `?ref=CODE` → `vc_ref` cookie, 30 days, last click wins, httpOnly, SameSite=Lax | `frontend/src/middleware.ts` | Code reviewed; cookie set server-side |
| Attribution at booking: only ACTIVE partners, code read from the cookie on the server | `POST /api/bookings` → `referringAffiliateId()` | **Verified** (tests) |
| **No self-referral** (partner's own account or own email) | `referringAffiliateId()` — **added on this branch** | **Verified** (new test) |
| Partner dashboard: bookings, guests, value, commission, recent bookings without guest PII | `/partners/dashboard`, `GET /api/affiliates/me` | **Verified** (tests) |
| Commission only on **paid** bookings (CONFIRMED, COMPLETED, PAID_UNSYNCED); unpaid, cancelled, refunded = 0 | `getAffiliateDashboard()` — **fixed on this branch** (previously only CANCELLED was excluded, so unpaid and refunded bookings earned commission) | **Verified** (new test) |

Missing: click events, campaigns/UTM, a commission **ledger** (commission is computed live from the current rate, so changing a partner's rate rewrites history), payouts, contracts, marketing materials, partner-specific promo codes, reseller booking on behalf, audit of partner actions, reports.

## 2. Booking models — assessment

| Model | Fit | Decision |
|---|---|---|
| **A — Vista Chase booking engine** (partner links to our product page; guest books here; we attribute and commission) | Already implemented end to end for attribution; all prices, capacity and payment are server-side. | **Primary model.** Extend with clicks, campaigns, ledger, payouts. |
| **B — External affiliate/OTA links** (link redirects to an external provider) | Only for products we do not sell ourselves. We can record the **outbound click**, but a conversion is confirmed **only** when the provider sends a verified postback/webhook/API report. | Support outbound click tracking only. Confirmed conversions only per provider integration (none exists today). Never estimate conversions. |
| **C — Third-party seller (reseller) portal** (agency logs in, sees permitted products, contract rates and availability, books for its clients) | Builds on Model A's booking engine with a reseller identity on the booking. | **Phase 2 of the platform**, after the ledger and contracts exist. Bókun's own reseller/channel features may cover part of this — compare before building. |

## 3. Attribution policy (to be approved by the owner)

1. Source of truth is the **server**: the referral code comes from the httpOnly `vc_ref` cookie, set by our middleware from `?ref=` on our own domain. A code in a request body is ignored.
2. **Window:** 30 days from the last referral click. **Last click wins** (current behaviour).
3. Only partners **ACTIVE at booking time** are credited. Suspension does not remove commission already earned unless reversed by an admin with a reason.
4. **Self-referral is never credited** (same account, same email; later: same payment fingerprint).
5. Commission is **earned** when the booking is paid, **payable** after the tour date has passed and the cancellation window has closed, and **reversed** in full on cancellation/refund (pro-rata on partial refund).
6. One booking → at most one commission line per partner (unique constraint).
7. Staff bookings (Quick Book) are not credited unless staff explicitly attach a partner (audited).

## 4. Data model (proposed Prisma additions)

```prisma
model AffiliateClick {           // one row per referral landing (Model A) or outbound click (Model B)
  id           String   @id @default(cuid())
  affiliateId  String
  campaignId   String?
  kind         String   // "REFERRAL" | "OUTBOUND"
  landingPath  String   // path only, no query values beyond utm_*
  utmSource    String?
  utmMedium    String?
  utmCampaign  String?
  ipHash       String   // salted hash, for de-duplication and abuse checks; no raw IP
  uaHash       String?
  createdAt    DateTime @default(now())
  @@index([affiliateId, createdAt])
}

model AffiliateCampaign {
  id          String   @id @default(cuid())
  affiliateId String
  name        String
  slug        String   // ?ref=CODE&c=slug
  productSlug String?  // optional deep-link target
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  @@unique([affiliateId, slug])
}

model CommissionRule {           // what a partner earns; the rule in force is copied onto each ledger line
  id           String   @id @default(cuid())
  affiliateId  String?  // null = default rule
  productSlug  String?  // null = all eligible products
  category     String?  // SHARED | PRIVATE | ...
  ratePercent  Float?   // either a percentage…
  fixedCents   Int?     // …or a fixed amount per booking
  validFrom    DateTime
  validTo      DateTime?
  @@index([affiliateId])
}

model CommissionLedger {         // append-only; amounts never edited, reversals are new lines
  id           String   @id @default(cuid())
  affiliateId  String
  bookingId    String
  type         String   // "EARNED" | "REVERSED" | "ADJUSTMENT"
  amountCents  Int      // negative for reversals
  basisCents   Int      // booking amount the line was computed on
  ratePercent  Float?
  ruleId       String?
  status       String   // "PENDING" (tour not yet run) | "PAYABLE" | "IN_PAYOUT" | "PAID" | "VOID"
  payoutId     String?
  reason       String?
  createdBy    String?  // staff user for adjustments
  createdAt    DateTime @default(now())
  @@unique([bookingId, affiliateId, type])
  @@index([affiliateId, status])
}

model AffiliatePayout {
  id           String   @id @default(cuid())
  affiliateId  String
  periodStart  DateTime
  periodEnd    DateTime
  amountCents  Int
  status       String   // "DRAFT" | "APPROVED" | "PAID" | "CANCELLED"
  approvedBy   String?
  paidAt       DateTime?
  reference    String?  // bank/e-transfer reference entered by staff
  createdAt    DateTime @default(now())
}

model ResellerContract {         // Model C
  id            String   @id @default(cuid())
  affiliateId   String
  status        String   // "DRAFT" | "ACTIVE" | "EXPIRED" | "TERMINATED"
  validFrom     DateTime
  validTo       DateTime?
  paymentTerms  String   // e.g. "Guest pays Vista Chase" | "Net 30 invoice"
  cancellationTerms String
  createdAt     DateTime @default(now())
  terms         ContractTerm[]
}

model ContractTerm {
  id           String  @id @default(cuid())
  contractId   String
  productSlug  String
  netRateCents Int?    // reseller pays net rate…
  commissionPercent Float? // …or earns commission on retail
  allotment    Int?    // optional seats per departure
}

model PartnerMessage {           // "Conversations"
  id          String   @id @default(cuid())
  affiliateId String
  contractId  String?
  authorId    String
  body        String
  createdAt   DateTime @default(now())
}

model PromoCode {
  id           String   @id @default(cuid())
  code         String   @unique
  percentOff   Float?
  amountOffCents Int?
  validFrom    DateTime?
  validTo      DateTime?
  maxUses      Int?
  usedCount    Int      @default(0)
  productSlug  String?
  affiliateId  String?  // partner-specific code (counts as attribution only if policy says so)
  active       Boolean  @default(true)
}
// Booking gains: promoCodeId String?, discountCents Int @default(0), resellerContractId String?
```

All migrations are **additive** (new tables/nullable columns) — safe for `prisma migrate deploy` in production. The existing `PROMO_CODES` env list keeps working until codes are migrated into the table.

## 5. API (proposed)

Partner (role AFFILIATE, only its own data):

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/partner/links?productSlug=` | Build referral links (with optional campaign) |
| GET/POST | `/api/partner/campaigns` | List/create campaigns |
| GET | `/api/partner/stats?from=&to=` | Clicks, bookings, conversion rate, earned/payable/paid |
| GET | `/api/partner/ledger` | Ledger lines (no guest PII) |
| GET | `/api/partner/payouts` | Payout history |
| GET | `/api/partner/materials` | Approved images/copy (from `/api/media` with a "partner" tag) |
| GET/POST | `/api/partner/messages` | Conversations |
| GET | `/api/reseller/products` | Model C: products in the reseller's active contract with its rates |
| POST | `/api/reseller/bookings` | Model C: book for a client; server applies contract terms and capacity rules |

Public: `GET /r/:code` (or the existing `?ref=`) records an `AffiliateClick` then redirects to the target; `GET /out/:campaign` for Model B outbound clicks.

Admin (ADMIN; OPERATOR read-only where noted): partners CRUD and status; commission rules; ledger adjustments (reason required); payout draft → approve → mark paid; contracts and terms; promo codes; reports. Every write is recorded in the existing `AuditLog`.

## 6. Commission lifecycle

```
booking paid (webhook)        → EARNED line, status PENDING (amount = rule in force × paid amount)
tour date passed, not refunded → PENDING → PAYABLE (nightly job)
admin creates payout          → PAYABLE → IN_PAYOUT (payout DRAFT)
admin approves + marks paid   → IN_PAYOUT → PAID (payout PAID, reference stored)
cancellation / refund         → REVERSED line (−amount, or pro-rata for partial refund);
                                if the EARNED line was already PAID, the reversal carries to the next payout
```

Hooks: `confirmPaidBooking` (earn), `cancelBooking` / refund webhook (reverse), the nightly worker (mature). Ledger writes go in the same transaction as the booking status change.

## 7. Payouts

**No money is moved by the application.** Payouts are prepared, approved by an ADMIN and paid outside the system (bank transfer, Interac e-Transfer, PayPal…), then marked paid with a reference. Automated payouts need a separate decision: provider (e.g. Stripe Connect), KYC/tax forms, approval thresholds, fees.

## 8. Abuse prevention

- Server-side attribution only; ignore client-supplied partner ids, prices, commission amounts, statuses.
- No self-referral (account, email; later payment fingerprint).
- One commission per booking (unique constraint); reversals are explicit lines.
- Click de-duplication by salted IP/UA hash per partner per 24 h; flag partners with clicks ≫ bookings or many bookings from one card.
- Rate limits on click endpoints; bot user-agents ignored.
- Commission payable only after the tour date and the cancellation window.
- Promo codes tied to a partner are counted once; stacking rules defined.

## 9. Permissions

| Role | Can |
|---|---|
| CUSTOMER | book, see own trips |
| AFFILIATE | own links, campaigns, stats, ledger, payouts, messages, materials; never guest names/contacts |
| AFFILIATE + active reseller contract | Model C products/rates and booking for clients (guest data they enter is theirs to see) |
| OPERATOR / DISPATCHER | read partner on bookings; no commission edits |
| ADMIN | everything above, approvals, rules, adjustments, payouts |

Partner endpoints check `role === "AFFILIATE"` **and** resolve the partner from the session user id — never from a request parameter.

## 10. Privacy

The referral cookie is first-party, httpOnly, contains only the partner code, and lasts 30 days. Clicks store hashed IP/UA, not raw values, and are deleted after 13 months. Partners never receive guest names, emails or phone numbers. Add the referral cookie to the privacy policy.

## 11. Delivery phases and tests

| Phase | Scope | Key tests |
|---|---|---|
| P3.1 | `AffiliateClick`, `AffiliateCampaign`, click endpoint, dashboard clicks + conversion rate | click recorded once per window; campaign attribution; bot ignored |
| P3.2 | `CommissionRule`, `CommissionLedger`; earn on payment, reverse on refund; dashboard reads the ledger | earn once; full/partial reversal; rate change doesn't rewrite history; self-referral; suspended partner |
| P3.3 | `PromoCode` table + admin generation; booking stores promo and discount; usage report | limits, expiry, scope, partner codes |
| P3.4 | Payouts (manual approval) | only PAYABLE lines; approval required; paid lines immutable |
| P3.5 | Model C: contracts, terms, reseller portal, conversations | reseller sees only contracted products; net-rate pricing server-side; authorization boundaries |
| P4 | Model B outbound clicks; provider postbacks where available | unsigned postbacks rejected |

Estimates are in `docs/BACKEND_IMPLEMENTATION_ROADMAP.md`.
