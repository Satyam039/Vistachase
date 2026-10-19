import Image from "next/image";

/**
 * Vista Chase horse-and-rider emblem, cropped tight from the official vector master (backend/media/
 * brand/horse-emblem-vector-*.svg are the full lockup on a 2000px square: emblem, name and tagline).
 * emblem-*.svg keep only the horse-and-rider paths, so nothing of the lettering shows at small
 * sizes. The vector masters lack the far hind leg, so the last path restores it, traced from the
 * official raster (horse-emblem-gold.png): all four legs show. A logo is a brand asset, so it keeps
 * its own ink instead of theme tokens.
 *
 * `size` is the height; the emblem is 1.2× as wide as it is tall.
 * variant:
 *   default / dark  ink (#1C1F23) for light surfaces
 *   white           for dark surfaces
 *   emblem / gold   Golden Summit
 */
const EMBLEM_RATIO = 726 / 603;
const EMBLEM_SRC = {
  default: "/media/brand/emblem-ink.svg",
  dark: "/media/brand/emblem-ink.svg",
  white: "/media/brand/emblem-white.svg",
  emblem: "/media/brand/emblem-gold.svg",
  gold: "/media/brand/emblem-gold.svg",
} as const;

export function BrandMark({ size = 36, variant = "default" }: { size?: number; variant?: keyof typeof EMBLEM_SRC }) {
  return (
    <Image
      src={EMBLEM_SRC[variant]}
      alt=""
      width={Math.round(size * EMBLEM_RATIO)}
      height={size}
      className="shrink-0 object-contain"
      priority
      unoptimized
    />
  );
}

/**
 * "VISTA CHASE" wordmark, the lettering of the official lockup cut unchanged from the vector master
 * (wordmark-*.svg), so the header shows the brand's own letterforms instead of typeset text.
 * `size` is the cap height; the wordmark is 967:112.
 */
const WORDMARK_RATIO = 967 / 112;

export function BrandWordmark({ size = 14, variant = "ink" }: { size?: number; variant?: "ink" | "white" }) {
  return (
    <Image
      src={`/media/brand/wordmark-${variant}.svg`}
      alt=""
      width={Math.round(size * WORDMARK_RATIO)}
      height={size}
      className="shrink-0 object-contain"
      priority
      unoptimized
    />
  );
}

/**
 * Full lockup: mark, "VISTA CHASE" wordmark and the "Chasing Canadian Vistas" tagline, as a vector
 * (lockup-*.svg, cropped from the official master) so it stays sharp on high-density screens.
 */
const LOCKUP_RATIO = 994 / 860;

export function BrandLogo({ height = 64, variant = "ink", alt = "Vista Chase, chasing Canadian vistas" }: { height?: number; variant?: "ink" | "white"; alt?: string }) {
  return (
    <Image
      src={`/media/brand/lockup-${variant}.svg`}
      alt={alt}
      width={Math.round(height * LOCKUP_RATIO)}
      height={height}
      className="shrink-0 object-contain"
      unoptimized
    />
  );
}
