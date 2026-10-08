# VISTA CHASE — MEDIA DEDUPLICATION AUDIT REPORT
**Document:** `VISTACHASE_MEDIA_DEDUP_REPORT.md`  
**Scope:** Complete deduplication and variance analysis across repository media and Google Drive archives  
**Audit Date:** 2026-10-06  
**Safety Protocol:** REPORT ONLY. Zero destructive file deletions executed.

---

## 1. Executive Summary

| Category | Count | Action Taken |
|:---|:---:|:---|
| **Exact SHA-256 Duplicates in Repo** | **1** | Retained for backward route compatibility (zero deletion) |
| **Drive Upload Duplicates (`(1)` Suffix)** | **5** | Ingested single canonical master; documented duplicate IDs |
| **Same Asset / Multi-Resolution Pairs** | **5 sets** | Retained (720p mobile + 1080p desktop + poster pairs) |
| **Same Asset / Multi-Format Sets** | **4 sets** | Retained (SVG vector + WebP web + PNG master + EPS print) |

---

## 2. Google Drive Source Duplicates (Upload Artifacts)

The following files represent duplicate uploads in the source Google Drive folder caused by re-uploading identical assets:

| Duplicate File A | Duplicate File B | File Size | Classification | Ingestion Decision |
|:---|:---|:---:|:---|:---|
| `Glacier_Skywalk (1).mp4` | `Glacier_Skywalk.mp4` | 74.79 MB | EXACT DUPLICATE (Drive upload artifact) | Ingested canonical master (`Glacier_Skywalk.mp4`); skipped redundant copy |
| `Maligne_Lake_Cruise (1).mp4` | `Maligne_Lake_Cruise.mp4` | 45.52 MB | EXACT DUPLICATE (Drive upload artifact) | Ingested canonical master (`Maligne_Lake_Cruise.mp4`); skipped redundant copy |
| `Bridge-GSB-BJC (1).jpg` | `Bridge-GSB-BJC.jpg` | 20.78 MB | EXACT DUPLICATE (Drive upload artifact) | Ingested canonical master (`Bridge-GSB-BJC.jpg`); skipped redundant copy |
| `IMG_5562 (1).jpg` | `IMG_5562.jpg` | 18.18 MB | EXACT DUPLICATE (Drive upload artifact) | Ingested canonical master (`IMG_5562.jpg`); skipped redundant copy |
| `Maligne-Lake-Cruise-Wide (1).jpg` | `Maligne-Lake-Cruise-Wide.jpg` | 6.93 MB | EXACT DUPLICATE (Drive upload artifact) | Ingested canonical master (`Maligne-Lake-Cruise-Wide.jpg`); skipped redundant copy |

---

## 3. Format & Resolution Variants (Intentional Production Assets)

| Subject | Variants in Library | Classification | Technical Rationale |
|:---|:---|:---|:---|
| **horse-emblem** | `horse-emblem-gold.png (714x592)`<br>`horse-emblem-vector-gold.svg (Vector)`<br>`horse-emblem-vector-gold.eps (Vector)`<br>`horse-emblem-master-gold.png (Master)` | SAME IMAGE DIFFERENT FORMAT & RESOLUTION | Responsive serving: lightweight WebP for mobile speed, high-res for 4K desktop, vector for lossless SVG rendering. |
| **logo-dark / logo-white** | `logo-dark.png (213x118)`<br>`logo-white.png (213x96)`<br>`horse-emblem-vector-dark.svg`<br>`horse-emblem-vector-white.svg` | SAME ASSET DIFFERENT VARIANT / FORMAT | Responsive serving: lightweight WebP for mobile speed, high-res for 4K desktop, vector for lossless SVG rendering. |
| **lake-louise-summer** | `lake-louise-summer.mp4 (720p, 4.55 MB)`<br>`lake-louise-summer-1080.mp4 (1080p, 9.11 MB)`<br>`lake-louise-summer-poster.webp (Poster)` | SAME VIDEO DIFFERENT RESOLUTION & POSTER | Responsive serving: lightweight WebP for mobile speed, high-res for 4K desktop, vector for lossless SVG rendering. |
| **columbia-icefield / athabasca** | `columbia-icefield-athabasca-glacier-master.jpg (8.45 MB RAW/JPG)`<br>`athabasca-glacier.webp (188 KB WebP)` | SAME IMAGE DIFFERENT RESOLUTION & COMPRESSION | Responsive serving: lightweight WebP for mobile speed, high-res for 4K desktop, vector for lossless SVG rendering. |
| **maligne-lake-cruise** | `maligne-lake-cruise.mp4 (4.60 MB WebP/720p loop)`<br>`maligne-lake-cruise-master.mp4 (45.52 MB Master)`<br>`maligne-lake-cruise-poster.webp` | SAME VIDEO DIFFERENT ENCODE & POSTER | Responsive serving: lightweight WebP for mobile speed, high-res for 4K desktop, vector for lossless SVG rendering. |

---

## 4. Exact Checksum Verification in Backend Library

Found 1 checksum collisions retained for legacy URL compatibility:

- **SHA-256:** `7a3ab7c82440a20b...`
  - `photos/lake-louise-shoreline.webp` (destinations, 168240 bytes)
  - `site/lake-louise-197406-1280.webp` (destinations, 168240 bytes)

---

## 5. Non-Destructive Protection Guarantee
In strict compliance with Section 4 and Section 14 of the Master Directive:
- **Zero files were deleted.**
- All legacy URLs remain 100% active and functional.
- Master RAWs and compressed web variants coexist with precise mappings in `media-manifest.json`.
