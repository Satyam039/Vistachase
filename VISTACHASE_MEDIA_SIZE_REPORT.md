# VISTA CHASE — MEDIA LIBRARY STORAGE & DISK REPORT
**Document:** `VISTACHASE_MEDIA_SIZE_REPORT.md`  
**Target Directory:** `backend/media/`  
**Audit Date:** 2026-10-06  
**Total Assets Cataloged:** 390  
**Total Disk Footprint:** 969.57 MB (1,01,66,70,812 bytes)  

---

## 1. Storage Footprint Comparison (Baseline vs Post-Ingestion)

| Metric | Pre-Audit Baseline | Post-Ingestion Verified | Growth / Delta |
|:---|:---:|:---:|:---:|
| **Total Media Assets** | 345 assets | **390 assets** | **+45 assets** (+13.0%) |
| **Total Disk Usage** | 108.40 MB | **969.57 MB** | **+861.17 MB** (Master RAWs & Video Reels) |
| **Master 8K Photography** | 0 files | **31 files** | +31 files (~380 MB master images) |
| **Master Cinematic Videos** | 10 clips (40 MB) | **16 clips** (490 MB) | +6 master clips |
| **Vector SVGs / Masters** | 0 SVGs | **8 assets** | +8 vector brand assets |

---

## 2. Directory Footprint Breakdown

| Subdirectory | Asset Count | Total Size (MB) | % of Library | Primary Content |
|:---|:---:|:---:|:---:|:---|
| `backend/media/badges` | 10 | 0.23 MB | 0.0% | BADGES assets |
| `backend/media/blog` | 79 | 14.79 MB | 1.5% | BLOG assets |
| `backend/media/brand` | 17 | 9.77 MB | 1.0% | BRAND assets |
| `backend/media/icons` | 30 | 0.57 MB | 0.1% | ICONS assets |
| `backend/media/photos` | 149 | 518.20 MB | 53.4% | PHOTOS assets |
| `backend/media/site` | 78 | 9.68 MB | 1.0% | SITE assets |
| `backend/media/videos` | 27 | 416.32 MB | 42.9% | VIDEOS assets |

---

## 3. Media Type Breakdown

| Media Type | Asset Count | Total Footprint (MB) | Average Size |
|:---|:---:|:---:|:---:|
| **IMAGE** | 371 | 548.94 MB | 1515.1 KB |
| **DOCUMENT** | 2 | 5.68 MB | 2910.1 KB |
| **VIDEO** | 17 | 414.95 MB | 24994.4 KB |

---

## 4. Top 10 Largest Media Assets in Library

| # | Filename | Subdirectory | Size (MB) | Type | Purpose |
|:---:|:---|:---|:---:|:---:|:---|
| 1 | `lake-minnewanka-cruise-master.mp4` | `videos` | 94.33 MB | video | Master production footage / 8K photo |
| 2 | `columbia-icefield-master.mp4` | `videos` | 92.30 MB | video | Master production footage / 8K photo |
| 3 | `glacier-skywalk-master.mp4` | `videos` | 74.79 MB | video | Master production footage / 8K photo |
| 4 | `banff-gondola-scenic-broll.mp4` | `videos` | 59.01 MB | video | Master production footage / 8K photo |
| 5 | `canadian-rockies-vista-5015.jpg` | `photos` | 32.04 MB | image | Master production footage / 8K photo |
| 6 | `pursuit-sherps-snowcoach-04.jpg` | `photos` | 31.97 MB | image | Master production footage / 8K photo |
| 7 | `pursuit-sherps-snowcoach-03.jpg` | `photos` | 31.50 MB | image | Master production footage / 8K photo |
| 8 | `pursuit-sherps-snowcoach-02.jpg` | `photos` | 30.32 MB | image | Master production footage / 8K photo |
| 9 | `pursuit-sherps-snowcoach-01.jpg` | `photos` | 29.17 MB | image | Master production footage / 8K photo |
| 10 | `canadian-rockies-vista-3715.jpg` | `photos` | 29.14 MB | image | Master production footage / 8K photo |

---

## 5. Caching & Delivery Optimization Status
- **Cache-Control Header:** `public, max-age=86400, stale-while-revalidate=604800` configured in `backend/src/app.ts`.
- **Streaming Support:** Full HTTP 206 Partial Content Range request compliance across all MP4 video streams.
- **Security:** Static server sandboxed to `MEDIA_DIR` with dot-dot traversal rejection.
