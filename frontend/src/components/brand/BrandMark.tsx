import Image from "next/image";

/**
 * Vista Chase horse-and-rider logo, from the live vistachase.com Webflow assets.
 * A logo is a brand asset, so it keeps its own ink instead of theme tokens.
 * The source PNGs are small (213px wide); swap in the vector master when the brand team sends it.
 *
 * variant:
 *   default  the horse-and-rider mark on its own (public/brand), for the nav bar next to the "Vista Chase" heading
 *   white    full lockup in white, for dark surfaces
 *   emblem   square horse emblem
 */
export function BrandMark({ size = 32, variant = "default" }: { size?: number; variant?: "default" | "white" | "emblem" }) {
  if (variant === "white") {
    return (
      <Image
        src="https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/6906ed2d407b21d560ca0dd0_images%204.png"
        alt="Vista Chase Luxury Canadian Rockies Tours"
        width={Math.round(size * 3.4)}
        height={size}
        className="object-contain h-9 w-auto"
        priority
      />
    );
  }

  if (variant === "emblem") {
    return (
      <Image
        src="https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/6907ce5d58aa3223085833b6_4a63d88a7f5330f9765fc90768f76f2c323f34d3.png"
        alt="Vista Chase Horse Emblem"
        width={size}
        height={size}
        className="object-contain"
        priority
      />
    );
  }

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
