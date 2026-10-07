# CLAUDE

Project-specific guidance for AI coding agents.

## Vista Chase frontend + Astryx

Next.js 15 / React 19 UI. All data comes from the Express backend (`../backend`) through
`src/lib/api/catalog.ts` (server components) or relative `fetch("/api/...")` (client components,
proxied by `next.config.mjs`). Never import backend code here.

Astryx setup (already done, don't redo):
- Theme: Vista Chase (`src/themes/vistachase/vistachaseTheme.ts`), which `extends` Stone
  (`src/themes/stone/stoneTheme.ts`, editable source) and only overrides the brand: teal accent
  (#257780 / text #226d75 for AA contrast; the live #3A9CA6 is icon-only) and IBM Plex Sans for every
  family (body, headings; IBM Plex Mono for code). Edit either source file, then `npm run theme:build` regenerates `vistachase.css` /
  `vistachase.js` (never edit generated files). The extended theme is flat: Stone's CSS isn't loaded.
  `npm run theme:check` fails if the generated files are stale.
- Logo: `src/components/brand/BrandMark.tsx` — `BrandMark` (horse-and-rider mark in the nav; `white` and
  `emblem` variants) and `BrandLogo` (full lockup, footer). Files are in `backend/media/brand`.
- Images: every image is served by the backend from `backend/media` at `/media/...` (`next.config.mjs`
  rewrites `/media/*` to the backend like `/api/*`; `next/image` takes the `/media/...` path as a local src).
  There are no remote image hosts: don't add Webflow/Unsplash URLs, add the file to backend/media instead
  (`backend/scripts/media/build-media.mjs`, catalogued in `backend/media/manifest.json`, queryable at
  `/api/media?collection=&place=&tag=`).
- Brand colours (live vistachase.com names): Ocean Teal `ocean-500` #3A9CA6, Golden Summit `summit-500`
  #F5BF03, Golden Tint `summit-300` #FFE085, Obsidian Black `obsidian-900` #1C1F23, Frost White
  `obsidian-50` #F9F9F7 (tailwind.config.ts). Use these tokens, never raw hex (`bg-[#3A9CA6]`); the legacy
  `forest-*` / `gold-*` names are aliases of the brand scales.
- Responsive scale lives in the theme's `adaptations`, one rule per Astryx width tier
  (body px / H1 px / page radius / page margin), measured in the browser except the 768–1023 row:
    375 (<640)       15 / 23 / 12px / 16px
    750 (640–767)    15 / 26 / 16px / 24px
    768–1023         15 / 29 / 20px / 32px   (type same as root)
    1200 (1024–1279) 15 / 29 / 24px / 40px   ← root values
    1440 (1280–1535) 16 / 31 / 24px / 48px
    1920 (>=1536)    17 / 33 / 32px / 64px
  (body px raised one step on 2026-10-07; H1 px are the scale's computed heading-1 sizes)
  Touch screens (any width) get 36/40/44px controls. Spacing, color, elevation and motion are
  intentionally fixed at every width (Astryx guideline); adapt page regions with Layout/AppShell
  (`npm run astryx -- docs layout`, "Responsive contract"), not by scaling tokens.
- Tailwind v3 bridge (`src/themes/astryx-tailwind-bridge.ts`, wired into tailwind.config.ts) exposes the
  tokens as utilities: colors `bg-surface text-primary border-border bg-blue-subtle text-data-blue-3 …`,
  `px-page` (responsive page margin), `font-body|heading|code`, `text-type-heading-1 … text-type-body`,
  `rounded-element|container|page`, `shadow-low|med|high`, `h-element-sm|md|lg`, `duration-fast|medium|slow`,
  `ease-standard`. Tailwind's default scales (text-sm, rounded-xl, shadow-sm, p-4 …) are deliberately
  NOT remapped so existing pages render unchanged; prefer the token utilities in new code.
- Illustrations: `src/components/illustrations` (NoResults, NoTrips, NotFound, ErrorState, Welcome),
  token-colored and sized per Astryx guidelines (`size="sm|md|lg"` = 120/180/240px). Pass them to
  `EmptyState`'s `icon` slot. New illustrations must reuse `Illustration` + token fill/stroke classes.
- Typeface: IBM Plex Sans everywhere, self-hosted with Fontsource (`src/app/fonts.css`, --font-plex-sans and
  --font-plex-mono), not next/font: next/font requires SWC and the StyleX Babel config turns SWC off.
  Tailwind's sans/serif/display/editorial all map to IBM Plex Sans and mono to IBM Plex Mono.
- StyleX is compiled (official Astryx/StyleX Next.js setup): `babel.config.js` (@stylexjs/babel-plugin,
  `@/*` alias) + `postcss.config.js` (@stylexjs/postcss-plugin) + `@stylex;` at the end of globals.css.
  `stylex.create()`, `xstyle` and the typed tokens in `@astryxdesign/core/theme/tokens.stylex` all work.
  StyleX app layers sit after astryx-theme; Tailwind utilities stay unlayered on top. Babel builds are
  slower than SWC (about 3x). `package.json` browserslist pins Next 15's default modern targets so Babel
  doesn't down-compile async code.
- Site frame: `src/components/layout/SiteFrame.tsx` + `SiteFooter.tsx`, laid out like Bentley's: "Menu"
  button on the left at every width (`SiteMenu.tsx`: full-height Astryx Dialog from the left, large light
  section names, the hovered section's links beside them, sections expand in place on phones), the brand
  absolutely centred in the bar (not TopNav `centerContent`: Astryx hides that slot on narrow screens and
  adds its own "Open navigation" toggle), actions on the right. SiteFrame publishes `--vc-header-h` for
  sticky in-page bars. Menu sections live in `MENU_SECTIONS`.
- Type reads light and large: no bold anywhere (Tailwind bold/semibold/extrabold/black and the Astryx
  `--font-weight-semibold|bold` tokens are 500), Tailwind text sizes one step up (xs 13 … 7xl 76px), Astryx
  base 15px (tiers 15/15/15/15/16/17). Don't add `text-[10px]`-style tiny sizes; `text-xs` is the minimum.
- Services (`src/lib/services.ts`): the five services (shared, private, shuttles, multi-day, Banff activity
  tickets) with "why choose" reasons and background clip/photo. Used by the home hero (`ServicesHero`:
  rotating, pausable, accessible carousel with each service's tours, ratings and prices), the category
  pages (`TourGallery service=`) and the Experiences section.
- Prices: `src/lib/pricing.ts` + `components/pricing/PriceTag.tsx`. The struck "original" price is a fixed
  markup over the offer price (`ORIGINAL_PRICE_MARKUP`, Vista Chase's choice; 0 turns it off). Products
  without a price (basePrice 0, e.g. tickets before Bokun) show "Price on request". Pure tour helpers
  (fromPrice, labels) live in `src/lib/tours.ts` so server pages can call them; TourCard re-exports them.
- Reviews: show stars/counts only when `reviewCount > 0`; say "1,000+" only when the count is that high.
- `/book` checkout: `src/components/booking/BookingCheckoutClient.tsx` (from the checkout-wizard template).
  Steps Party → Contact → Pickup & extras → Review & pay; continuing past Contact places the 10-minute
  seat hold; a hold passed in as `?holdToken=` (AI concierge) is adopted with its real remaining time.
- Tour browsing: `TourCard` (`src/components/tours/TourCard.tsx`) is the one tile for every tour grid.
  `/search` uses `TourSearch` (library template: in-place filtering synced to the URL, grouped by category,
  sort, empty state); `/shared-tours` and `/private-tours` use `TourGallery` (product-gallery template).
  Seat counts come from the backend, which ignores expired holds, so they are live everywhere.
- Product page body (`TourSections.tsx`), Viator-style: sticky "On this page" bar (Overview, What's included,
  What to expect, Meeting & pickup, Additional info, Cancellation policy, FAQ, Reviews) over stacked sections
  built from `tour.tabs`; reviews load from `/api/reviews?tourId=`. The header carries the free-cancellation
  badge and "good to know" chips (only true ones), and phones get a fixed booking bar that publishes
  `--vc-bottom-bar-h` so the floating voice button sits above it.
- Banff activity tickets: category `TICKET`, `/banff-activity-tickets`; content in
  `backend/prisma/catalog/extra-products.json` (not on the live site), ENQUIRY with prices on request until
  their Bokun products exist.
- Partner program: `/partners` (apply), `/partners/login`, `/partners/dashboard` (link builder, totals,
  referred bookings without guest details), `/admin/partners` (approve/suspend). `src/middleware.ts` stores
  `?ref=CODE` in the `vc_ref` cookie for 30 days; the backend credits bookings to ACTIVE partners only.
- Tour detail pages: every product is served by the top-level `src/app/[slug]/page.tsx` at its live
  vistachase.com URL (static routes win; unknown slugs 404; `/tours/<slug>` 308-redirects there). Metadata
  comes from the tour's imported `metaTitle` / `metaDescription`. They render `TourDetailView` (product-detail
  template): gallery + sticky column (facts row from the live page, price with `priceUnitLabel()`, booking
  panel), then the live tab structure (`tour.tabs`: Overview / Inclusions or Selection / Itinerary or Process /
  Seasonal, plus FAQ from `tour.faqs`) and "Explore more" cross-sells (`tour.crossSells`). The booking panel
  follows `tour.bookingMode`: BOKUN tours with local departures book through `/book`; without departures they
  show "Dates on request"; ENQUIRY tours (custom private tours, multi-day) show the vehicle picker
  (`tour.vehicleOptions`, caps guests) and "Request this tour" → `/contact-us?tour=&guests=&vehicle=`
  (the enquiry form itself is roadmap Phase 2). JSON-LD: TouristTrip + FAQPage. "From" prices use
  `fromPrice()` (cheapest scheduled departure, else list price).
- Catalog content (all 13 live products) is imported, not hand-written: `backend/scripts/import_webflow_catalog.py`
  parses saved live pages into `backend/prisma/catalog/products.json`; `backend/prisma/catalog/load-catalog.js`
  maps it to Tour rows for `prisma/seed.js`.
- Pricing model (enforced in `backend/src/modules/pricing/departure-pricing.ts`): shared tours and shuttles
  are priced per guest and take one seat each; PRIVATE tours are priced per vehicle (departure price once,
  any party up to the vehicle's seats) and a hold or booking takes the whole vehicle off sale. The frontend
  mirrors this with `isVehicleTour()` / `departureFits()` in TourCard.tsx and `isVehicle` in the checkout.
- `<Theme>` is mounted in `src/components/providers/AstryxThemeProvider.tsx`, pinned to `mode="light"`
  because the existing site is light-only.
- CSS cascade layers: order is declared in `src/app/layers.css` (imported first in layout.tsx):
  `reset, tw-preflight, astryx-base, astryx-theme`, with Tailwind utilities unlayered. Keep it that way.

Accessibility (WCAG 2.2 AA) — `npm run a11y` (frontend + backend running, Chrome installed) audits every
route at 320px and 1440px: axe WCAG 2.0–2.2 A/AA, reflow at 320px, Tab order (visible focus, focus hidden
behind the sticky header, traps). Report in `a11y-report/summary.md`. Keep it at zero findings:
- Text colour: brand Ocean Teal `ocean-500` (#3A9CA6) is 3.2:1 on white, so never use it for text on light
  surfaces: use `ocean-600` (#257780). On dark surfaces use `ocean-300`/`ocean-400`. `slate-400` text only
  on dark surfaces; on white use `slate-500` or darker. Gold (`summit-*`) is a fill, not a text colour on light.
- The sticky header sits at z-index 40 (theme `app-shell-header`) and SiteFrame sets `scroll-padding-top`
  from its height, so focused elements never land under it. Don't give page sections a z-index above 40.
- Don't add a `<main>`: AppShell renders the main landmark and the skip link.
- Form fields: a `<label htmlFor>` tied to every control (or `aria-label`), `autoComplete` on identity
  fields, errors in `role="alert"`. Icon-only buttons need `aria-label`.
- Motion: Tailwind ping/pulse/bounce are finite (tailwind.config.ts); reduced motion turns animation off
  (globals.css).
- Scroll motion system (`src/components/motion`, CSS in globals.css), opt-in by data attribute so server
  components can use it: `data-reveal[="fade"|"scale"|"left"|"right"|"clip"]`, `data-reveal-delay="ms"`,
  `data-stagger` (children in turn), `data-parallax="6|10|16"` (media inside an overflow-hidden frame),
  `data-count-to` (+ `-prefix/-suffix/-decimals`; put the final value in the markup), `data-scroll-fade`
  (hero content fading out). `MotionRuntime` (mounted in SiteFrame) arms it; nothing is hidden without JS
  or with reduced motion. The revealed flag is the `data-shown` attribute, not a class, because React
  rewrites className on re-render. Parallax/progress use CSS scroll timelines with a JS fallback.
  Components: `Rail` (horizontal snap rail with arrow buttons), `StickyStory` (pinned media + scrolling
  chapters). Don't reintroduce `ScrollReveal` wrappers in new code.
- Page structure follows the OTA research (GetYourGuide, Viator, Expedia, Civitatis): home = hero →
  HeroSearch → TrustRow → TopExperiences rail → categories bento → destinations StickyStory → proof →
  CTA; category = breadcrumb hero → stats strip → sticky sort bar → grid → TrustRow → other ways rail;
  product = breadcrumb/title/rating → ProductGallery mosaic → key facts → TourSections + sticky booking →
  "You might also like" rail. Ratings and counts are always real catalog values; cancellation is 24 hours.
- Video: clips live in `backend/media/videos` (MP4 + `-poster.webp`, `-1080.mp4` for hero clips) and come
  from the API: `tour.videos` (clips of the places a tour visits) and `destination.heroVideo`. Play them only
  through `cinematic/AmbientVideo` (`src`, `srcHd`, `poster`): it loads when on screen, pauses off screen, has
  a pause button, and stays on the poster with reduced motion or data saver. Inside it the parent must be
  `position: relative`.
- Client-component pages set their title in a sibling `layout.tsx` (every page needs its own title).

Building pages from templates (https://astryx.atmeta.com/templates):
1. Pick the template: `npm run astryx -- build "<what the page does>"`, or choose one by id from
   `npm run astryx -- template --list --type page` (for example checkout-wizard, product-detail,
   product-gallery, library, gallery-hero, side-gallery, contact-form, login-card, dashboard,
   table-filter, settings).
2. Scaffold it into the route: `npm run astryx -- template <id> src/app/<route>` (writes page.tsx).
3. Then make it fit this project:
   - Templates import icons from `@heroicons/react`, which this project doesn't use. Swap them for
     the `lucide-react` equivalents (Astryx `Icon` accepts any SVG component).
   - Escape apostrophes in JSX text (`&apos;`) or `next lint` fails on `react/no-unescaped-entities`.
   - Replace the template's demo data with real data from `src/lib/api/catalog.ts` or `/api/*`.
   - Keep the template's `stylex.create()` / `xstyle` code as is; StyleX is compiled here.
   - `NumberInput`'s `hasNumberSteppers` buttons are 15×20px (below the 24px touch minimum) and not
     themeable. For quantities people tap, use `QuantityInput` (`src/components/forms/QuantityInput.tsx`):
     NumberInput plus IconButton −/+ that are 40px on touch screens.
   - `Section` applies `className` to an outer wrapper outside its background; put margins such as
     `px-page` on an inner Stack instead.
   - Templates are client components (`'use client'`). Keep data fetching in a server `page.tsx` and
     move the template into a client component when the page needs server data.
4. Existing pages are still Tailwind. Migrate them one route at a time (`npm run astryx -- docs migration`).

<!-- ASTRYX:START -->
Astryx v0.6.5 · 166 components
CLI: run every command as `npx astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in your app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — start every page from a template. Never lay out a page from scratch:
1. `astryx build "<idea>"` — START HERE: names the [page] template to start from (always one: the closest match, or the app shell), two other templates, and the [block]s + [component]s for parts it lacks. No args = full playbook.
2. `astryx template <name> <path>` — scaffold that template into your project. Keep its frame, gap and padding; replace its data, copy and sections; delete sections you do not need.
3. `astryx template <Block>` for a part the template lacks; `astryx component <Name>` for props + examples before you use or change a component.
Changing a page you already have? Keep it: skip step 2 and add blocks and components inside its sections.

RULES:
- No <div> — components do all layout/spacing, page frame included.
- Frame first: the template you scaffold sets the page frame. Read `astryx docs layout` before you change it — region widths, breakpoint behavior.
- Dense data = rows (Table, List/Item), never Card-wrapped list items; Card is for standalone widgets. Status = StatusDot/Token; Badge = counts only.
- Custom styling: component props first; else Tailwind utilities backed by tokens (bg-surface, text-primary, rounded-lg) via tailwind-theme.css. No raw hex/px.
- Tokens for every value (`astryx docs tokens`). Brand/accent belongs in the theme (`astryx theme list` / `theme add <slug>`, or `astryx theme template` for a custom one) — never override --color-* in :root.
- SELF-CHECK before you finish: re-read the file and replace any style={{…}}, raw <div>/<span> layout, imported .css/@apply, or hardcoded/arbitrary value (e.g. bg-[#fff], p-[13px]) with the component or a token-backed utility. Confirm the page kept its template's frame, gap and padding. If unsure a component/prop exists, run `astryx component <Name>` / `astryx search "<thing>"`; don't hand-roll CSS.

MORE CLI:
  search "<query>"   find any component / hook / doc / template / block
  component --list   166 components by category
  template --list    page + block recipes
  docs <topic>       authoring, browser-support, color, elevation, getting-started, icons, illustrations, internationalization, layout, migration, motion, principles, shape, spacing, styling-libraries, styling, theme, tokens, typography, working-with-ai
  docs cli           commands, API reference, integration authoring (one level at a time)
  swizzle <Name>     eject component source for deep customization
  upgrade --from <old version> --apply   run after any Astryx or integration dependency bump
<!-- ASTRYX:END -->
