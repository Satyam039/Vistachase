/**
 * Tailwind v3 bridge for Astryx foundation tokens.
 *
 * Astryx ships @astryxdesign/core/tailwind-theme.css for Tailwind v4 only. This is the
 * v3 equivalent: every value is a var(--…) reference to the active Astryx theme, so
 * utilities follow the theme (and its responsive tiers) automatically.
 *
 * Semantic colors use the official bridge names (bg-surface, text-primary,
 * border-border, bg-blue-subtle …). The other foundations use NEW names so the
 * Tailwind defaults the existing pages rely on (text-sm, rounded-xl, shadow-sm,
 * font-mono …) keep their current values:
 *
 *   typography  font-body | font-heading | font-code
 *               text-type-heading-1…6 | text-type-display-1…3 | text-type-body |
 *               text-type-large | text-type-label | text-type-code | text-type-supporting
 *                                                         (size + line-height + weight;
 *                                                          prefixed so text-body stays a color)
 *               text-ax-2xs … text-ax-5xl                    (raw font-size scale)
 *               font-ax-normal | -medium | -semibold | -bold
 *   spacing     px-page / mx-page / … = responsive outer page margin (--vc-page-margin-x).
 *               Tailwind's default 0–12 steps already equal the Astryx --spacing-* scale
 *               (4px base), so they are left as rem values to keep scaling with the
 *               user's browser font size.
 *   size        h-element-sm|md|lg, min-h-element-*, w-element-*
 *   shape       rounded-inner | rounded-element | rounded-container | rounded-page | rounded-chat
 *   elevation   shadow-low | shadow-med | shadow-high | shadow-inset-*
 *   motion      duration-fast|medium|slow (+ -min/-max) | ease-standard
 *   border      border-token (width)
 *   data viz    bg-data-blue-3, text-data-categorical-orange, …
 */

const v = (name: string) => `var(--${name})`;

const HUES = ["blue", "cyan", "gray", "green", "orange", "pink", "purple", "red", "teal", "yellow"] as const;
const DATA_RAMPS = ["blue", "shamrock", "orange", "pink", "purple", "red", "teal", "yellow", "gray"] as const;
const DATA_CATEGORICAL = ["blue", "orange", "purple", "green", "pink", "cyan", "red", "teal", "brown", "indigo"] as const;

const hueColors = Object.fromEntries(
  HUES.map((hue) => [
    hue,
    {
      subtle: v(`color-background-${hue}`),
      ring: v(`color-border-${hue}`),
      vivid: v(`color-text-${hue}`),
      icon: v(`color-icon-${hue}`),
    },
  ])
);

const dataColors = {
  neutral: v("color-data-neutral"),
  categorical: Object.fromEntries(DATA_CATEGORICAL.map((c) => [c, v(`color-data-categorical-${c}`)])),
  ...Object.fromEntries(
    DATA_RAMPS.map((ramp) => [ramp, Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, v(`color-data-${ramp}-${n}`)]))])
  ),
};

export const astryxColors = {
  // Text
  primary: v("color-text-primary"),
  secondary: v("color-text-secondary"),
  disabled: v("color-text-disabled"),
  accent: v("color-text-accent"),
  // Surfaces
  surface: v("color-background-surface"),
  body: v("color-background-body"),
  card: v("color-background-card"),
  popover: v("color-background-popover"),
  muted: v("color-background-muted"),
  inverted: v("color-background-inverted"),
  overlay: v("color-overlay"),
  // Interactive
  "accent-bg": v("color-accent"),
  "accent-muted": v("color-accent-muted"),
  "on-accent": v("color-on-accent"),
  neutral: v("color-neutral"),
  "overlay-hover": v("color-overlay-hover"),
  "overlay-pressed": v("color-overlay-pressed"),
  // Status
  success: v("color-success"),
  "success-muted": v("color-success-muted"),
  "on-success": v("color-on-success"),
  error: v("color-error"),
  "error-muted": v("color-error-muted"),
  "on-error": v("color-on-error"),
  warning: v("color-warning"),
  "warning-muted": v("color-warning-muted"),
  "on-warning": v("color-on-warning"),
  // Borders
  border: v("color-border"),
  "border-strong": v("color-border-emphasized"),
  // Icons
  "icon-primary": v("color-icon-primary"),
  "icon-secondary": v("color-icon-secondary"),
  "icon-accent": v("color-icon-accent"),
  "icon-disabled": v("color-icon-disabled"),
  // Utility
  "on-dark": v("color-on-dark"),
  "on-light": v("color-on-light"),
  skeleton: v("color-skeleton"),
  track: v("color-track"),
  // Hue palette and data visualization
  ...hueColors,
  data: dataColors,
};

export const astryxSpacing = {
  page: v("vc-page-margin-x"),
};

const elementSizes = {
  "element-sm": v("size-element-sm"),
  "element-md": v("size-element-md"),
  "element-lg": v("size-element-lg"),
};

const typeStyle = (name: string): [string, { lineHeight: string; fontWeight: string }] => [
  v(`text-${name}-size`),
  { lineHeight: v(`text-${name}-leading`), fontWeight: v(`text-${name}-weight`) },
];
const TYPE_STYLES = [
  "heading-1", "heading-2", "heading-3", "heading-4", "heading-5", "heading-6",
  "display-1", "display-2", "display-3",
  "body", "large", "label", "code", "supporting",
];
const FONT_SIZES = ["2xs", "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];

export const astryxThemeExtension = {
  colors: astryxColors,
  spacing: astryxSpacing,
  height: elementSizes,
  minHeight: elementSizes,
  width: elementSizes,
  minWidth: elementSizes,
  fontFamily: {
    body: v("font-family-body"),
    heading: v("font-family-heading"),
    code: v("font-family-code"),
  },
  fontSize: {
    ...Object.fromEntries(TYPE_STYLES.map((name) => [`type-${name}`, typeStyle(name)])),
    ...Object.fromEntries(FONT_SIZES.map((size) => [`ax-${size}`, v(`font-size-${size}`)])),
  },
  fontWeight: {
    "ax-normal": v("font-weight-normal"),
    "ax-medium": v("font-weight-medium"),
    "ax-semibold": v("font-weight-semibold"),
    "ax-bold": v("font-weight-bold"),
  },
  borderRadius: {
    inner: v("radius-inner"),
    element: v("radius-element"),
    container: v("radius-container"),
    page: v("radius-page"),
    chat: v("radius-chat"),
  },
  borderWidth: {
    token: v("border-width"),
  },
  boxShadow: {
    low: v("shadow-low"),
    med: v("shadow-med"),
    high: v("shadow-high"),
    "inset-hover": v("shadow-inset-hover"),
    "inset-selected": v("shadow-inset-selected"),
    "inset-success": v("shadow-inset-success"),
    "inset-warning": v("shadow-inset-warning"),
    "inset-error": v("shadow-inset-error"),
  },
  transitionDuration: Object.fromEntries(
    ["fast", "medium", "slow"].flatMap((band) => [
      [band, v(`duration-${band}`)],
      [`${band}-min`, v(`duration-${band}-min`)],
      [`${band}-max`, v(`duration-${band}-max`)],
    ])
  ),
  transitionTimingFunction: {
    standard: v("ease-standard"),
  },
};
