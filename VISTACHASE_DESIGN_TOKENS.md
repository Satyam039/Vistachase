# 🎨 Vista Chase Design Tokens & Visual Hierarchy
## "Vista Chase, Elevated" — Alpine Luxury Meets Editorial Cinema

This document defines the authoritative design tokens for the Vista Chase digital experience, extracted directly from the verified live website (`vistachase.com`) and elevated to match modern cinematic standards.

---

## 1. Color Palette

### A. Primary Brand Colors
| Token | Name | Hex Code | HSL | Role & Usage |
| :--- | :--- | :--- | :--- | :--- |
| `--color-ocean-teal` | **Ocean Teal** | `#3A9CA6` | `hsl(186, 48%, 44%)` | Primary brand accent, navigation headers, subtle highlights. |
| `--color-ocean-teal-dark` | **Deep Ocean Teal** | `#0C1F21` | `hsl(186, 47%, 9%)` | Dark mode base, cinematic overlay backing, premium card contrast. |
| `--color-golden-summit` | **Golden Summit** | `#F5BF03` | `hsl(47, 98%, 49%)` | Primary CTA buttons, key highlight accents, review stars, TripAdvisor badge. |
| `--color-golden-tint` | **Golden Tint (Hover)**| `#FFE085` | `hsl(45, 100%, 76%)`| Button hover state, luminous focus indicators. |
| `--color-gold-muted` | **Muted Ochre** | `#DAA500` | `hsl(46, 100%, 43%)`| Secondary borders, subtle badges. |

### B. Neutrals & Surfaces
| Token | Name | Hex Code | Role & Usage |
| :--- | :--- | :--- | :--- |
| `--color-frost-white` | **Frost White** | `#F9F9F7` | Clean page canvas, light background. |
| `--color-obsidian-black`| **Obsidian Black**| `#1C1F23` | Deep typography, footers, dark backgrounds. |
| `--color-surface-pure` | **Pure White** | `#FFFFFF` | Card surfaces, modal sheets. |
| `--color-surface-dark` | **Alpine Dark Surface**| `#111618` | Cinematic story background, luxury dark panels. |
| `--color-border-subtle` | **Alpine Mist Border**| `rgba(28, 31, 35, 0.08)` | Minimal dividers, hairline borders. |
| `--color-border-dark` | **Dark Hairline Border**| `rgba(255, 255, 255, 0.12)`| Overlay borders on dark cinematic cards. |

---

## 2. Typography

### A. Font Families
* **Display / Editorial:** `Montserrat Alternates` & `Playfair Display` (for cinematic headlines, pull-quotes, and section titles).
* **Body / UI:** `Inter` (variable weight, 300–700) & `Gill Sans` fallback (for UI labels, manifests, descriptions, and data tables).

### B. Typographic Scale (Fluid Clamping)
```css
/* Hero Headline */
--font-hero: clamp(3rem, 6vw, 6.5rem); /* 48px to 104px */
line-height: 1.05;
letter-spacing: -0.025em;

/* Section Headline */
--font-section: clamp(2.25rem, 4.5vw, 4.5rem); /* 36px to 72px */
line-height: 1.1;

/* Editorial Statement */
--font-statement: clamp(1.5rem, 3vw, 2.75rem); /* 24px to 44px */
line-height: 1.25;

/* Eyebrows / Super-titles */
--font-eyebrow: 0.8125rem; /* 13px */
text-transform: uppercase;
letter-spacing: 0.18em;
font-weight: 600;

/* Body Large */
--font-body-lg: clamp(1.125rem, 1.25vw, 1.35rem); /* 18px - 22px */
line-height: 1.6;

/* Body Regular */
--font-body: 1rem; /* 16px */
line-height: 1.6;

/* UI / Meta / Details */
--font-ui: 0.875rem; /* 14px */
font-weight: 500;
```

---

## 3. Elevated Button Styles

### A. Primary Action: "Golden Summit"
* **Background:** `#F5BF03`
* **Text:** `#1C1F23` (Obsidian Black, 700 weight)
* **Border Radius:** `6px`
* **Padding:** `16px 36px`
* **Hover:** `#FFE085`, `translateY(-2px)`, subtle gold radiance shadow (`0 12px 24px rgba(245, 191, 3, 0.25)`).
* **Transition:** `cubic-bezier(0.16, 1, 0.3, 1) 300ms`

### B. Secondary Action: "Alpine Glass / Ghost"
* **Background:** `rgba(255, 255, 255, 0.08)` backdrop blur `12px`
* **Text:** `#FFFFFF` or `#1C1F23`
* **Border:** `1px solid rgba(255, 255, 255, 0.25)`
* **Hover:** `background: rgba(255, 255, 255, 0.16)`

---

## 4. Cinematic Media Overlays
```css
/* Standard Cinematic Dark Scrim */
--gradient-cinematic-scrim: linear-gradient(
  180deg,
  rgba(12, 31, 33, 0.2) 0%,
  rgba(12, 31, 33, 0.6) 50%,
  rgba(12, 31, 33, 0.92) 100%
);

/* Subtle Top Header Vignette */
--gradient-header-vignette: linear-gradient(
  180deg,
  rgba(12, 31, 33, 0.75) 0%,
  transparent 100%
);
```
