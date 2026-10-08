import Image from "next/image";

/**
 * Vista Chase horse-and-rider emblem, cropped tight from the official vector master (backend/media/
 * brand/horse-emblem-vector-*.svg are the full lockup on a 2000px square: emblem, name and tagline).
 * emblem-*.svg keep only the four horse-and-rider paths, so nothing of the lettering shows at small
 * sizes. A logo is a brand asset, so it keeps its own ink instead of theme tokens.
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

/** Full lockup: mark, "VISTA CHASE" wordmark and the "Chasing Canadian Vistas" tagline. */
export function BrandLogo({ height = 64 }: { height?: number }) {
  return (
    <Image
      src="/media/brand/logo-dark.png"
      alt="Vista Chase, chasing Canadian vistas"
      width={Math.round((height * 213) / 118)}
      height={height}
    />
  );
}
