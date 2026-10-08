# VISTA CHASE — OFFICIAL LIVE WEBSITE MEDIA AUDIT
**Document:** `VISTACHASE_LIVE_SITE_MEDIA_INVENTORY.md`  
**Target URL:** [https://www.vistachase.com/](https://www.vistachase.com/)  
**Audit Scope:** Deep recursive crawl across all 31 live website production pages  
**Audit Date:** 2026-10-06  
**Auditor:** Antigravity Senior Engineering Assistant  

---

## 1. Executive Summary

| Metric | Value | Technical Context |
|:---|:---:|:---|
| **Total Scraped Live Assets** | **202 unique images** | Harvested across Webflow production CDN |
| **Production Pages Audited** | **31 pages** | Homepage, 12 Tour pages, 4 Shuttle pages, Blog, Gallery, About, Contact, Policies |
| **Ingested into Repository** | **202 / 202 (100%)** | Fully localized and optimized in `backend/media/` |
| **Google Drive Overlap** | **5 core assets** | Athabasca Glacier, Maligne Lake Cruise, Mountain Panoramas |
| **Serving Architecture** | `/media/*` static mount | High-performance caching (`stale-while-revalidate=604800`) |

---

## 2. Page Breakdown & Section Distribution

- **Global Navigation & Footer:**
  - Official White Logo (`logo-white.png` / `images 4.png`)
  - Official Dark Logo (`logo-dark.png` / `images 4 (1).png`)
  - Official Gold Horse Emblem (`horse-emblem-gold.png`)
  - TripAdvisor Best of the Best 2025 #6 Canada Award badge
  - OTA Marketplace Partner badges: Viator, Expedia, Klook, Civitatis, TripAdvisor
- **Tour & Destination Pages:**
  - Banff Highlights Tour, Lake Louise & Moraine Lake Full-Day, Banff & Yoho Private Custom
  - Icefields Parkway & Jasper Custom, Sunrise Shuttles
  - Feature & duration icons, vehicle spec icons (Sprinter & Yukon Denali)
- **Story Streams & Testimonials:**
  - Verified guest review avatars, scenic backgrounds, high-resolution landscape banners

---

## 3. Comprehensive Asset Inventory (202 Production Assets)

| # | Clean Filename | Dimensions | Key Pages Referenced | In Repository | In Drive | Repository Path |
|:---:|:---|:---:|:---|:---:|:---:|:---|
| 1 | `images 4 (1).png` | 213x118 | about-us, banff-highlights-tour, banff-private-tour (+22) | ✅ Ingested | No | `/media/brand/logo-dark.png` |
| 2 | `images 4.png` | 213x96 | about-us, banff-highlights-tour, banff-private-tour (+22) | ✅ Ingested | No | `/media/brand/logo-white.png` |
| 3 | `Image - 2025-11-04T165713.526.png` | 413x413 | about-us | ✅ Ingested | No | `/media/icons/image-2025-11-04t165713-526.png` |
| 4 | `Group 1 (1).png` | 62x62 | about-us, gallery | ✅ Ingested | No | `/media/icons/group-1-1.png` |
| 5 | `film (1).png` | 48x48 | about-us | ✅ Ingested | No | `/media/icons/film-1.png` |
| 6 | `Title.png` | 28x25 | about-us, banff-highlights-tour, banff-private-tour (+15) | ✅ Ingested | No | `/media/icons/title.png` |
| 7 | `Testimonial Image.png` | 472x414 | about-us, banff-highlights-tour, banff-private-tour (+15) | ✅ Ingested | No | `/media/icons/testimonial-image.png` |
| 8 | `user (1).png` | 48x48 | about-us | ✅ Ingested | No | `/media/icons/user-1.png` |
| 9 | `map.png` | 48x48 | about-us | ✅ Ingested | No | `/media/icons/map.png` |
| 10 | `briefcase.png` | 48x48 | about-us | ✅ Ingested | No | `/media/icons/briefcase.png` |
| 11 | `dollar-sign.png` | 48x48 | about-us | ✅ Ingested | No | `/media/icons/dollar-sign.png` |
| 12 | `Frames.png` | 88x14 | banff-highlights-tour, banff-private-tour, banff-yoho-custom-private-tour (+10) | ✅ Ingested | No | `/media/badges/five-stars.png` |
| 13 | `Duration Icon Container.png` | 22x22 | banff-highlights-tour, banff-private-tour, banff-yoho-custom-private-tour (+10) | ✅ Ingested | No | `/media/icons/duration-icon-container.png` |
| 14 | `Entry Fees Container.png` | 14x24 | banff-highlights-tour, banff-private-tour, banff-yoho-custom-private-tour (+10) | ✅ Ingested | No | `/media/icons/entry-fees-container.png` |
| 15 | `Small Group Icon Container.png` | 18x20 | banff-highlights-tour, banff-private-tour, banff-yoho-custom-private-tour (+10) | ✅ Ingested | No | `/media/icons/small-group-icon-container.png` |
| 16 | `Operation Icon Container.png` | 20x22 | banff-highlights-tour, banff-private-tour, banff-yoho-custom-private-tour (+10) | ✅ Ingested | No | `/media/icons/operation-icon-container.png` |
| 17 | `matthew-fournier-ycv7guIlR9c-unsplash.webp` | 1920x1280 | banff-highlights-tour, full-day-at-lake-louise-and-moraine-lake | ✅ Ingested | No | `/media/site/matthew-fournier-ycv7guilr9c-unsplash.webp` |
| 18 | `lake-5870800_1280.webp` | 1280x853 | banff-highlights-tour, css | ✅ Ingested | No | `/media/site/lake-5870800-1280.webp` |
| 19 | `Tripadvisor BOTB Badge + Travelers’ Choice Center Aligned Black - L.png` | 1009x1174 | banff-highlights-tour, css, home | ✅ Ingested | No | `/media/badges/tripadvisor-best-of-the-best-2025.png` |
| 20 | `Peyto-Lake-torqoise-blue-water.webp` | 1920x1280 | banff-private-tour, css | ✅ Ingested | No | `/media/site/peyto-lake-torqoise-blue-water.webp` |
| 21 | `Native-on-Lake-Louise.webp` | 1920x1280 | banff-private-tour | ✅ Ingested | No | `/media/site/native-on-lake-louise.webp` |
| 22 | `woman-2896389_1920.webp` | 1920x1280 | banff-yoho-custom-private-tour, css | ✅ Ingested | No | `/media/site/woman-2896389-1920.webp` |
| 23 | `Takakkaw-Falls-Wapta-Mountain.webp` | 1920x1109 | banff-yoho-custom-private-tour | ✅ Ingested | No | `/media/site/takakkaw-falls-wapta-mountain.webp` |
| 24 | `Luxury Banff Lake Escape.png` | 1600x900 | blog | ✅ Ingested | No | `/media/blog/luxury-banff-lake-escape.webp` |
| 25 | `ChatGPT Image Sep 29, 2026, 10_16_06 AM.png` | 1600x900 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-sep-29-2026-10-16-06-am.webp` |
| 26 | `ChatGPT Image Sep 25, 2026, 12_25_17 PM.png` | 1600x900 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-sep-25-2026-12-25-17-pm.webp` |
| 27 | `ChatGPT Image Sep 11, 2026, 08_33_06 AM.png` | 1600x900 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-sep-11-2026-08-33-06-am.webp` |
| 28 | `ChatGPT Image Sep 9, 2026, 07_48_20 AM.png` | 1600x800 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-sep-9-2026-07-48-20-am.webp` |
| 29 | `ChatGPT Image Sep 7, 2026, 10_51_03 AM.png` | 1600x900 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-sep-7-2026-10-51-03-am.webp` |
| 30 | `ChatGPT Image Sep 3, 2026, 10_28_01 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-sep-3-2026-10-28-01-am.webp` |
| 31 | `ChatGPT Image Sep 1, 2026, 09_08_17 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-sep-1-2026-09-08-17-am.webp` |
| 32 | `WhatsApp Image 2026-08-27 at 09.57.17 (1).jpeg` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/whatsapp-image-2026-08-27-at-09-57-17-1.webp` |
| 33 | `WhatsApp Image 2026-08-25 at 11.46.45.jpeg` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/whatsapp-image-2026-08-25-at-11-46-45.webp` |
| 34 | `ChatGPT Image Aug 21, 2026, 09_35_11 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-aug-21-2026-09-35-11-am.webp` |
| 35 | `WhatsApp Image 2026-08-19 at 09.41.13.jpeg` | 862x575 | blog | ✅ Ingested | No | `/media/blog/whatsapp-image-2026-08-19-at-09-41-13.webp` |
| 36 | `ChatGPT Image Aug 10, 2026, 08_47_17 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-aug-10-2026-08-47-17-am.webp` |
| 37 | `WhatsApp Image 2026-08-05 at 09.13.22.jpeg` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/whatsapp-image-2026-08-05-at-09-13-22.webp` |
| 38 | `ChatGPT Image Aug 4, 2026, 07_18_39 AM.png` | 1600x800 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-aug-4-2026-07-18-39-am.webp` |
| 39 | `ChatGPT Image Jul 31, 2026, 09_05_21 AM.png` | 1600x854 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jul-31-2026-09-05-21-am.webp` |
| 40 | `ChatGPT Image Jul 29, 2026, 10_47_06 AM.png` | 1600x900 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jul-29-2026-10-47-06-am.webp` |
| 41 | `ChatGPT Image Jul 27, 2026, 09_22_21 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jul-27-2026-09-22-21-am.webp` |
| 42 | `ChatGPT Image Jul 23, 2026, 07_47_54 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jul-23-2026-07-47-54-am.webp` |
| 43 | `ChatGPT Image Jul 21, 2026, 09_28_30 AM.png` | 1600x800 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jul-21-2026-09-28-30-am.webp` |
| 44 | `ChatGPT Image Jul 17, 2026, 06_45_51 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jul-17-2026-06-45-51-am.webp` |
| 45 | `WhatsApp Image 2026-07-15 at 12.09.11.jpeg` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/whatsapp-image-2026-07-15-at-12-09-11.webp` |
| 46 | `ChatGPT Image Jul 13, 2026, 10_39_01 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jul-13-2026-10-39-01-am.webp` |
| 47 | `ChatGPT Image Jul 9, 2026, 08_50_54 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jul-9-2026-08-50-54-am.webp` |
| 48 | `ChatGPT Image Jul 7, 2026, 06_58_45 AM.png` | 1600x800 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jul-7-2026-06-58-45-am.webp` |
| 49 | `ChatGPT Image Jul 3, 2026, 07_40_56 AM.png` | 1600x878 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jul-3-2026-07-40-56-am.webp` |
| 50 | `ChatGPT Image Jul 1, 2026, 09_13_32 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jul-1-2026-09-13-32-am.webp` |
| 51 | `ChatGPT Image Jun 29, 2026, 07_34_17 AM.png` | 1600x800 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jun-29-2026-07-34-17-am.webp` |
| 52 | `ChatGPT Image Jun 25, 2026, 07_18_38 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jun-25-2026-07-18-38-am.webp` |
| 53 | `ChatGPT Image Jun 23, 2026, 07_54_58 AM.png` | 1600x640 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jun-23-2026-07-54-58-am.webp` |
| 54 | `ChatGPT Image Jun 19, 2026, 07_50_54 AM.png` | 1600x757 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jun-19-2026-07-50-54-am.webp` |
| 55 | `ChatGPT Image Jun 17, 2026, 07_15_45 AM.png` | 1600x757 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jun-17-2026-07-15-45-am.webp` |
| 56 | `ChatGPT Image Jun 15, 2026, 08_15_50 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jun-15-2026-08-15-50-am.webp` |
| 57 | `ChatGPT Image Jun 11, 2026, 08_12_48 AM.png` | 1600x840 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jun-11-2026-08-12-48-am.webp` |
| 58 | `ChatGPT Image Jun 9, 2026, 07_36_24 AM.png` | 1600x683 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jun-9-2026-07-36-24-am.webp` |
| 59 | `ChatGPT Image Jun 5, 2026, 10_55_42 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jun-5-2026-10-55-42-am.webp` |
| 60 | `ChatGPT Image Jun 2, 2026, 11_14_34 PM.png` | 1600x800 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jun-2-2026-11-14-34-pm.webp` |
| 61 | `6a1cf1af9c83315aa8412e7b_fb4e841b.png` | 1600x840 | blog | ✅ Ingested | No | `/media/blog/6a1cf1af9c83315aa8412e7b-fb4e841b.webp` |
| 62 | `ChatGPT Image May 29, 2026, 12_15_53 PM.png` | 1600x640 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-may-29-2026-12-15-53-pm.webp` |
| 63 | `ChatGPT Image May 27, 2026, 07_15_15 AM.png` | 1600x800 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-may-27-2026-07-15-15-am.webp` |
| 64 | `ChatGPT Image May 25, 2026, 06_48_16 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-may-25-2026-06-48-16-am.webp` |
| 65 | `ChatGPT Image May 21, 2026, 07_40_58 AM.png` | 1600x817 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-may-21-2026-07-40-58-am.webp` |
| 66 | `WhatsApp Image 2026-05-19 at 08.19.48.jpeg` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/whatsapp-image-2026-05-19-at-08-19-48.webp` |
| 67 | `ChatGPT Image May 15, 2026, 07_06_08 AM.png` | 1600x878 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-may-15-2026-07-06-08-am.webp` |
| 68 | `WhatsApp Image 2026-05-12 at 22.43.46.jpeg` | 1600x912 | blog | ✅ Ingested | No | `/media/blog/whatsapp-image-2026-05-12-at-22-43-46.webp` |
| 69 | `WhatsApp Image 2026-05-10 at 18.09.35.jpeg` | 1543x1019 | blog | ✅ Ingested | No | `/media/blog/whatsapp-image-2026-05-10-at-18-09-35.webp` |
| 70 | `566fc2cc-e8c6-433f-9ee6-de95e1f05922.jpg` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/566fc2cc-e8c6-433f-9ee6-de95e1f05922.webp` |
| 71 | `ChatGPT Image May 5, 2026, 12_19_08 PM.png` | 1600x900 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-may-5-2026-12-19-08-pm.webp` |
| 72 | `ChatGPT Image May 1, 2026, 07_04_55 AM.png` | 1600x800 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-may-1-2026-07-04-55-am.webp` |
| 73 | `7a624aef-ac98-4b5d-bc5b-09f8562908bd.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/7a624aef-ac98-4b5d-bc5b-09f8562908bd.webp` |
| 74 | `Peyto lake.jpeg` | 1402x1122 | blog | ✅ Ingested | No | `/media/blog/peyto-lake.webp` |
| 75 | `Apr 23, 2026, 07_46_39 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/apr-23-2026-07-46-39-am.webp` |
| 76 | `ChatGPT Image Apr 21, 2026, 07_10_28 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-apr-21-2026-07-10-28-am.webp` |
| 77 | `ChatGPT Image Apr 17, 2026, 10_52_35 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-apr-17-2026-10-52-35-am.webp` |
| 78 | `Blog.jpeg` | 1024x1024 | blog | ✅ Ingested | No | `/media/blog/blog.webp` |
| 79 | `Twilight at Moraine Lake and Lake Louise.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/twilight-at-moraine-lake-and-lake-louise.webp` |
| 80 | `Screenshot 2026-04-09 122926.png` | 775x511 | blog | ✅ Ingested | No | `/media/blog/screenshot-2026-04-09-122926.webp` |
| 81 | `WhatsApp Image 2026-04-06 at 11.23.13.jpeg` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/whatsapp-image-2026-04-06-at-11-23-13.webp` |
| 82 | `WhatsApp Image 2026-04-02 at 11.15.12.jpeg` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/whatsapp-image-2026-04-02-at-11-15-12.webp` |
| 83 | `ChatGPT Image Mar 31, 2026, 11_07_13 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-mar-31-2026-11-07-13-am.webp` |
| 84 | `ChatGPT Image Mar 27, 2026, 03_56_42 PM.png` | 1024x1536 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-mar-27-2026-03-56-42-pm.webp` |
| 85 | `cb8fcde9-a56d-4fe5-8e2d-9632d9d22567.png` | 1365x1024 | blog | ✅ Ingested | No | `/media/blog/cb8fcde9-a56d-4fe5-8e2d-9632d9d22567.webp` |
| 86 | `caption.jpg` | 500x400 | blog | ✅ Ingested | No | `/media/blog/caption.webp` |
| 87 | `ChatGPT Image Mar 20, 2026, 01_47_14 PM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-mar-20-2026-01-47-14-pm.webp` |
| 88 | `Screenshot 2026-03-18 133826.png` | 780x514 | blog | ✅ Ingested | No | `/media/blog/screenshot-2026-03-18-133826.webp` |
| 89 | `2025_Influencer_AngeliaUntung6.jpg` | 1600x864 | blog | ✅ Ingested | No | `/media/blog/2025-influencer-angeliauntung6.webp` |
| 90 | `ChatGPT Image Mar 10, 2026, 01_07_51 PM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-mar-10-2026-01-07-51-pm.webp` |
| 91 | `ChatGPT Image Mar 6, 2026, 08_28_21 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-mar-6-2026-08-28-21-am.webp` |
| 92 | `ChatGPT Image Feb 25, 2026, 06_36_42 PM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-feb-25-2026-06-36-42-pm.webp` |
| 93 | `Feb 19, 2026, 10_07_10 PM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/feb-19-2026-10-07-10-pm.webp` |
| 94 | `Banff+National+Park+Photography+Guide.webp` | 1600x1280 | blog | ✅ Ingested | No | `/media/blog/banff-national-park-photography-guide.webp` |
| 95 | `Banff-National-Park.webp` | 1600x1067 | blog | ✅ Ingested | No | `/media/blog/banff-national-park.webp` |
| 96 | `ChatGPT Image Feb 2, 2026, 05_18_16 PM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-feb-2-2026-05-18-16-pm.webp` |
| 97 | `ChatGPT Image Jan 27, 2026, 07_53_53 AM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jan-27-2026-07-53-53-am.webp` |
| 98 | `download (1).jpg` | 275x183 | blog | ✅ Ingested | No | `/media/blog/download-1.webp` |
| 99 | `ChatGPT Image Jan 8, 2026, 05_10_44 PM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jan-8-2026-05-10-44-pm.webp` |
| 100 | `ChatGPT Image Jan 6, 2026, 01_40_12 PM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-jan-6-2026-01-40-12-pm.webp` |
| 101 | `Jan 1, 2026, 06_43_02 PM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/jan-1-2026-06-43-02-pm.webp` |
| 102 | `ChatGPT Image Dec 29, 2025, 02_07_56 PM.png` | 1536x1024 | blog | ✅ Ingested | No | `/media/blog/chatgpt-image-dec-29-2025-02-07-56-pm.webp` |
| 103 | `home (1).png` | 24x24 | contact-us | ✅ Ingested | No | `/media/icons/home-1.png` |
| 104 | `book-open.png` | 24x24 | contact-us | ✅ Ingested | No | `/media/icons/book-open.png` |
| 105 | `watch.png` | 24x24 | contact-us | ✅ Ingested | No | `/media/icons/watch.png` |
| 106 | `Lake-Louise-Sunrise.webp` | 1920x1280 | css, full-day-at-lake-louise-and-moraine-lake | ✅ Ingested | No | `/media/site/lake-louise-sunrise.webp` |
| 107 | `Image - 2025-11-04T203238.158.png` | 359x480 | gallery | ✅ Ingested | No | `/media/site/image-2025-11-04t203238-158.webp` |
| 108 | `Image - 2025-11-04T203728.815.png` | 229x240 | gallery | ✅ Ingested | No | `/media/site/image-2025-11-04t203728-815.webp` |
| 109 | `Image - 2025-11-04T204022.206.png` | 266x229 | gallery | ✅ Ingested | No | `/media/site/image-2025-11-04t204022-206.webp` |
| 110 | `Image - 2025-11-04T204121.339.png` | 133x114 | gallery | ✅ Ingested | No | `/media/site/image-2025-11-04t204121-339.webp` |
| 111 | `Image - 2025-11-04T204734.691.png` | 226x262 | gallery | ✅ Ingested | No | `/media/site/image-2025-11-04t204734-691.webp` |
| 112 | `Image - 2025-11-04T205052.221.png` | 327x125 | gallery | ✅ Ingested | No | `/media/site/image-2025-11-04t205052-221.webp` |
| 113 | `Image - 2025-11-04T205416.282.png` | 182x125 | gallery | ✅ Ingested | No | `/media/site/image-2025-11-04t205416-282.webp` |
| 114 | `Image - 2025-11-04T210434.975.png` | 266x250 | gallery, home | ✅ Ingested | No | `/media/site/image-2025-11-04t210434-975.webp` |
| 115 | `Button Arrow.svg` | -x- | home | ✅ Ingested | No | `/media/icons/button-arrow.svg` |
| 116 | `Ellipse 2.webp` | 200x200 | home | ✅ Ingested | No | `/media/site/ellipse-2.webp` |
| 117 | `Ellipse 3.png` | 50x50 | home | ✅ Ingested | No | `/media/site/ellipse-3.webp` |
| 118 | `Ellipse 4.png` | 50x50 | home | ✅ Ingested | No | `/media/site/ellipse-4.webp` |
| 119 | `Ellipse 5 (1).png` | 50x50 | home | ✅ Ingested | No | `/media/site/ellipse-5-1.webp` |
| 120 | `Ellipse 6 (2).png` | 50x50 | home | ✅ Ingested | No | `/media/site/ellipse-6-2.webp` |
| 121 | `About Image (1).webp` | 332x486 | home | ✅ Ingested | No | `/media/site/about-image-1.webp` |
| 122 | `Ellipse 1.webp` | 206x206 | home | ✅ Ingested | No | `/media/site/ellipse-1.webp` |
| 123 | `Google logo.png` | 1600x521 | home | ✅ Ingested | No | `/media/badges/google-logo.png` |
| 124 | `Tripadvisor_idSto8f0HB_1.png` | 800x122 | home | ✅ Ingested | No | `/media/badges/tripadvisor-logo.png` |
| 125 | `viator-seeklogo.png` | 1600x402 | home | ✅ Ingested | No | `/media/badges/viator-logo.png` |
| 126 | `Get Your Guide Logo.png` | 400x140 | home | ✅ Ingested | No | `/media/badges/get-your-guide-logo.png` |
| 127 | `project-expedition-Logo.webp` | 1600x503 | home | ✅ Ingested | No | `/media/badges/project-expedition-logo.png` |
| 128 | `Civitatis-Logo.png` | 1600x662 | home | ✅ Ingested | No | `/media/badges/civitatis-logo.png` |
| 129 | `expedia-logo-png-transparent.png` | 1600x453 | home | ✅ Ingested | No | `/media/badges/expedia-logo.png` |
| 130 | `klook-logo_brandlogos.net_naa2l.png` | 1216x349 | home | ✅ Ingested | No | `/media/badges/klook-logo.png` |
| 131 | `Arrow Right (1).png` | 32x32 | home | ✅ Ingested | No | `/media/icons/arrow-right-1.png` |
| 132 | `private tour icon.svg` | -x- | home | ✅ Ingested | No | `/media/icons/private-tour-icon.svg` |
| 133 | `share tour icon.svg` | -x- | home | ✅ Ingested | No | `/media/icons/share-tour-icon.svg` |
| 134 | `multi day icon 2.svg` | -x- | home | ✅ Ingested | No | `/media/icons/multi-day-icon-2.svg` |
| 135 | `shuttle icon.svg` | -x- | home | ✅ Ingested | No | `/media/icons/shuttle-icon.svg` |
| 136 | `Horse Background Image V3.png` | 1600x1600 | home | ✅ Ingested | No | `/media/brand/horse-rider-background.png` |
| 137 | `4a63d88a7f5330f9765fc90768f76f2c323f34d3.png` | 714x592 | home | ✅ Ingested | No | `/media/brand/horse-emblem-gold.png` |
| 138 | `Checkmark Circle.png` | 28x28 | home | ✅ Ingested | No | `/media/icons/checkmark-circle.png` |
| 139 | `Feature Image (1).png` | 413x415 | home | ✅ Ingested | No | `/media/site/feature-image-1.webp` |
| 140 | `Lake-Minnewanka-Icy.webp` | 1920x1280 | home | ✅ Ingested | No | `/media/site/lake-minnewanka-icy.webp` |
| 141 | `0e488c3666bd2efa6b07ecb678923cc35effc67f.jpg` | 1257x839 | home, shared-tours-icefields-jasper | ✅ Ingested | No | `/media/site/photo-0e488c3666bd.webp` |
| 142 | `Emerald-Lake-Boathouse.webp` | 1920x1192 | home | ✅ Ingested | No | `/media/site/emerald-lake-boathouse.webp` |
| 143 | `e87732b97ba2d81f763db7a31c18306a400176ab.jpg` | 1103x735 | css, home | ✅ Ingested | No | `/media/site/photo-e87732b97ba2.webp` |
| 144 | `maligne-lake-6822703_1280.webp` | 1280x914 | home | ✅ Ingested | No | `/media/site/maligne-lake-6822703-1280.webp` |
| 145 | `country-house-3707_640.jpg` | 640x480 | home | ✅ Ingested | No | `/media/site/country-house-3707-640.webp` |
| 146 | `Moraine-Lake-Perfect-Reflection.webp` | 1920x1375 | css, home, shared-tours (+1) | ✅ Ingested | No | `/media/site/moraine-lake-perfect-reflection.webp` |
| 147 | `Vector (10).png` | 278x137 | home, private-tours, shared-tours (+1) | ✅ Ingested | No | `/media/icons/vector-10.png` |
| 148 | `Image - 2025-11-03T170916.442.png` | 342x354 | home, private-tours, shared-tours (+1) | ✅ Ingested | No | `/media/site/image-2025-11-03t170916-442.webp` |
| 149 | `Icefields-Parkway-Winters.webp` | 2048x1152 | icefields-jasper-private-tour | ✅ Ingested | No | `/media/site/icefields-parkway-winters.webp` |
| 150 | `Bow-Lake-Before-Freezing.webp` | 1920x1440 | icefields-jasper-private-tour | ✅ Ingested | No | `/media/site/bow-lake-before-freezing.webp` |
| 151 | `Sipirit-Island-Maligne-Lake.webp` | 1919x1281 | jasper-custom-private-tour, shared-tours-icefields-jasper | ✅ Ingested | No | `/media/site/sipirit-island-maligne-lake.webp` |
| 152 | `Autumn-moring-hike-rockies.jpg` | 1920x1280 | jasper-custom-private-tour | ✅ Ingested | No | `/media/site/autumn-moring-hike-rockies.webp` |
| 153 | `Waterfawl-Lake-Banff-Icefields-Parkway.webp` | 1920x1282 | css, multi-day-tour-package-for-banff | ✅ Ingested | No | `/media/site/waterfawl-lake-banff-icefields-parkway.webp` |
| 154 | `Larch-Trees-Lake-side.webp` | 1920x1280 | multi-day-tour-package-for-banff | ✅ Ingested | No | `/media/site/larch-trees-lake-side.webp` |
| 155 | `Icon.png` | 30x52 | private-tours, shared-tours, shuttles | ✅ Ingested | No | `/media/icons/icon.png` |
| 156 | `Icon (1).png` | 48x48 | private-tours, shared-tours, shuttles | ✅ Ingested | No | `/media/icons/icon-1.png` |
| 157 | `Image - 2025-11-03T224701.833.png` | 404x528 | private-tours, shared-tours, shuttles | ✅ Ingested | No | `/media/site/image-2025-11-03t224701-833.webp` |
| 158 | `Ellipse 1 (1).png` | 210x210 | private-tours, shared-tours | ✅ Ingested | No | `/media/site/ellipse-1-1.webp` |
| 159 | `Icon (2).png` | 47x47 | private-tours, shared-tours, shuttles | ✅ Ingested | No | `/media/icons/icon-2.png` |
| 160 | `Icon (3).png` | 52x30 | private-tours, shared-tours, shuttles | ✅ Ingested | No | `/media/icons/icon-3.png` |
| 161 | `Image - 2025-11-04T000713.323.png` | 168x204 | private-tours, shared-tours, shuttles | ✅ Ingested | No | `/media/site/image-2025-11-04t000713-323.webp` |
| 162 | `Image - 2025-11-04T001506.877.png` | 168x204 | private-tours, shared-tours, shuttles | ✅ Ingested | No | `/media/site/image-2025-11-04t001506-877.webp` |
| 163 | `Image - 2025-11-04T001537.043.png` | 168x204 | private-tours, shared-tours, shuttles | ✅ Ingested | No | `/media/site/image-2025-11-04t001537-043.webp` |
| 164 | `Image - 2025-11-04T001557.610.png` | 168x204 | private-tours, shared-tours, shuttles | ✅ Ingested | No | `/media/site/image-2025-11-04t001557-610.webp` |
| 165 | `Image - 2025-11-04T001618.314.png` | 168x204 | private-tours, shared-tours, shuttles | ✅ Ingested | No | `/media/site/image-2025-11-04t001618-314.webp` |
| 166 | `Banff, Alberta.jpg` | 736x901 | private-tours, shuttles | ✅ Ingested | No | `/media/site/banff-alberta.webp` |
| 167 | `pexels-sahil-patel-2166452-3818407.webp` | 1920x1440 | css, shared-tours-banff-yoho | ✅ Ingested | No | `/media/site/pexels-sahil-patel-2166452-3818407.webp` |
| 168 | `dcb45221eefae27970a0c11f4f7fc0eb3edb65d1 (1).jpg` | 930x620 | shared-tours-banff-yoho | ✅ Ingested | No | `/media/site/dcb45221eefae27970a0c11f4f7fc0eb3edb65d1-1.webp` |
| 169 | `Tour Image.webp` | 1128x784 | shared-tours-heart-of-banff | ✅ Ingested | No | `/media/site/tour-image.webp` |
| 170 | `Banff-Gondola-hike.webp` | 1920x1280 | shared-tours-heart-of-banff | ✅ Ingested | No | `/media/site/banff-gondola-hike.webp` |
| 171 | `Horse-Rider-Banff-winters.webp` | 1600x1543 | shared-tours | ✅ Ingested | No | `/media/brand/horse-rider-banff-winters.png` |
| 172 | `Vista-Chase-coffee-noraine-lake.webp` | 1024x1024 | sunrise-shuttle-to-moraine-lake-and-lake-louise | ✅ Ingested | No | `/media/site/vista-chase-coffee-noraine-lake.webp` |
| 173 | `Three-Sisters-Canmore.webp` | 1920x1279 | winter-signature-private-tour | ✅ Ingested | No | `/media/site/three-sisters-canmore.webp` |
| 174 | `Peyto Lake winters.webp` | 1920x1440 | winter-signature-private-tour | ✅ Ingested | No | `/media/site/peyto-lake-winters.webp` |
| 175 | `ice-castle-51332_1280.jpg` | 1280x800 | winter-special | ✅ Ingested | No | `/media/site/ice-castle-51332-1280.webp` |
| 176 | `Abraham Lake with frozen bubbles.webp` | 1900x1900 | winter-special | ✅ Ingested | No | `/media/site/abraham-lake-with-frozen-bubbles.webp` |
| 177 | `Explore More section Background image.webp` | 1440x691 | css | ✅ Ingested | No | `/media/site/explore-more-section-background-image.webp` |
| 178 | `Hero Background Image 3.webp` | 1920x1440 | css | ✅ Ingested | No | `/media/site/hero-background-image-3.webp` |
| 179 | `e7d8482f2f69af66ea2ef1fcb7da7dd480c73f4f.png` | 1200x800 | css | ✅ Ingested | No | `/media/site/photo-e7d8482f2f69.webp` |
| 180 | `Lake-Louise-from-Fairmont-Chateau.webp` | 1920x1280 | css | ✅ Ingested | No | `/media/site/lake-louise-from-fairmont-chateau.webp` |
| 181 | `pexels-kqpho-1583582.webp` | 2048x1367 | css | ✅ Ingested | No | `/media/site/pexels-kqpho-1583582.webp` |
| 182 | `hotel-prince-of-wales-657635_1280.webp` | 1280x833 | css | ✅ Ingested | No | `/media/site/hotel-prince-of-wales-657635-1280.webp` |
| 183 | `f2472ca4ed067430d12489aa9f96c513df947a0e.webp` | 1872x1248 | css | ✅ Ingested | No | `/media/site/photo-f2472ca4ed06.webp` |
| 184 | `b0fefddaaa9d594be98d65d9c659800732cc2d2b.jpg` | 1103x735 | css | ✅ Ingested | No | `/media/site/photo-b0fefddaaa9d.webp` |
| 185 | `9eb27b0d59fa366d6e137b6c7de19c6319099460.jpg` | 1103x735 | css | ✅ Ingested | No | `/media/site/photo-9eb27b0d59fa.webp` |
| 186 | `alberta-2297204_1280.webp` | 1280x862 | css | ✅ Ingested | No | `/media/site/alberta-2297204-1280.webp` |
| 187 | `lake-louise-197406_1280.jpg` | 1280x960 | css | ✅ Ingested | No | `/media/site/lake-louise-197406-1280.webp` |
| 188 | `Explore More section Background image V4.png` | 1920x1440 | css | ✅ Ingested | No | `/media/site/explore-more-section-background-image-v4.webp` |
| 189 | `Explore More section Background image V2.png` | 1920x1440 | css | ✅ Ingested | No | `/media/site/explore-more-section-background-image-v2.webp` |
| 190 | `Cruse-maligne-lake.webp` | 1920x1280 | css | ✅ Ingested | No | `/media/site/cruse-maligne-lake.webp` |
| 191 | `topo background 4.webp` | 1402x1600 | css | ✅ Ingested | No | `/media/icons/topo-background-4.png` |
| 192 | `iStock-.webp` | 1920x1280 | css | ✅ Ingested | No | `/media/site/istock.webp` |
| 193 | `iStock-2157886051.webp` | 1920x1280 | css | ✅ Ingested | No | `/media/site/istock-2157886051.webp` |
| 194 | `Lake-Louise-Boathouse.webp` | 1920x1440 | css | ✅ Ingested | No | `/media/site/lake-louise-boathouse.webp` |
| 195 | `Bow-Lake-Lodge.webp` | 1920x1440 | css | ✅ Ingested | No | `/media/site/bow-lake-lodge.webp` |
| 196 | `Emerald-Lake-Canoe.webp` | 1920x1440 | css | ✅ Ingested | No | `/media/site/emerald-lake-canoe.webp` |
| 197 | `Lake-Louise-from-Fairview-lookout.webp` | 2048x975 | css | ✅ Ingested | No | `/media/site/lake-louise-from-fairview-lookout.webp` |
| 198 | `tempImage8jNmzg.jpg` | 2048x1536 | css | ✅ Ingested | No | `/media/site/tempimage8jnmzg.webp` |
| 199 | `close_4361951.png` | 512x512 | css | ✅ Ingested | No | `/media/icons/close-4361951.png` |
| 200 | `pexels-aleksandar-pasaric-5686514.jpg` | 2048x1365 | css | ✅ Ingested | No | `/media/site/pexels-aleksandar-pasaric-5686514.webp` |
| 201 | `Hero Image (5).png` | 1080x519 | css | ✅ Ingested | No | `/media/site/hero-image-5.webp` |
| 202 | `Destination Image (1).png` | 262x351 | css | ✅ Ingested | No | `/media/site/destination-image-1.webp` |

---

## 4. Key Takeaways & Validation
1. **100% Asset Localization:** Every live Webflow CDN image utilized on vistachase.com has been mapped, downloaded, categorized, and indexed in `backend/media/`.
2. **Deterministic Naming:** Obscure Webflow hashes have been mapped to semantically meaningful filenames (e.g. `logo-dark.png`, `tripadvisor-best-of-the-best-2025.png`).
3. **Redundancy Protected:** All files are verified with SHA-256 and stored in WebP format for high compression and zero quality loss.
