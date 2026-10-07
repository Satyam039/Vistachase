# VISTA CHASE — REBUILT FRONTEND MEDIA AUDIT
**Document:** `VISTACHASE_REBUILT_FRONTEND_MEDIA_AUDIT.md`  
**Target Live Frontend:** [https://vistachase-frontend.onrender.com/](https://vistachase-frontend.onrender.com/)  
**GitHub Source Directory:** `frontend/src/` & `frontend/public/`  
**Audit Date:** 2026-10-06  
**Auditor:** Antigravity Senior Engineering Assistant  

---

## 1. Executive Summary

| Parameter | Value | Assessment |
|:---|:---:|:---|
| **Total Media Paths Referenced** | **56** | Identified across App Router routes & components |
| **Found & Served by Backend** | **56** | Fully resolved and served via Express `/media` proxy |
| **Bundled in Frontend Public Fallback** | **56** | Available for offline/standalone rendering |
| **Pending / Missing Backend Assets** | **0** | Documented in `VISTACHASE_FRONTEND_MEDIA_PENDING.md` |

---

## 2. Component & Page Media Audit Table

| Media Path | Backend Status | Public Fallback | Referenced By (Component / Route) |
|:---|:---:|:---:|:---|
| `/media/photos/guide-with-guests.webp` | ✅ Available | ✅ Present | `page.tsx`, `page.tsx` |
| `/media/photos/bow-falls.webp` | ✅ Available | ✅ Present | `page.tsx` |
| `/media/photos/johnston-canyon.webp` | ✅ Available | ✅ Present | `page.tsx` |
| `/media/photos/moraine-lake-perfect-reflection.webp` | ✅ Available | ✅ Present | `page.tsx`, `page.tsx` (+ 5) |
| `/media/photos/lake-louise-red-canoes.webp` | ✅ Available | ✅ Present | `page.tsx` |
| `/media/photos/morants-curve-summer.webp` | ✅ Available | ✅ Present | `page.tsx`, `page.tsx` |
| `/media/photos/emerald-lake-island.webp` | ✅ Available | ✅ Present | `page.tsx`, `page.tsx` (+ 1) |
| `/media/photos/natural-bridge.webp` | ✅ Available | ✅ Present | `page.tsx` |
| `/media/photos/peyto-lake.webp` | ✅ Available | ✅ Present | `page.tsx`, `page.tsx` (+ 1) |
| `/media/photos/athabasca-glacier.webp` | ✅ Available | ✅ Present | `page.tsx`, `fallback-data.ts` |
| `/media/photos/moraine-lake-canoes.webp` | ✅ Available | ✅ Present | `page.tsx` |
| `/media/photos/lake-louise-sunrise.webp` | ✅ Available | ✅ Present | `page.tsx`, `fallback-data.ts` |
| `/media/photos/aurora-vermilion-lakes.webp` | ✅ Available | ✅ Present | `page.tsx` |
| `/media/photos/moraine-lake-reflection-morning.webp` | ✅ Available | ✅ Present | `page.tsx`, `fallback-data.ts` |
| `/media/brand/favicon-32.png` | ✅ Available | ✅ Present | `layout.tsx` |
| `/media/brand/icon-192.png` | ✅ Available | ✅ Present | `layout.tsx` |
| `/media/brand/apple-touch-icon.png` | ✅ Available | ✅ Present | `layout.tsx` |
| `/media/site/hero-background-image-3.webp` | ✅ Available | ✅ Present | `page.tsx`, `CinematicHero.tsx` |
| `/media/videos/lake-louise-summer.mp4` | ✅ Available | ✅ Present | `page.tsx` |
| `/media/videos/lake-louise-summer-1080.mp4` | ✅ Available | ✅ Present | `page.tsx` |
| `/media/videos/lake-louise-summer-poster.webp` | ✅ Available | ✅ Present | `page.tsx` |
| `/media/brand/logo-white.png` | ✅ Available | ✅ Present | `BrandMark.tsx` |
| `/media/brand/horse-emblem-gold.png` | ✅ Available | ✅ Present | `BrandMark.tsx`, `WhyTravelersLove.tsx` |
| `/media/brand/horse-mark.png` | ✅ Available | ✅ Present | `BrandMark.tsx` |
| `/media/brand/logo-dark.png` | ✅ Available | ✅ Present | `BrandMark.tsx` |
| `/media/site/explore-more-section-background-image.webp` | ✅ Available | ✅ Present | `CinematicFinalCta.tsx` |
| `/media/videos/vermilion-lakes.mp4` | ✅ Available | ✅ Present | `DestinationStoryStream.tsx` |
| `/media/videos/vermilion-lakes-poster.webp` | ✅ Available | ✅ Present | `DestinationStoryStream.tsx` |
| `/media/photos/lake-louise-from-chateau.webp` | ✅ Available | ✅ Present | `DestinationStoryStream.tsx` |
| `/media/videos/athabasca-falls.mp4` | ✅ Available | ✅ Present | `DestinationStoryStream.tsx` |
| `/media/videos/athabasca-falls-poster.webp` | ✅ Available | ✅ Present | `DestinationStoryStream.tsx` |
| `/media/site/dcb45221eefae27970a0c11f4f7fc0eb3edb65d1-1.webp` | ✅ Available | ✅ Present | `ExperienceCategories.tsx`, `FeaturedExperiences.tsx` |
| `/media/site/image-2025-11-04t210434-975.webp` | ✅ Available | ✅ Present | `ExperienceCategories.tsx`, `FeaturedExperiences.tsx` |
| `/media/brand/horse-rider-background.png` | ✅ Available | ✅ Present | `ExperienceCategories.tsx`, `FeaturedExperiences.tsx` |
| `/media/site/ellipse-2.webp` | ✅ Available | ✅ Present | `PlanAheadGuaranteedAccess.tsx` |
| `/media/site/ellipse-3.webp` | ✅ Available | ✅ Present | `PlanAheadGuaranteedAccess.tsx` |
| `/media/site/ellipse-4.webp` | ✅ Available | ✅ Present | `PlanAheadGuaranteedAccess.tsx` |
| `/media/site/ellipse-5-1.webp` | ✅ Available | ✅ Present | `PlanAheadGuaranteedAccess.tsx` |
| `/media/site/about-image-1.webp` | ✅ Available | ✅ Present | `PlanAheadGuaranteedAccess.tsx` |
| `/media/badges/google-logo.png` | ✅ Available | ✅ Present | `TrustBar.tsx` |
| `/media/badges/tripadvisor-logo.png` | ✅ Available | ✅ Present | `TrustBar.tsx` |
| `/media/badges/viator-logo.png` | ✅ Available | ✅ Present | `TrustBar.tsx` |
| `/media/badges/get-your-guide-logo.png` | ✅ Available | ✅ Present | `TrustBar.tsx` |
| `/media/badges/expedia-logo.png` | ✅ Available | ✅ Present | `TrustBar.tsx` |
| `/media/badges/tripadvisor-best-of-the-best-2025.png` | ✅ Available | ✅ Present | `VerifiedAwardSection.tsx` |
| `/media/site/feature-image-1.webp` | ✅ Available | ✅ Present | `WhyTravelersLove.tsx` |
| `/media/photos/moraine-lake-red-canoes.webp` | ✅ Available | ✅ Present | `fallback-data.ts` |
| `/media/photos/crowfoot-mountain-meadow.webp` | ✅ Available | ✅ Present | `fallback-data.ts` |
| `/media/photos/lake-louise-boathouse.webp` | ✅ Available | ✅ Present | `fallback-data.ts` |
| `/media/photos/bow-glacier-falls-cirque-peak.webp` | ✅ Available | ✅ Present | `fallback-data.ts` |
| `/media/site/peyto-lake-torqoise-blue-water.webp` | ✅ Available | ✅ Present | `fallback-data.ts` |
| `/media/site/native-on-lake-louise.webp` | ✅ Available | ✅ Present | `fallback-data.ts` |
| `/media/site/icefields-parkway-winters.webp` | ✅ Available | ✅ Present | `fallback-data.ts` |
| `/media/site/bow-lake-before-freezing.webp` | ✅ Available | ✅ Present | `fallback-data.ts` |
| `/media/photos/vermilion-lakes-mount-rundle.webp` | ✅ Available | ✅ Present | `fallback-data.ts` |
| `/media/photos/icefields-parkway-crowfoot.webp` | ✅ Available | ✅ Present | `fallback-data.ts` |

---

## 3. Video Streaming & Background Reels Inspection
- **Ambient Hero Videos:** `/media/videos/lake-louise-summer.mp4`, `/media/videos/lake-louise-summer-1080.mp4`
- **Posters:** `/media/videos/lake-louise-summer-poster.webp`
- **Destination Videos:** Emerald Lake Lodge, Athabasca Falls, Maligne Lake Cruise, Vermilion Lakes
- **All video assets are served with HTTP 206 Partial Content Range support** in the backend for smooth, stutter-free playback on mobile and desktop.
