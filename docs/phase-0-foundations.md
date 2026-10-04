# Phase 0: decisions and foundations

Status as of 2026-10-04. Phase 0 of the [revamp roadmap](https://claude.ai/artifact/1FpccinAK1gF7Wb7vSPykC): settle the decisions, get Bokun access, build the product mapping table and collect the brand assets, before more page work.

| Item | Status |
|---|---|
| Decisions D1–D6 | D1 and D4 answered, D2/D3/D5/D6 need an owner and an answer (below) |
| Bokun API access (test and live) | **Waiting on Vista Chase.** Placeholders are in place: `BOKUN_*` in `backend/.env.example`, product IDs in the mapping table |
| Webflow CMS export access | **Waiting on Vista Chase** (needed for the 77 blog posts in Phase 3) |
| Product mapping table | Done: `backend/prisma/catalog/product-map.json` (13 products). Bokun IDs TBD, Mornby matches proposed |
| Brand assets: logo, colours, typeface, photography, review badges | Done: all in `backend/media`, served by the backend at `/media` |
| Merge PR #1 as the baseline | Done |

## Decisions

| # | Question | Recommendation | Answer | Owner |
|---|---|---|---|---|
| D1 | Which system takes bookings? | Embed the Bokun widget at launch, then a custom checkout on the Bokun API | **Bokun stays the system of record.** Vista Chase will provide the Bokun product IDs; placeholders until then | Vista Chase |
| D2 | Where do staff operations live? | Keep operations in Mornby; connect Mornby to the Bokun API | Open | TBD |
| D3 | Where does blog and page content live? | Headless CMS if marketing publishes regularly, MDX if only developers edit | Open. Content comes from the live vistachase.com for now | TBD |
| D4 | Brand identity in the new design | Keep the live brand on the Astryx theme | **Live brand colours, the horse-and-rider logo, IBM Plex Sans as the typeface** | Vista Chase |
| D5 | Hosting and cutover from Webflow | Staging domain, then DNS cutover with Webflow kept as fallback | Open | TBD |
| D6 | Which new-only features ship at launch? | Search and pickup finder at launch; concierge, accounts, vouchers after | Open | TBD |

## Bokun access (placeholders)

What Vista Chase needs to send, and where it goes:

| Item | Where it goes |
|---|---|
| API access key and secret key, for the test server (`api.bokuntest.com`) and live (`api.bokun.io`) | `backend/.env`: `BOKUN_API_URL`, `BOKUN_ACCESS_KEY`, `BOKUN_SECRET_KEY` |
| Online sales channel ID used by the website | `backend/.env`: `BOKUN_ONLINE_SALES_CHANNEL_ID` |
| The Bokun experience ID of each product below | `bokunId` in `backend/prisma/catalog/product-map.json`, then `npm run prisma:seed` |

Until then every product has `bokunId: null`; code that needs a Bokun ID uses `pending:<slug>` (`backend/src/modules/bokun/product-map.ts`), and `bokunReadiness()` lists what is still missing.

## Product mapping table

Website page ↔ Bokun product ↔ Mornby tour. Source: `backend/prisma/catalog/product-map.json`. Mornby names come from Mornby › Tours; "proposed" matches need confirming by operations.

| Website page | Title (live site) | Type | Booking | Bokun ID | Mornby tour | Match |
|---|---|---|---|---|---|---|
| [/banff-highlights-tour](https://www.vistachase.com/banff-highlights-tour) | Our Best Selling Banff Shared Tour | Shared | Bokun | `TBD` | Banff Shared DAY TOUR | proposed |
| [/shared-tours-heart-of-banff](https://www.vistachase.com/shared-tours-heart-of-banff) | Heart of Banff Shared Tour | Shared | Bokun | `TBD` | 8 Iconic Stops - Banff in First Class | proposed |
| [/shared-tours-banff-yoho](https://www.vistachase.com/shared-tours-banff-yoho) | Banff + Yoho Most Famous Shared Tour | Shared | Bokun | `TBD` | — | none |
| [/shared-tours-icefields-jasper](https://www.vistachase.com/shared-tours-icefields-jasper) | Icefields Parkway & Jasper Shared Tour | Shared | Bokun | `TBD` | Jasper Shared Tour | proposed |
| [/winter-special](https://www.vistachase.com/winter-special) | Winter Special Shared Tour | Shared | Bokun | `TBD` | — | none |
| [/banff-private-tour](https://www.vistachase.com/banff-private-tour) | Standard Banff Private Best Selling Tour | Private | Bokun | `TBD` | Banff Private Tour | proposed |
| [/icefields-jasper-private-tour](https://www.vistachase.com/icefields-jasper-private-tour) | Icefields Parkway & Jasper Private Tour | Private | Bokun | `TBD` | Jasper & Columbia Icefield Private Day Tour (Private) | proposed |
| [/winter-signature-private-tour](https://www.vistachase.com/winter-signature-private-tour) | Special Winter Private Tour | Private | Bokun | `TBD` | — | none |
| [/banff-yoho-custom-private-tour](https://www.vistachase.com/banff-yoho-custom-private-tour) | Banff & Yoho Customizable Itinerary Private Tour | Private | Enquiry | `TBD` | Private Customizable Banff Tour (Private) | proposed |
| [/jasper-custom-private-tour](https://www.vistachase.com/jasper-custom-private-tour) | Jasper National Park Customizable Private Tour | Private | Enquiry | `TBD` | — | none |
| [/sunrise-shuttle-to-moraine-lake-and-lake-louise](https://www.vistachase.com/sunrise-shuttle-to-moraine-lake-and-lake-louise) | Sunrise Shuttle to Moraine Lake & Lake Louise | Shuttle | Bokun | `TBD` | Moraine Lake & Lake Louise Shuttle | proposed |
| [/full-day-at-lake-louise-and-moraine-lake](https://www.vistachase.com/full-day-at-lake-louise-and-moraine-lake) | Day Shuttle - Moraine Lake & Lake Louise | Shuttle | Bokun | `TBD` | Moraine Lake & Lake Louise Shuttle | proposed |
| [/multi-day-tour-package-for-banff](https://www.vistachase.com/multi-day-tour-package-for-banff) | Multi-Day Canadian Rockies Experience | Multiday | Enquiry | `TBD` | — | none |

In Mornby but not on the website: **Columbia Icefield Adventure - Skywalk + 4 Stops** (shared). Decide whether it gets a page.

## Brand

- **Colours** (the live site's own variable names, `vistachase.com` stylesheet):

  | Live name | Hex | Tailwind token | Use |
  |---|---|---|---|
  | Ocean Teal | `#3A9CA6` | `ocean-500` | Brand accent, icons, highlights |
  | Golden Summit | `#F5BF03` | `summit-500` | Primary buttons, stars, badges |
  | Golden Tint | `#FFE085` | `summit-300` | Hover, accents on dark |
  | Obsidian Black | `#1C1F23` | `obsidian-900` | Text, dark sections |
  | Frost White | `#F9F9F7` | `obsidian-50` | Page background |

  The Astryx theme (`frontend/src/themes/vistachase`) uses a darker Ocean Teal (`#257780`) for buttons and links so white text and links meet WCAG AA; `#3A9CA6` is kept for icons. Hard-coded hex values in the frontend were replaced by these tokens, and the old green/gold palette names (`forest-*`, `gold-*`) now point at the brand colours.
- **Typeface:** IBM Plex Sans for everything (IBM Plex Mono for codes and references), self-hosted with Fontsource.
- **Logo:** `media/brand/logo-dark.png`, `logo-white.png`, `horse-mark.png` (nav), `horse-emblem-gold.png`. The live files are small (213 px wide); a vector master would sharpen them.
- **Review and partner badges:** `media/badges`: TripAdvisor Best of the Best 2025, TripAdvisor, Google, Viator, GetYourGuide, Expedia, Klook, Civitatis, Project Expedition.

## Images

Every image the site uses is in `backend/media` and served by the backend at `/media/...` (the frontend proxies `/media/*` like `/api/*`; `next/image` resizes it). There are no remote image hosts left in the frontend. `backend/media/manifest.json` lists all 321 files with size, alt text, places and tags; `GET /api/media?collection=photos&place=moraine-lake` queries it.

| Collection | Files | From |
|---|---|---|
| photos | 118 | The Vista Chase photo library (`Images/`), resized to 2048 px WebP, each with a title, alt text and places |
| site | 78 | Every photo on the live vistachase.com pages |
| blog | 79 | Live blog thumbnails (for the Phase 3 blog migration) |
| brand | 6 | Logos and brand artwork |
| badges | 10 | Review and partner badges |
| icons | 30 | Live-site icons and decorative graphics |

Each product page shows its live-site photos first, then library photos of the places it visits (`places` and `season` in the mapping table). Destination pages, the gallery and the home page use library photos that match their copy.

Photo library coverage: 72 landscapes, 15 wildlife, 16 fleet, 15 people. Places: banff 69, moraine-lake 18, icefields-parkway 17, jasper 14, lake-louise 13, bow-lake 9, yoho 9, maligne 7, waterton 6, maligne-lake 5, bow-valley-parkway 4, canmore 4, larch-valley 4, peyto-lake 4, vermilion-lakes 3, emerald-lake 3, lake-ohara 3, spirit-island 3.

Gaps worth filling with new photography: only 11 winter photos (the two winter tours show 4 photos each), no photos of guides by name, no photo of the Vista Chase Cadillac with branding.

Left out of the library: `ChatGPT Image Sep 9, 2026 at 09_06_26 PM.png` (AI-generated SUVs on a mountain road), `lake-5870800_1280(1).jpg` (duplicate of lake-5870800_1280.jpg), `moraine-lake-2026-03-17-20-13-39-utc(1).jpg` (duplicate of moraine-lake-2026-03-17-20-13-39-utc.jpg), `新疆.jpg` (Winter river (filename says Xinjiang, China)).

To rebuild after adding photos to `Images/` (and describing them in `backend/scripts/media/photo-catalog.json`):

```bash
cd backend && node scripts/media/build-media.mjs && npm run prisma:seed
```

## Open questions for Vista Chase

1. Bokun API keys (test and live), the online sales channel ID and the 13 product IDs.
2. Confirm the proposed Mornby matches, and whether the Columbia Icefield Skywalk tour gets a page.
3. Webflow CMS export access for the blog.
4. Owners and answers for D2, D3, D5 and D6.
5. Price of the 13-seat van vs the 6-seat SUV for private tours.
6. The vector logo master, and winter, guide and fleet photography.
