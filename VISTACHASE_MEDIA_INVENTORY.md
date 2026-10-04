# 📸 Vista Chase Complete Media Inventory

This inventory catalogs the active production assets, verified Webflow CDN resources, and required Google Drive master assets for the Vista Chase digital experience.

---

## 1. Asset Registry & Classifications

| Asset Key | Source / URL | Media Type | Destination / Subject | Orientation & Aspect | Recommended Section | Hero-Worthy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `hero-rockies-panorama` | `690fe8161931736580e464ee_Hero%20Background%20Image%203.webp` | Image (WebP) | Canadian Rockies & Bow Valley | Landscape (16:9) | Homepage Hero | ⭐ Yes |
| `tripadvisor-botb-2025` | `6a125b0bbd624b7655b6d861_Tripadvisor%20BOTB%20Badge...png` | Badge (PNG) | TripAdvisor Best of the Best #6 | Square / Crest | Social Proof / Award | No (Utility) |
| `lake-louise-chateau` | `68e75d2241160e7b6fe97901_Lake-Louise-from-Fairmont-Chateau.webp`| Image (WebP) | Lake Louise shoreline & Fairmont | Landscape (16:9) | Category Story / Destination | ⭐ Yes |
| `moraine-reflection` | `68e75d228ead1330ef50075f_Moraine-Lake-Perfect-Reflection.webp` | Image (WebP) | Moraine Lake & Ten Peaks | Landscape (16:9) | Cinematic Story / Shuttles | ⭐ Yes |
| `shoreline-canoes` | `69076dd2d4e37b1f117a692d_About%20Image%20(1).webp` | Image (WebP) | Moraine Lake Red Canoes | Editorial Portrait (3:4) | Plan Ahead / Guaranteed Access | ⭐ Yes |
| `morants-curve-train` | `690a1613098a903d97414ebd_Image%20-%202025-11-04T210434.975.png` | Image (PNG) | Canadian Pacific Train in Bow Valley | Landscape (16:9) | Why Travelers Love / Shared | ⭐ Yes |
| `guide-in-forest` | `6907d17f97c5c1e84eff3593_Feature%20Image%20(1).png` | Image (PNG) | Certified Mountain Guide on trail | Portrait (4:5) | Guide Expertise / Operations | Yes |
| `horse-emblem-gold` | `6907ce5d58aa3223085833b6_4a63d88a7f5330f9765fc...png` | Vector (PNG) | Vista Chase Horse Mark | Square | Brand Emblem / Watermarks | No (Brand) |
| `horse-silhouette-bg` | `691010a937bd1626bd437647_Horse%20Background%20Image%20V3.png` | Banner (PNG) | Horse & Rider in Rockies | Ultra-Wide (21:9) | See More / Multi-Day Banner | Yes |
| `logo-white-nav` | `6906ed2d407b21d560ca0dd0_images%204.png` | Vector (PNG) | Vista Chase Wordmark & Mark | Horizontal | Main Sticky Navigation | No (Brand) |
| `logo-dark-nav` | `69089376e89919ea16ef4b89_images%204%20(1).png` | Vector (PNG) | Vista Chase Dark Wordmark | Horizontal | Scrolled Light Navigation | No (Brand) |
| `partner-google-reviews`| `691ad50ffd3777dc4cf0e156_Google%20logo.png` | Brand Mark | 5-Star Google Reviews | Horizontal | Trust Bar | No (Trust) |
| `partner-tripadvisor` | `691ace89e156673a0f597a5f_Tripadvisor_idSto8f0HB_1.png` | Brand Mark | TripAdvisor Partner | Horizontal | Trust Bar | No (Trust) |
| `partner-viator` | `691acec025274569c3f0e5be_viator-seeklogo.png` | Brand Mark | Viator Marketplace | Horizontal | Trust Bar | No (Trust) |
| `partner-getyourguide` | `691ad59089e29176ffcb2c69_Get%20Your%20Guide%20Logo.png` | Brand Mark | GetYourGuide Marketplace | Horizontal | Trust Bar | No (Trust) |

---

## 2. Asset Groupings & Page Placement

### A. Hero Category
* `hero-rockies-panorama` (Full viewport width, dark gradient scrim, ambient scale animation)
* Fallback video loops: `hero-rockies-cinematic.mp4` (from Google Drive once authenticated)

### B. Destination Stories
* **Banff:** `morants-curve-train` + Bow Falls viewpoints
* **Lake Louise:** `lake-louise-chateau` (Fairmont Chateau & Victoria Glacier)
* **Moraine Lake:** `moraine-reflection` & `shoreline-canoes` (Valley of the Ten Peaks)
* **Icefields Parkway:** `horse-silhouette-bg` (Corridor sweep)

### C. Fleet & Operations
* `guide-in-forest` (Certified guide Marc Tremblay & customer assistance)
* Mercedes Sprinter Executive #4 & GMC Yukon XL VIP cards

### D. Testimonials & Social Proof
* `tripadvisor-botb-2025` + 5 verified client avatars (`Ellipse 2-6`)
