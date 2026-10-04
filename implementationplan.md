# 🏔️ Vista Chase — Premium Media-Driven Website Rebuild
## Master Phased Implementation Plan

> **Authoritative References:**  
> 1. `https://www.vistachase.com/` (Live production Webflow website)  
> 2. `Vista Chase Revamp Roadmap.pdf` (102 live URLs, 13 Bókun catalog products, 77 blog articles)  
> 3. `https://www.bentleymotors.com/` (Visual & interaction experience reference only — **not** branding/assets)  
> 4. Google Drive Media Folders (Scanned and inventoried in `VISTACHASE_MEDIA_INVENTORY.md` and `MEDIA_ACCESS_REQUIRED.md`)  
>
> **Core Non-Negotiable Architecture:**  
> * **Bókun remains the single booking system of record**. Never replace Bókun or create independent inventory.  
> * **Mornby remains the daily operations layer** (`/admin/operations`).  
> * **Live GPS remains the corridor tracking layer** (`/track/[token]`).  
> * **Controlled AI remains the validated intelligence layer**.

---

## Executive Summary & Design Direction

The Vista Chase digital experience is being elevated into a **luxury Alpine cinema journal**. Inspired by the visual pacing, full-width media storytelling, and restrained elegance of the Bentley Motors experience, the new Vista Chase frontend preserves 100% of Vista Chase’s genuine brand identity (Ocean Teal `#3A9CA6`, Golden Summit `#F5BF03`, Frost White `#F9F9F7`, Obsidian Black `#1C1F23`, and verified TripAdvisor #6 Canada accreditations).

---

## Implementation Phases

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: Audit, Asset Discovery & Token Foundation (Done)   │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: Elevate Design Tokens, Typography & Brand Styling  │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: Build Cinematic Storytelling & Media Components    │
│ (CinematicHero, MediaStory, ScrollReveal, VideoBackground)  │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: Rebuild Cinematic Homepage                         │
│ (Hero, Award, Plan Ahead, Categories, Stories, Testimonials)│
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: Tour & Category Pages (Preserving Bókun Booking)   │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 6: Mobile Optimization & Performance Auditing         │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 7: Automated Verification, Build & Deploy Gate        │
└─────────────────────────────────────────────────────────────┘
```

---

### PHASE 1 — Audit, Media Discovery & Foundations (Complete)
- [x] Full codebase audit of monorepo (`frontend/`, `backend/`, Prisma schema, routes).
- [x] Extraction of live production HTML/CSS from `https://www.vistachase.com/`.
- [x] Scanning and analysis of Google Drive media folders; authored [`MEDIA_ACCESS_REQUIRED.md`](file:///c:/Users/satya/OneDrive/Desktop/VistaChase/MEDIA_ACCESS_REQUIRED.md).
- [x] Authoring of [`VISTACHASE_DESIGN_TOKENS.md`](file:///c:/Users/satya/OneDrive/Desktop/VistaChase/VISTACHASE_DESIGN_TOKENS.md).
- [x] Authoring of [`VISTACHASE_CONTENT_MEDIA_MAP.md`](file:///c:/Users/satya/OneDrive/Desktop/VistaChase/VISTACHASE_CONTENT_MEDIA_MAP.md).
- [x] Authoring of [`VISTACHASE_MEDIA_INVENTORY.md`](file:///c:/Users/satya/OneDrive/Desktop/VistaChase/VISTACHASE_MEDIA_INVENTORY.md).

---

### PHASE 2 — Design System & Tokens Layer
- [ ] **CSS Design Tokens**: Inject genuine Vista Chase tokens (`--color-ocean-teal`, `--color-golden-summit`, `--color-frost-white`, `--color-obsidian-black`, `--color-surface-dark`) into `frontend/src/app/globals.css` and `frontend/tailwind.config.ts`.
- [ ] **Typography System**: Integrate `Montserrat Alternates` for luxury display headings alongside `Inter` for crisp body copy.
- [ ] **Button Primitives**: Implement `GoldenSummitButton` (primary) and `AlpineGlassButton` (secondary) with smooth hover micro-interactions (250–350ms easing).
- [ ] **Adaptive Navigation**: Update `SiteFrame.tsx` header to support transparent-to-solid transition on scroll with verified Vista Chase logos.

---

### PHASE 3 — Cinematic Storytelling Components
Build reusable, performant React/Next.js components:
1. **`CinematicHero`**: Fullscreen media background with dark gradient scrim, fluid headline typography, floating scroll indicator, and dual luxury CTAs.
2. **`MediaStory`**: Multi-section scroll-driven storytelling unit with scale-in media, fade-in editorial typography, eyebrow tags, and contextual CTAs.
3. **`ScrollReveal`**: IntersectionObserver-powered staggered text and card reveal with `prefers-reduced-motion` accessibility support.
4. **`VideoBackground`**: Performant, muted, loop, inline video container with responsive poster fallback.
5. **`DestinationStoryStream`**: Continuous travel presentation moving across Banff, Lake Louise, Moraine Lake, and Icefields Parkway without jarring breaks.
6. **`PremiumCTA`**: Full-bleed Rockies panoramic banner with gold CTA and booking reassurance badges.

---

### PHASE 4 — Cinematic Homepage Rebuild (`frontend/src/app/page.tsx`)
Reconstruct the homepage into an immersive 11-step travel story:
1. **01 — Hero**: *"Discover the Canadian Rockies Your Way"* with full-bleed imagery and luxury CTAs.
2. **02 — Award & Accreditation**: TripAdvisor Travelers' Choice Best of the Best 2025 (**#6 Experience in Canada**) badge and verified review counters.
3. **03 — Plan Ahead & Guaranteed Access**: Moraine Lake & Lake Louise access guarantee with avatar social proof stack.
4. **04 — Experience Pillars**: 4 luxury interactive category cards (Private Tours, Shared Tours, Shuttles, Multi-Day Packages).
5. **05 — Destination Story Stream**: Full-width cinematic scroll transitions through Banff, Lake Louise, Moraine Lake, and Icefields.
6. **06 — Why Travelers Love Vista Chase**: 6 core reasons (Hassle-Free Access, Clean SUVs & Shuttles, Local Guides, Eco-Friendly, 5★ Rated, Secure Booking).
7. **07 — Featured Bókun Experiences**: Real product cards connecting to Bókun booking flows.
8. **08 — Guest Testimonials**: Editorial quote slider featuring real verified reviews (Emily & Jason, Jessica M., Carlos R., etc.).
9. **09 — Real-Time Shuttle Tracking Teaser**: Luxury preview of the WhatsApp T-60 live GPS tracking interface.
10. **10 — Verified Partners Bar**: Google Reviews, TripAdvisor, Viator, GetYourGuide, Expedia trust badges.
11. **11 — Final Cinematic CTA**: *"Your Rockies Story Starts Here"*.

---

### PHASE 5 — Tour & Category Experience Alignment
- [ ] Ensure all 13 bookable products preserve their Bókun calendar widgets and live booking connections.
- [ ] Maintain `/shared-tours`, `/private-tours`, `/shuttles`, and `/multi-day-tour-package-for-banff` routes with verified media and facts rows (duration, price, group size).
- [ ] Verify that customer vouchers retain the prominent **"Track Shuttle Live"** button.

---

### PHASE 6 — Mobile Responsiveness & Performance
- [ ] Validate responsive breakpoints across mobile (375px, 390px, 430px), tablet (768px, 1024px), and desktop (1440px, 1920px).
- [ ] Optimize images with `next/image`, modern WebP compression, and eager priority on hero assets only.
- [ ] Ensure strict adherence to WCAG 2.2 AA accessibility (contrast ratios, keyboard focus rings, semantic tags).

---

### PHASE 7 — Quality Gate & Automated Verification
- [ ] Run backend automated tests (`npm test --prefix backend`): 16/16 test suites passing (53/53 tests green).
- [ ] Run frontend typecheck (`npm run typecheck --prefix frontend`): 0 TypeScript errors.
- [ ] Run backend typecheck (`npm run typecheck --prefix backend`): 0 TypeScript errors.
- [ ] Verify live rendering at `http://localhost:3000`.
- [ ] Commit implementation to local Git with clean commit message.
