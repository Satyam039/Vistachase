# SEO workspace, staff roles and the tour content editor

Added on 2026-10-14 on top of the SEO dashboard ([SEO.md](SEO.md)). It adds four roles with their own
sign-in, a secure invite flow, the master keyword sheet fields, and Admin → **Content** for tour and
destination copy. It is additive: URLs, the public design, booking, payments, Stripe and affiliate
data are unchanged, and there is still one CMS (the existing database tables).

## 1. What was asked, what existed, what was built

Sources read: *Vista Chase – Custom Dashboard Fields & Migration Checklist* (13 Oct 2026) and three Banff
Elite reference PDFs (dashboard field list, home page research, master keyword sheet).

**The Vista Chase master keyword sheet was not supplied.** None of the four PDFs is a Vista Chase
keyword sheet, and none is in the repository. Banff Elite's sheet was read only for its structure
(columns, intent, funnel, competitor columns). Its volumes and difficulty scores were not copied into
any Vista Chase record (migration 7 also rewrites the earlier starter notes that quoted them). When
the real sheet exists, import it from Admin → SEO → Keywords → Import CSV (preview, column mapping,
duplicate detection and validation before anything is saved).

| Requirement | Before | Now |
| --- | --- | --- |
| Dedicated SEO login | Admins only | `SEO_MANAGER`, `EDITOR`, `VIEWER` roles, own sign-in at `/login`, landing on their workspace |
| Admin creates/invites users | Role change on an existing account only | Staff → Add staff: email, name, role → one-time 72-hour password link |
| Password reset | Existing `/forgot-password` | Same flow; staff password set is audited (`STAFF_PASSWORD_SET`) |
| RBAC frontend + backend | Admin-only SEO API | Role checks on every API route (`src/lib/auth/permissions.ts`); tabs and buttons hidden by role |
| SEO role kept away from money and guests | n/a | SEO roles get 403 on bookings, payments, partners/commissions, staff and audit APIs (tested) |
| Audit logs | Yes | Invites, password set, keyword bulk edits, imports (with column map), every content save |
| Master keyword sheet fields | Most fields | Adds keyword ID (KW-0001), parent topic, market, language, booking intent 1–5, competitor evidence, content gap, recommended action, research status |
| Research statuses | Validation only | Unverified → Researched → Validated → Mapped → Implemented → Monitored |
| Search, sort, filter, paginate | Search, filters, pages | Adds sort, research status, page type and problem filters (cannibalised, intent mismatch, unmapped, planned page) |
| Bulk edit | No | Select rows → set priority, status, research status, track, intent, funnel, cluster, parent topic, page type (up to 500, audited) |
| CSV import/export | Preview, duplicates, validation | Adds column mapping in the preview, refuses two columns mapped to one field; export has every new column |
| Page-level SEO editor | Yes (PR #34) | Unchanged; editors may change copy fields only |
| Technical SEO (sitemap, robots, canonical, redirects, llms.txt, audits) | Yes (PR #34) | `/guides` index added to the sitemap |
| Tour content editing | Database only | Admin → Content: title, summary, description, duration, featured, order, highlights, inclusions, exclusions, what to bring, key facts, FAQs, page tabs, featured image, gallery, related tours; destinations too |
| Blog | Guides at `/guides/<slug>` | Plus a `/guides` index page, linked from the footer |

Not built, and why:

- **Search Console, GA4, rankings, backlinks, AI citations**: no account is connected, and the brief
  forbids made-up figures. The dashboard says "not connected" until a provider is set up.
- **Blog authors/categories/tags as separate collections, reading time, table of contents**: guides
  have author name/bio and related pages; separate collections would be a second content model.
- **Media upload with compression**: images are chosen from `/media/...`; adding files still goes
  through `backend/media` (an upload service needs S3 or similar, which isn't set up).
- **Tour price, dates, capacity, booking mode, slug**: deliberately not editable in Content; they
  belong to Departures and the booking engine.
- **Webflow migration checklist**: the site already runs on its own code at the same URLs; the
  remaining items there (Search Console baseline, DNS backup, re-crawl) are launch tasks, not code.

## 2. Roles

| Can do | Admin | SEO manager | Editor | Viewer | Operator / Dispatcher |
| --- | --- | --- | --- | --- | --- |
| See SEO workspace | ✓ | ✓ | ✓ | ✓ | – |
| Keywords, clusters, redirects, titles, URLs, publishing, llms.txt, audits | ✓ | ✓ | – | – | – |
| Write page copy, FAQs, guide body, images (SEO pages) | ✓ | ✓ | ✓ | – | – |
| Edit tour and destination content | ✓ | ✓ | ✓ | read | – |
| Bookings, guests, payments, departures | ✓ | – | – | – | ✓ |
| Partners and commissions, audit log, staff | ✓ | – | – | – | – |

Roles are read from the database on every request, so removing someone's role ends their access on
their next click. Stripe, payment settings and financial records are not reachable by any of the new
roles.

## 3. Creating the first SEO user (no passwords in code)

1. Sign in as an admin and open **Admin → Staff**.
2. **Add staff**: their email, their name, role **SEO manager**.
3. The screen shows a one-time password link (valid 72 hours). If email is set up (Resend key) it is
   also emailed. Send it to the person yourself over a private channel.
4. They open the link, choose their own password, and sign in at `/login`. They land on Admin → SEO. The SEO portal has its own sign-in at `/seo/login`.

The link's token is stored only as a hash, is never written to the audit log or server logs, and is
shown once. If it expires, use **Password link** on their row to make a new one. If the email
already has a customer account, that account is given the role instead. Nobody, including Claude,
needs to know or choose their password.

## 4. Where blog posts go

Admin → SEO → **Pages** → **New guide**. Write the title, URL slug, body, FAQs and image, then
publish (or schedule). The post appears at `https://<site>/guides/<slug>`, on the `/guides` index
(footer → Travel guides) and in `sitemap.xml`. Editors can write the copy; an SEO
manager or admin sets the title, slug and publishes.

Posts migrated from the Webflow blog keep their old address, `/blog-post/<slug>`, and are listed
on `/blog`; they are created in the SEO portal (`/seo/blog`, see [SEO_PORTAL.md](SEO_PORTAL.md)).

## 5. Keyword strategy

The starter map in [SEO.md](SEO.md) stands: 15 clusters on two tracks (booking conversion for tour,
shuttle and ticket pages; traffic acquisition for destination pages and guides), built from what
Vista Chase actually sells. All 48 starter keywords are **unverified hypotheses** with no volume or
difficulty. Services Vista Chase doesn't sell (helicopter, chauffeur, airport transfers, weddings,
honeymoons) are left out. Next steps for the SEO manager: research each keyword in a named tool,
fill volume and difficulty with their basis, move research status forward, and write the planned
guides (Johnston Canyon, Icefields Parkway, best time to visit Banff).

## 6. Technical changes

- Migration `7_seo_workspace` (additive, PostgreSQL 12+): three `Role` enum values, the
  `SeoResearchStatus` enum, new nullable/defaulted `SeoKeyword` columns, `ref` serial with a unique
  index, a backfill (verified keywords → Validated), and the starter-note rewrite above.
- Backend: `src/lib/auth/permissions.ts`, `src/modules/content/content.ts`, `src/routes/content.routes.ts`
  (`/api/content`), role checks in `src/routes/seo.routes.ts` (`GET /admin/me`, `POST /admin/keywords/bulk`,
  import `columnMap`), staff invites in `src/routes/admin.routes.ts` (`POST /staff`,
  `POST /staff/:id/setup-link`), token redaction in the console email provider.
- Frontend: `/admin/content` (`components/admin/content/ContentEditor.tsx`), role-aware tabs and sign-in
  landing (`AdminHeader.tsx`), Staff invite screen, keyword sheet columns, bulk bar, column mapping,
  `/guides` index. Tour JSON-LD now goes through `JsonLd` (escapes `<`), since tour text is editable.
- Content saves send only changed fields, refuse stale edits (someone else saved first → 409), and
  record before/after per field; the editor shows that history.

## 7. Tests

`backend/tests/seo-workspace.test.ts` (15 tests): SEO manager, editor and viewer limits, 403 on
bookings/partners/staff/audit for SEO roles, invite and password-link flow, content edit and history,
image and field validation, keyword sheet fields, bulk edit, column-mapped import
and export. Full backend suite: 224/224. Frontend typecheck, lint and production build pass. Checked
in a browser at 1440px and 390px: Content (list, edit, save, revert), Staff invite, SEO keywords as
manager and editor, `/guides`; no console errors or horizontal scroll.

## 8. Deploying and rolling back

Merging deploys to the server and applies migration 7 on API start. **Back up the database first**
(the deploy script also backs up before new migrations). No Stripe, payment or environment variable
changes are needed or made.

Rollback: before reverting the code, change every SEO manager, editor and viewer back to Customer
(the old code can't read the new role values). The added columns can stay; the old code ignores them.

## 9. Not production-ready until

- HTTPS and a domain (sign-in cookies and Stripe live mode need it).
- An email key (Resend) so invite and reset links are emailed instead of copied by hand.
- Search Console and GA4 connected, and the real Vista Chase keyword sheet imported and researched.
- A staging pass of the new screens by the person who will use them.
