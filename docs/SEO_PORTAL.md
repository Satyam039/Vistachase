# SEO portal (`/seo`)

A separate workspace for the SEO team, built for the Webflow → custom site migration (handoff:
"Vista Chase Webflow to Custom Site Migration Handoff"). It sits on top of the SEO dashboard
([SEO.md](SEO.md)) and the staff roles ([SEO_WORKSPACE.md](SEO_WORKSPACE.md)); `/admin/seo` keeps
working as before. Nothing on the public site changes until someone publishes or an admin approves it.

## Screens

Sign in at `/seo/login` (staff accounts only, no self-registration). The sidebar has:

| Screen | What it does |
| --- | --- |
| Overview | Migration progress (blog posts here vs. the 84 in the handoff, pending approvals, last import, baseline, Webflow connection, technical checks, images) plus the SEO dashboard overview. |
| Website audit | Run the crawl-and-check audit, compare two runs (new / fixed / unchanged issues), confirm an issue as fixed with a note. **Baseline**: crawl the live Webflow site's sitemap (or upload a CSV of URLs) and compare it with the new site: missing pages, changed titles/descriptions/canonicals. |
| Page settings | Webflow-style Pages panel (`/seo/page-settings?page=<id>`): a searchable list of every page (static pages, tours, destinations, guides, blog posts; the home page marked) beside the chosen page's settings. The settings are the same page editor as Pages & metadata, plus: Open Graph title/description with **Same as SEO** boxes and an image-size warning under 1200×630; **Site search** (exclude, search title/description/image, each falling back to the SEO and Open Graph values); **Schema markup** for that page (validate, save draft, publish; SEO manager); **Custom code** inside `<head>` and before `</body>` (check: anyone; save: admin only). Addresses of static pages, tours and the home page are fixed in code and explained as such; guides and blog posts change their address with a 301 from the old one. |
| Pages & metadata | Every page's title, description, canonical, robots, Open Graph, dates, sitemap flag. Changes to a published page are saved as a **draft** and go live only when an SEO manager presses Publish. |
| Blog SEO | Posts at `/blog-post/<slug>` with checks (title, description, headings, alt text, featured image, images still on Webflow's CDN, links through redirects or to unknown pages, dates, sitemap, BlogPosting). **New blog post** and **Edit post** open the post editor (`/seo/blog/new`, `/seo/blog/<id>`): title, address (from the title, editable), summary, content in a rich text editor (headings, bold, italic, lists, quotes, links to site pages, images by upload or library, tables), meta title and description with a search preview, keywords, featured image, author and date, then Save draft / Publish. Also Featured, sitemap indexing, Open Graph (same-as-SEO boxes, image, share preview), thumbnail and the created / modified / published dates. The list filters by status, changes in draft, sitemap indexing, featured and published / created / modified in the last 24 h, 7 or 30 days, sorts by any date, name or status, pages 25 at a time and exports the filtered list as CSV (`GET /api/seo/portal/blog/export.csv`, cells starting with `= + - @` are prefixed with `'`). A published post's edits stay a draft until Publish changes. Content is stored in the blog's Markdown subset (tables as pipe tables), so no HTML reaches the site. Webflow import. |
| Keywords | The existing keyword sheet. |
| Select (on Blog SEO) | **Select** (SEO manager / admin) adds a tick box to each post and a select-all box for the page. Ticked posts can be published, unpublished, featured, unfeatured or archived together (`POST /api/seo/portal/blog/bulk`, up to 100). Each post goes through the same checks, revisions and audit log as doing it alone; posts that fail (for example a publish check) are listed with the reason and stay ticked. There is no bulk delete. |
| AI Generate | A **Generate** button under the SEO title, meta description and Open Graph title/description (Page settings, Pages & metadata, blog post editor). Claude reads the words on screen (saved or not) and suggests three options with their length; **Use this** puts one in the field and nothing is saved until Save. SEO manager / admin only (the people who can change those fields). Needs `ANTHROPIC_API_KEY`; without it the button is disabled with a note. |
| Code boxes | The JSON-LD and custom code boxes have **Prettify** (JSON laid out with indents; custom code one tag per line, script and style contents kept as written, JSON-LD scripts laid out like JSON; invalid JSON is left alone) and **Find** (Enter / Shift+Enter or the arrows jump between matches). Browser only; nothing is saved by either. |
| Keywords by page | Every page and blog post (tabs: pages, tours, destinations, blog, guides) with the keywords it targets. Add as many as needed per page, primary or secondary; a keyword not in the sheet yet is added to it (unverified, no volume) and mapped in one step. Change role or remove per page; the keyword stays in the sheet. SEO manager/admin only; others read. |
| Social images | The Open Graph image of every page (what shows when the page is shared). Upload or pick from the library; saving goes live for SEO managers (a page with no SEO row yet can be made live with only the image). Pages without one use the featured image, then the site default (Moraine Lake). |
| Technical SEO | Live checks of robots.txt, sitemap, crawler access, llms.txt, canonical, verification tag, Google tag, viewport, response time, real 404s and the http/www redirects. Per-crawler access for AI crawlers (search engines always allowed) with a robots.txt preview. |
| Schema markup | Inventory of JSON-LD per page, validation, managed blocks (page blocks on any page: SEO manager; site-wide blocks: admin approval). A page block is added next to the schema the page's code renders. |
| Redirects | Existing redirects screen plus Webflow redirect import (saved switched off, switched on after review), CSV export and history. |
| Images & alt text | Every image the audit found: alt text, Webflow CDN, broken, large; read-only. |
| Analytics & Search Console | Connection status only. No figures are shown until a provider is connected and tested. |
| SEO tasks | Tasks with assignee (SEO roles only), priority, due date, status. |
| Migration checklist | The handoff's before-launch items and standard after-launch items. Automatic checks show their last result but never tick an item; DONE needs evidence (a link or note) or an explicit confirmation. |
| Change history | Every SEO change from the audit log, filterable. |
| Settings | Verification ID and tracking tags (request → admin approval), approvals queue, llms.txt. |

The portal is `noindex` (`X-Robots-Tag` and robots.txt `Disallow: /seo`) and has its own frame; the
public header/footer are skipped only on `/seo` and `/seo/*`.

## Roles and permissions

Enforced on the server for every request (role read from the database each time):

| | Admin | SEO manager | Editor | Viewer |
| --- | --- | --- | --- | --- |
| Open the portal, read everything in it | ✓ | ✓ | ✓ | ✓ |
| Save drafts of page copy | ✓ | ✓ | copy fields only | – |
| Publish drafts, titles, URLs, redirects, imports, crawler rules, audits, checklist updates | ✓ | ✓ | – | – |
| Create and update SEO tasks | ✓ | ✓ | ✓ | – |
| Request tracking / verification / site-wide schema | ✓ | ✓ | – | – |
| Approve those requests, apply them directly | ✓ | – | – | – |
| Site search fields, Featured, Open Graph, sitemap indexing | ✓ | ✓ | – | – |
| Blog bulk actions (Select), AI Generate | ✓ | ✓ | – | – |
| Save page custom code (head / before `</body>`) | ✓ | – | – | – |

No SEO role can reach bookings, payments, refunds, prices or inventory, customer payment details,
partner payouts, staff accounts, server secrets or deploy settings (tests check 403s on those APIs).
Sessions are the existing HttpOnly `vc_token` cookie; writes pass the existing Origin (CSRF) guard;
login is rate limited (the existing limiter).

## Creating accounts

No passwords in code and no default accounts. An admin opens **Admin → Staff → Add staff**, picks
role **SEO manager**, **Editor** or **Viewer**, and sends the one-time password link to the person
privately (see [SEO_WORKSPACE.md](SEO_WORKSPACE.md#3-creating-the-first-seo-user-no-passwords-in-code)).
They sign in at `/seo/login`. Removing the role ends access on the next request.

## Environment (backend `.env`, all optional)

| Variable | Default | Purpose |
| --- | --- | --- |
| `WEBFLOW_API_TOKEN` | – | Webflow Data API v2 site token (read pages + CMS). Server only; never sent to the browser. Without it, imports use CSV/JSON upload. |
| `WEBFLOW_SITE_ID` | first site the token sees | Which Webflow site to read. |
| `WEBFLOW_BLOG_COLLECTION_ID` | collection named like "Blog Posts" | Which CMS collection holds the blog. |
| `WEBFLOW_SYNC_ENABLED` | `false` | `true` (with the token) turns on the automatic Webflow blog sync (below). "Sync now" works with the token alone. |
| `WEBFLOW_SYNC_MINUTES` | `15` (minimum 5) | How often the automatic sync checks Webflow. |
| `SEO_CANONICAL_ORIGIN` | `https://www.vistachase.com` | The domain canonicals, sitemap and checks expect. |
| `SEO_BASELINE_HOSTS` | `www.vistachase.com,vistachase.com` | Hosts the baseline crawler may read (allow-list). |
| `SEO_CHECK_DOMAIN` | on | `false` skips the http/www redirect checks (e.g. before DNS moves). |
| `SEO_AUDIT_BASE_URL`, `SITE_URL` | as in SEO.md | Unchanged. |
| `ANTHROPIC_API_KEY` | – | Turns on AI Generate (the same key the AI concierge uses). Server only. Rate limited to 60 requests an hour per address. |
| `ANTHROPIC_SEO_MODEL` | `claude-opus-5-5` | Model for AI Generate. Requests use low effort, a JSON answer format and Anthropic's server-side fallback (`fallbacks: "default"`), so a declined request is retried on Anthropic's recommended fallback model in the same call. |

No frontend variables are added. Tracking IDs and the verification ID are not env vars: they are
entered in Settings and only take effect after an admin approves them.

## What goes on the public site, and when

All of it is off until staff act:

- `/blog` and `/blog-post/<slug>`: only published blog posts; BlogPosting JSON-LD (unless the page has
  its own BlogPosting/Article block), breadcrumb, original published/modified dates. Existing `/guides`
  pages are unchanged.
- Google site verification meta on the home page: only after an admin approves the ID.
- Google tag (GA4 + Ads) with consent default: only after an admin approves tracking. One loader, one
  config per ID, so no duplicate tags. The Webflow footer conversion script is stored, never executed,
  until Nishika confirms the full script and which buttons trigger conversions.
- Site-wide JSON-LD: a published SITE block with the same `@id` replaces the coded Organization block.
- Crawler rules in robots.txt: only for AI crawlers an SEO manager blocked.
- Page JSON-LD blocks and page custom code: `PageSeoExtras` (frontend/src/components/seo/PageSeoExtras.tsx)
  on every public page reads `GET /api/seo/public/page-extras?path=` (published pages only, 60 s cache)
  and renders the blocks plus the custom code. Custom code is stored as text but served only as parsed,
  allowed elements (backend/src/modules/seo/portal/custom-code.ts: `<script>` inline or https src,
  `<noscript>`, `<style>`, `<meta>` name/property + content, `<link>` with a safe rel and https href; no
  `on*` attributes, no `http-equiv`, no other tags). `<meta>`/`<link>` are hoisted into `<head>`;
  scripts load after the page is interactive. Nothing is set on any page until an admin saves code.
- Site search: `GET /api/seo/public/search-index` lists published, indexable pages not excluded from
  site search, with their search title/description/image (falling back to SEO, Open Graph, then the last
  audit). The site has no page-wide search box yet (`/search` is the tour search and is unchanged), so
  this index is ready for one but nothing on the site reads it today.

The public layout reads this config with a 1.5 s timeout and a 60 s cache; if the API is down the
site renders exactly as before.

## Webflow import

1. **Website audit → Baseline**: crawl the live site's sitemap (or upload a URL list). This is the
   record of what Google sees today.
2. **Blog SEO → Import**: Webflow API (needs the token) or the CMS CSV export. Preview shows every
   row: new, update, duplicate, conflict, skipped (Webflow drafts and archived posts are never
   imported). Apply after ticking "I reviewed". Posts keep `/blog-post/<slug>`, titles and
   descriptions are copied exactly, the original dates are kept, and "publish" only publishes posts
   Webflow had published. The original export is stored with the batch (`SeoImportBatch.raw`).
3. **Pages & metadata → Import**: from the API, the baseline or a CSV. Becomes drafts on each page.
4. **Redirects → Import**: paste Webflow's 301 list. Saved switched off; switch on after review.
   Wildcard rules are flagged (they need an nginx rule).

Imported posts are stored as-is. Publishing a post later by hand applies the normal page checks
(for example the 150-word minimum for guides), so a very short Webflow post has to be published
through the import or lengthened first.

## Webflow sync

Keeps the public blog (`/blog`, `/blog-post/<slug>`) in step with the posts the SEO team publishes
in Webflow's Blog Posts collection (`backend/src/modules/seo/portal/webflow-sync.ts`). It only reads
Webflow. It runs every `WEBFLOW_SYNC_MINUTES` when `WEBFLOW_SYNC_ENABLED=true` (in the API process
with `RUN_JOBS_IN_API=true`, or in the worker), and from **Blog posts → Webflow sync → Sync now**
(SEO managers and admins). Each run is in the audit log (`SEO_WEBFLOW_SYNC`) and on that panel.

| Webflow (Blog Posts) | Here (`SeoPage`) |
| --- | --- |
| Item ID | `webflowItemId` (the link; one post per item) |
| Name | `label` and `h1` |
| Slug | address `/blog-post/<slug>` (set when the post is first added; never changed by the sync) |
| Post Body (rich text) | `body` (headings, paragraphs, lists, links, images, tables; H1 in the body becomes H2; links to vistachase.com become site-relative) |
| Post Summary | `excerpt` (card text and standfirst; meta description fallback) |
| Thumbnail Image (+ alt) | `thumbnailImage`, `thumbnailAlt` (cards) |
| Main / featured image, if the collection has one | `featuredImage`, `featuredImageAlt` (lead image) |
| Featured? | `featured` (lead story and Editor's picks) |
| SEO / Open Graph fields, if the collection has them | `seoTitle`, `metaDescription`, `ogTitle`, `ogDescription`, `ogImage` (only filled when Webflow has a value) |
| Created On / Last Updated | `datePublished` (kept after the first sync) / `dateModified` |
| Published / Draft / Archived | only published items are added; drafts and archived items never are |

Rules: a new published item is added published, at its Webflow address. A linked post nobody changed
here gets Webflow's edits; a post changed here (or with unsaved draft changes) gets them as a draft to
review instead. A post already at the same address is linked and Webflow's differences become a
draft. A linked post Webflow stops publishing goes back to draft (never deleted) and returns when
Webflow publishes it again; more than 5 at once is refused as a likely bad answer. A Webflow slug
change is reported, not applied (rename in the post editor, which adds the 301). Images stay on
Webflow's CDN unless the media library has a copy; the blog shows CDN images from Webflow's hosts
only. Webflow's per-item "Sitemap indexing" switch is not read through the API: the sitemap and
noindex switches are set per post here (new posts start included and indexable).

## Deploying (needs approval; not done by this change)

1. **Back up the database.** Merging to `main` deploys and `start-production.js` applies
   `8_seo_portal` on API start; `backup-before-migrate.js` dumps the database first, but take your
   own dump too: `pg_dump "$DATABASE_URL" -Fc -f ~/backups/pre-seo-portal-$(date +%F).dump`.
2. Merge. Then `cd backend && npx prisma migrate status` should report the schema up to date.
3. Optional: add the Webflow variables above to `backend/.env` and
   `pm2 restart vistachase-backend --update-env`.
4. Create SEO accounts (above). Open `/seo/checklist` and press **Run automatic checks**.

Migration `8_seo_portal` only adds: six enums, six tables (`SeoSchemaBlock`, `SeoTask`,
`SeoChecklistItem`, `SeoChangeRequest`, `SeoImportBatch`, `SeoBaselineUrl`) and nullable or
defaulted columns on `SeoPage`, `SeoIssue` and `SeoSiteSettings`. No drops, renames or rewrites
(`scripts/check-migrations.js` passes; `prisma migrate diff` is clean).

### At launch (DNS and HTTPS; for whoever runs the server)

The technical checks expect `http://vistachase.com`, `http://www…` and `https://vistachase.com` to
301 to `https://www.vistachase.com`. With nginx and Certbot that is:

```nginx
server { listen 80; server_name vistachase.com www.vistachase.com; return 301 https://www.vistachase.com$request_uri; }
server { listen 443 ssl; server_name vistachase.com; ssl_certificate …; ssl_certificate_key …; return 301 https://www.vistachase.com$request_uri; }
# the existing site block then listens on 443 ssl for www.vistachase.com only
```

Set `SITE_URL=https://www.vistachase.com` in both apps and remove `SEO_BLOCK_INDEXING` at launch.

## Rollback

- Any single change: unpublish the page/block, discard the draft, switch the redirect off, or have
  an admin approve a request that turns tracking/verification off. Each is in Change history.
- Code: revert the merge commit. The old code ignores the new columns and tables, so the database
  can stay as it is. To remove them as well (after the revert, with a backup):

```sql
DROP TABLE IF EXISTS "SeoSchemaBlock", "SeoTask", "SeoChecklistItem", "SeoChangeRequest", "SeoImportBatch", "SeoBaselineUrl" CASCADE;
DROP TYPE IF EXISTS "SeoSchemaScope", "SeoSchemaStatus", "SeoTaskStatus", "SeoChecklistPhase", "SeoChecklistStatus", "SeoChangeRequestStatus";
ALTER TABLE "SeoPage" DROP COLUMN IF EXISTS "dateModified", DROP COLUMN IF EXISTS "datePublished", DROP COLUMN IF EXISTS "draft",
  DROP COLUMN IF EXISTS "draftUpdatedAt", DROP COLUMN IF EXISTS "draftUpdatedById", DROP COLUMN IF EXISTS "featured",
  DROP COLUMN IF EXISTS "importSource", DROP COLUMN IF EXISTS "originalUrl", DROP COLUMN IF EXISTS "sitemapInclude",
  DROP COLUMN IF EXISTS "thumbnailAlt", DROP COLUMN IF EXISTS "thumbnailImage";
ALTER TABLE "SeoIssue" DROP COLUMN IF EXISTS "confirmedAt", DROP COLUMN IF EXISTS "confirmedById", DROP COLUMN IF EXISTS "note";
ALTER TABLE "SeoSiteSettings" DROP COLUMN IF EXISTS "conversionScript", DROP COLUMN IF EXISTS "crawlerRules",
  DROP COLUMN IF EXISTS "googleSiteVerification", DROP COLUMN IF EXISTS "tracking";
DELETE FROM "_prisma_migrations" WHERE migration_name = '8_seo_portal';
```

  Migration `9_seo_page_settings` only adds nullable/defaulted columns to `SeoPage`; the code before
  it ignores them. To remove them too (after a revert, with a backup):

```sql
ALTER TABLE "SeoPage" DROP COLUMN IF EXISTS "searchTitle", DROP COLUMN IF EXISTS "searchDescription",
  DROP COLUMN IF EXISTS "searchImage", DROP COLUMN IF EXISTS "searchExclude",
  DROP COLUMN IF EXISTS "customHeadCode", DROP COLUMN IF EXISTS "customBodyCode";
DELETE FROM "_prisma_migrations" WHERE migration_name = '9_seo_page_settings';
```

  Imported blog posts are ordinary `SeoPage` rows (`importSource` set) and go with the revert only
  if you delete them.

## Image uploads

`POST /api/seo/portal/media` (SEO manager, editor, admin; 60 an hour) takes JPEG, PNG, WebP, GIF or
AVIF up to 8 MB (no SVG, at least 200×200). Every upload is re-encoded with sharp to WebP (rotated,
metadata stripped, at most 2400px wide) and saved to `MEDIA_DIR/uploads/seo/<yyyy-mm>/`
(`backend/media/uploads/seo` by default), served at `/media/uploads/seo/...`. The folder is in
`.gitignore`, so uploads stay on the server across deploys (`git pull` leaves untracked files) and
should be included in server backups. `GET /api/seo/portal/media?q=` lists uploads (from the audit
log) and the site's photo library. Other endpoints: `GET /page-keywords`, `POST /pages/:id/keywords`,
`PATCH|DELETE /pages/:id/keywords/:mappingId`, `PUT /pages/:id/social-image`.

## Tests

- `backend/tests/seo-bulk-ai.test.ts` (7 tests): bulk actions are manager-only, refuse unknown actions
  and empty lists, publish only posts that pass their checks (others reported, non-blog pages refused,
  already-published skipped), audit log per post, feature / unfeature / archive; AI Generate answers 503
  without a key, is manager-only, sends the page's content and focus keyword with fallbacks on, returns
  cleaned suggestions with lengths without saving anything, and reports a refusal. The AI tests use a fake
  client; a real Anthropic call has not been made from here (no key).

- `backend/tests/seo-page-settings.test.ts` (10 tests): custom code parser (allowed tags; iframes,
  `on*` handlers, http scripts, `http-equiv`, unknown script types, unclosed tags, stray text refused),
  only an admin saves custom code (SEO manager and editor 403) with an audit log entry, page-extras serves
  parsed code of published pages only, a JSON-LD block published on a page built in code, editors can't
  set site search fields, search index fallbacks and exclusion, blog filters / sort / paging and the CSV
  export's formula guard.

- `backend/tests/seo-portal-media-keywords.test.ts` (8 tests): upload permissions, WebP re-encode and
  resize, rejected files (text, SVG, tiny), five keywords on one page and a case-insensitive duplicate,
  role change and removal, editor/viewer refused, social image draft vs. publish and clearing, blog
  address change creating a 301 and the featured image on the public blog API.

- `backend/tests/seo-portal.test.ts` (23 tests): 401/403 for signed-out users and customers, viewer
  read-only, editor field limits, SEO roles refused on bookings/staff/payouts, admin-only approvals,
  drafts, schema validation, Webflow HTML conversion, blog CSV import (dates, drafts skipped,
  re-import becomes a draft), redirect import switched off then activated, missing Webflow token,
  checklist evidence rule, verification approval and ID warning, tracking apply, crawler rules,
  robots parsing, tasks.
- Full backend suite: 37 files, 255 tests pass. Backend and frontend typecheck, lint and production
  builds pass; migrations apply to an empty database and match the schema.
- Browser run against a local copy (all 14 screens as SEO manager, viewer and admin; draft save
  keeps the live title, publish makes it live; blog CSV import via the UI; task; checklist refuses
  DONE without evidence; SEO manager's verification request approved by an admin in Settings, then
  the meta tag appears on the home page; published post renders with BlogPosting and the original
  date; signed-out and customer users are refused).

**Not tested** (no credentials or network access here): the Webflow API, the live-site baseline
crawl against www.vistachase.com, Search Console and GA4. They are marked "Not connected" in the
portal until they are.
