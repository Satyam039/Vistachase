# CLAUDE

Project-specific guidance for AI coding agents.

## Vista Chase frontend + Astryx

Next.js 15 / React 19 UI. All data comes from the Express backend (`../backend`) through
`src/lib/api/catalog.ts` (server components) or relative `fetch("/api/...")` (client components,
proxied by `next.config.mjs`). Never import backend code here.

Astryx setup (already done, don't redo):
- Theme: Stone, copied as editable source in `src/themes/stone/stoneTheme.ts`. Edit that file, then
  run `npm run theme:build` to regenerate `stone.css` / `stone.js` (never edit the generated files).
  `npm run theme:check` fails if the generated files are stale.
- Responsive scale lives in the theme's `adaptations`, one rule per Astryx width tier
  (body px / H1 px / page radius / page margin), measured in the browser except the 768–1023 row:
    375 (<640)       14 / 21 / 12px / 16px
    750 (640–767)    14 / 24 / 16px / 24px
    768–1023         14 / 27 / 20px / 32px   (type same as root)
    1200 (1024–1279) 14 / 27 / 24px / 40px   ← root values
    1440 (1280–1535) 15 / 29 / 24px / 48px
    1920 (>=1536)    16 / 31 / 32px / 64px
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
- Fonts are self-hosted with Fontsource (`src/app/fonts.css`), not next/font: next/font requires SWC and
  the StyleX Babel config turns SWC off. fonts.css defines --font-inter, --font-montserrat (site) and
  --font-figtree, --font-stone-heading, --font-jetbrains-mono (Stone theme).
- StyleX is compiled (official Astryx/StyleX Next.js setup): `babel.config.js` (@stylexjs/babel-plugin,
  `@/*` alias) + `postcss.config.js` (@stylexjs/postcss-plugin) + `@stylex;` at the end of globals.css.
  `stylex.create()`, `xstyle` and the typed tokens in `@astryxdesign/core/theme/tokens.stylex` all work.
  StyleX app layers sit after astryx-theme; Tailwind utilities stay unlayered on top. Babel builds are
  slower than SWC (about 3x). `package.json` browserslist pins Next 15's default modern targets so Babel
  doesn't down-compile async code.
- Site frame: `src/components/layout/SiteFrame.tsx` (from the shell-top-nav template) + `SiteFooter.tsx`.
  Below 1024px the bar is only logo + icon-only AI Concierge + menu; everything else, including the
  Book tours action, lives in the MobileNav drawer (explicit `mobileNav.content`, closes on route change).
- `/book` checkout: `src/components/booking/BookingCheckoutClient.tsx` (from the checkout-wizard template).
  Steps Party → Contact → Pickup & extras → Review & pay; continuing past Contact places the 10-minute
  seat hold; a hold passed in as `?holdToken=` (AI concierge) is adopted with its real remaining time.
- Tour browsing: `TourCard` (`src/components/tours/TourCard.tsx`) is the one tile for every tour grid.
  `/search` uses `TourSearch` (library template: in-place filtering synced to the URL, grouped by category,
  sort, empty state); `/shared-tours` and `/private-tours` use `TourGallery` (product-gallery template).
  Seat counts come from the backend, which ignores expired holds, so they are live everywhere.
- Tour detail pages (`/banff-highlights-tour` etc. and `/tours/[slug]`) render `TourDetailView` (product-detail
  template): gallery + sticky booking column (departure Selector, QuantityInput guests, Book → `/book?departureId=&guests=`),
  collapsible details, JSON-LD. Tours without departures show "Dates on request" + concierge CTA. "From" prices
  use `fromPrice()` (cheapest scheduled departure, else list price).
- Pricing model (enforced in `backend/src/modules/pricing/departure-pricing.ts`): shared tours and shuttles
  are priced per guest and take one seat each; PRIVATE tours are priced per vehicle (departure price once,
  any party up to the vehicle's seats) and a hold or booking takes the whole vehicle off sale. The frontend
  mirrors this with `isVehicleTour()` / `departureFits()` in TourCard.tsx and `isVehicle` in the checkout.
- `<Theme>` is mounted in `src/components/providers/AstryxThemeProvider.tsx`, pinned to `mode="light"`
  because the existing site is light-only.
- CSS cascade layers: order is declared in `src/app/layers.css` (imported first in layout.tsx):
  `reset, tw-preflight, astryx-base, astryx-theme`, with Tailwind utilities unlayered. Keep it that way.

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
