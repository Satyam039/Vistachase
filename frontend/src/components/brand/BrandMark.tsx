import Image from "next/image";

/**
 * Vista Chase horse-and-rider logo, from the live vistachase.com Webflow assets
 * (public/brand). A logo is a brand asset, so it keeps its own ink instead of theme tokens.
 * The source PNGs are small (213px wide); swap in the vector master when the brand team sends it.
 */

/** The horse-and-rider mark on its own, for the nav bar next to the "Vista Chase" heading. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/brand/vista-chase-mark.png"
      alt=""
      width={Math.round((size * 96) / 76)}
      height={size}
      priority
    />
  );
}

/** Full lockup: mark, "VISTA CHASE" wordmark and the "Chasing Canadian Vistas" tagline. */
export function BrandLogo({ height = 64 }: { height?: number }) {
  return (
    <Image
      src="/brand/vista-chase-logo.png"
      alt="Vista Chase, chasing Canadian vistas"
      width={Math.round((height * 213) / 118)}
      height={height}
    />
  );
}
