# SEO dashboard

Admin → **SEO** (`/admin/seo`; admins and SEO managers change it, editors write page copy, viewers
read; roles and the keyword sheet are in [SEO_WORKSPACE.md](SEO_WORKSPACE.md)) manages page metadata, the keyword map, redirects,
audits and `llms.txt`. It extends the existing site: pages keep their coded titles, descriptions
and JSON-LD, and a published override replaces only the fields it sets.

The SEO team's own workspace, `/seo` (drafts and publishing, Webflow import, blog posts at
`/blog-post/<slug>`, technical checks, schema, migration checklist, tasks, approvals), is described in
[SEO_PORTAL.md](SEO_PORTAL.md).

Nothing in the dashboard is invented. Search volume and difficulty appear only when someone enters
them with a basis (estimate or researched, with the tool named) and every keyword starts
**unverified**. Rankings, clicks, impressions and traffic are not shown anywhere until a Search
Console / Analytics integration is built and verified (see "Search data" below).

## Where things live

| Part | Code |
| --- | --- |
| Data model | `backend/prisma/schema.prisma` (Seo* models), migration `5_seo` (additive) |
| API | `backend/src/routes/seo.routes.ts`, mounted at `/api/seo` |
| Logic | `backend/src/modules/seo/` (pages, keywords, redirects, audit, public, settings, bootstrap) |
| Jobs | `backend/src/jobs/tasks.ts`, `worker.ts`, `in-process.ts` |
| Tests | `backend/tests/seo-unit.test.ts`, `backend/tests/seo-api.test.ts` |
| Site wiring | `frontend/src/lib/seo/server.ts` (`withSeo`), `src/app/sitemap.ts`, `robots.ts`, `llms.txt/route.ts`, `guides/[slug]`, `src/middleware.ts` (redirects) |
| Admin UI | `frontend/src/app/admin/seo`, `frontend/src/components/admin/seo` |

## Workflows

**First run.** Overview → *Load starter data*. It adds one SEO row per public page, tour and
destination (all published, no overrides, so nothing on the site changes), 15 keyword clusters and
48 starter keywords from the Vista Chase catalogue, maps them to pages, fills empty focus keywords,
and prepares `llms.txt` (switched off). It only inserts what is missing; running it again changes
nothing. Then run an audit (Audit & issues → *Run audit now*) so the dashboard knows each page's
live title, description, H1, canonical and links.

**Edit a page.** Pages → Edit. Empty fields keep the page's own value (shown as placeholders).
Counters show title 50–60 characters, description 150–160, answer snippet 40–60 words; these
are advice. Overrides apply on the live site only while the page is *Published*. Switching a key
page (home, tours, category pages) to noindex asks for confirmation. Every save writes a revision
and an audit-log entry.

- Tour, destination and coded pages: the metadata fields apply (title, description, canonical,
  robots, Open Graph, Twitter). H1, body, FAQs and the answer snippet are stored and audited but
  shown only on guide pages, so the existing page designs don't change.
- Guides (`/guides/<slug>`): Pages → *New guide* creates a hidden draft. Publishing needs an SEO
  title, meta description, H1 and at least 150 words. The body takes a small Markdown subset
  (`##`/`###` headings, `-` and `1.` lists, `>` quotes, `**strong**`, `*em*`, `[links](/path)`);
  no HTML is ever rendered from the database. FAQs are marked up as FAQPage only because they are
  shown on the page.
- Slugs: only guide slugs are editable. Changing a published guide's slug adds a 301 from the old
  address and repoints older redirects to the new one.
- *Schedule* publishes at a set time (checked every 5 minutes). A schedule whose page has blocking
  problems stays unpublished and shows up as an issue.

**Keywords.** Each keyword has a *track*: **traffic acquisition** (informational, brings
visitors: guides, destinations) or **booking conversion** (commercial/transactional, sells: tour
and category pages). Filters cover track, intent, funnel stage, priority, status, validation,
cluster and mapping. Flags: *unmapped*, *planned page* (target page not built yet), *cannibalised*
(primary on more than one page), *intent mismatch* (for example an informational keyword as the
primary of a tour page). Archive instead of delete.

**CSV import / export.** Export writes every field (formula-looking cells are prefixed with `'`
so spreadsheets don't run them). Import → *Preview* checks every row (required fields, enum values,
duplicates in the file and against existing keywords, metric rules) and shows what will be created,
updated, skipped or refused; only *Import* saves, in one transaction. Limits: 1 MB, 2,000 rows. A
figure with no stated basis is saved as an unverified estimate.

**Redirects.** Same-site paths only (`/old` → `/new`), 301 by default. Refused: loops, chains
longer than 10, off-site targets, app areas (`/api`, `/admin`, `/account`, `/book`, `/booking`,
`/media`, …) and a redirect that would hide a live page. The site reads active redirects once a
minute and keeps the query string (`?ref=`, `utm_*`). If the API is down, pages load normally.

**Audits.** Reads each tracked page on the live site (`SEO_AUDIT_BASE_URL`) and checks: page
reachable, title/description present and length, one H1, canonical present and on this site,
noindex on key pages, thin guide content, duplicate titles/descriptions/canonicals/slugs, focus
keyword set, keyword cannibalisation and intent mismatch, unmapped keywords, blocked schedules,
redirect loops/chains/broken targets, broken internal links and links to redirected URLs. Issues
are kept across runs: fixed ones resolve on the next audit, ignored ones stay ignored. If the site
can't be reached, page checks are skipped and nothing is wrongly resolved. A nightly audit runs at
04:00 Mountain Time (worker) or every 24 hours (in-process jobs).

**llms.txt.** llms.txt & business info: site summary, about text, contact block (phone and
address prefilled from the site's existing JSON-LD), service area, hours, Google Business Profile
link, key and optional pages. Tick *Publish /llms.txt* to serve it; it 404s while off.

## Public output

- `sitemap.xml`: built per request (cached a minute). Includes published, indexable pages whose
  canonical is themselves, every tour, destination and published guide. Excludes redirect
  sources, noindex pages, sign-in/checkout/search pages and pages whose live HTML says noindex.
  Replaces the old `next-sitemap` files, which were static and stale.
- `robots.txt`: allows the site, blocks `/admin`, `/account`, `/booking`, `/partners/dashboard`,
  lists the sitemap. `/book` and `/search` stay crawlable but now say `noindex` in the page.
  `SEO_BLOCK_INDEXING=true` turns it into `Disallow: /`.
- Breadcrumb JSON-LD on tour, destination and guide pages, matching the visible breadcrumb.
  Article JSON-LD on guides. Existing Organization/TouristTrip/FAQPage JSON-LD is unchanged.

## Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `SITE_URL` | backend and frontend | Public address, e.g. `https://www.vistachase.com`. Canonicals must use this host; sitemap/robots/llms/JSON-LD links use it. Backend falls back to `FRONTEND_URL`, frontend to `NEXT_PUBLIC_APP_URL`. |
| `SEO_AUDIT_BASE_URL` | backend | Where audits read pages. Default `http://127.0.0.1:3000` (Next on the same server). |
| `SEO_BLOCK_INDEXING` | frontend | `true` = robots.txt `Disallow: /`. Use on staging and while the site has no domain. |
| `GSC_SITE_URL`, `GSC_SERVICE_ACCOUNT_JSON`, `GA4_PROPERTY_ID` | backend | Placeholders. They only mark a provider "configured"; nothing is fetched yet. |

## Deploying

1. **Back up the database first.** `backend/scripts/start-production.js` applies pending
   migrations when the API starts, so merging to `main` applies `5_seo` on the server:
   `pg_dump "$DATABASE_URL" -Fc -f ~/backups/pre-seo-$(date +%F).dump`.
2. Set `SITE_URL` in `backend/.env` and `frontend/.env.production.local` (the server's
   `FRONTEND_URL` still names an old IP). Until the domain and HTTPS are live, also set
   `SEO_BLOCK_INDEXING=true` in the frontend env so the bare IP isn't indexed.
3. Merge; the deploy builds and restarts both apps. Then `cd backend && npx prisma migrate status`
   should say the schema is up to date.
4. Admin → SEO → *Load starter data*, then *Run audit now*.
5. Check `/sitemap.xml`, `/robots.txt`, a tour page's `<head>` (unchanged until you publish an
   override), and `/llms.txt` (404 until switched on).

**Rollback.** The migration only adds tables, enums and two back-relations; existing tables are
untouched. To remove it after reverting the code:

```sql
DROP TABLE IF EXISTS "SeoSearchMetric", "SeoLlmsEntry", "SeoSiteSettings", "SeoIssue", "SeoAuditRun",
  "SeoRedirect", "SeoKeywordMapping", "SeoKeyword", "SeoKeywordCluster", "SeoPageRevision", "SeoPage" CASCADE;
DROP TYPE IF EXISTS "SeoPageType", "SeoPageSource", "SeoPublishStatus", "SeoConversionGoal", "SeoSearchIntent",
  "SeoFunnelStage", "SeoStrategyTrack", "SeoPriority", "SeoKeywordStatus", "SeoValidationStatus", "SeoMetricBasis",
  "SeoMappingRole", "SeoIssueSeverity", "SeoIssueStatus", "SeoAuditTrigger", "SeoAuditStatus", "SeoLlmsSection";
DELETE FROM "_prisma_migrations" WHERE migration_name = '5_seo';
```

Unpublishing an override (or the whole page row) returns a page to its coded metadata at once;
deactivating a redirect stops it within a minute.

## Staging check

Before calling it production-ready: on a staging copy with `SEO_BLOCK_INDEXING=true`, load starter
data and run an audit; publish one override and confirm the page `<title>`/description/canonical
change and revert on unpublish; create, publish and view a guide; change its slug and confirm the
301; add a redirect and a looping one (refused); import a CSV with an error row (refused, nothing
saved); switch `llms.txt` on and off; validate `/sitemap.xml` and a guide's JSON-LD with Google's
Rich Results Test; check the admin screens at 320px and with the keyboard (`npm run a11y`).

## Search data (not connected)

`backend/src/modules/seo/search-console.ts` defines the provider interface and the
`SeoSearchMetric` table (per path/keyword/day: clicks, impressions, CTR, position) that a Search
Console import would fill. Connecting it needs a Google Cloud service account with read access to
the Search Console property for the final domain, which can only happen after the domain is live.
Until then the dashboard says "Not connected" and shows no ranking or traffic figures.

## Keyword strategy (starter map)

Built from the Vista Chase catalogue only: shared, private and multi-day tours, Moraine Lake and
Lake Louise shuttles, and attraction tickets, with pickup in Banff, Canmore and Lake Louise. No
figures are included; Banff Elite's volume and difficulty numbers come from an unnamed tool for a
different business and are never copied: a keyword note only says the term appears on their sheet
and is a hypothesis until researched.

| Track | Cluster | Hub page | Example keywords |
| --- | --- | --- | --- |
| Booking | Brand | `/` | vista chase, vista chase banff |
| Booking | Banff small-group tours | `/shared-tours` | banff tours, banff day tour, small group tours banff, banff highlights tour |
| Booking | Banff private tours | `/private-tours` | banff private tours, private tour banff national park, private guide banff |
| Booking | Moraine Lake & Lake Louise shuttles | `/shuttles` | moraine lake shuttle, lake louise shuttle, moraine lake sunrise shuttle |
| Booking | Icefields Parkway & Jasper tours | `/shared-tours-icefields-jasper` | icefields parkway tour, columbia icefield tour from banff |
| Booking | Yoho & Emerald Lake tours | `/shared-tours-banff-yoho` | emerald lake tour from banff, yoho national park tour |
| Booking | Winter tours | `/winter-special` | banff winter tours |
| Booking | Multi-day Rockies trips | `/multi-day-tour-package-for-banff` | multi day canadian rockies tour |
| Booking | Banff attraction tickets | `/banff-activity-tickets` | banff gondola tickets, lake minnewanka cruise tickets |
| Traffic | Moraine Lake guide | `/destinations/moraine-lake` | moraine lake, how to get to moraine lake, moraine lake parking |
| Traffic | Lake Louise guide | `/destinations/lake-louise` | lake louise, lake louise parking, lake louise to moraine lake |
| Traffic | Banff National Park planning | `/destinations/banff-national-park` | banff national park, things to do in banff*, banff itinerary* |
| Traffic | Johnston Canyon | `/guides/johnston-canyon`* | johnston canyon |
| Traffic | Icefields Parkway & Columbia Icefield | `/guides/icefields-parkway`* | icefields parkway, columbia icefield, peyto lake |
| Traffic | Seasonal trip planning | `/guides/best-time-to-visit-banff`* | best time to visit banff, banff in winter |

Published guides are listed at `/guides` (footer → Travel guides).

\* Planned guide, not built yet (flagged "planned page" until it is published).

Left out on purpose, because Vista Chase doesn't sell them: Calgary airport transfers, chauffeur
and corporate transport, helicopter tours, wildlife safaris, weddings and honeymoons.

## Reference material (Banff Elite PDFs)

Three PDFs were supplied as reference, not as Vista Chase content:

- *Dashboard things needed*: the field list (meta, content, image, schema, GEO/AI, llms.txt,
  local SEO, conversion, taxonomy, publishing). Built: all of it except hreflang (no second
  language), comparison tables, speakable, A/B variant slugs, image geotagging and the "cited by"
  tracker (no reliable source to fill it). Review/rating schema uses only real on-site data.
- *Master keyword sheet*: about 120 keywords with volume, difficulty, intent, funnel stage,
  competitor and page type. Useful for its structure; most rows target luxury private, chauffeur,
  corporate transfer and wedding services Vista Chase doesn't offer, and its figures have no named
  source, so none were imported as data.
- *Home page content research*: a luxury, private-only home page outline. Not applied: Vista
  Chase's home page and positioning (shared and private tours, shuttles) stay as they are.
