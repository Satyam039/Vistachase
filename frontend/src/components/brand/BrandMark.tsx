import Image from "next/image";

/**
 * Vista Chase horse-and-rider logo. Files are served by the backend (backend/media/brand, at /media).
 * A logo is a brand asset, so it keeps its own ink instead of theme tokens.
 * The source PNGs are small (213px wide); swap in the vector master when the brand team sends it.
 *
 * variant:
 *   default  the horse-and-rider mark on its own, for the nav bar next to the "Vista Chase" heading
 *   white    full lockup in white, for dark surfaces
 *   emblem   square horse emblem
 */
export function BrandMark({ size = 36, variant = "default" }: { size?: number; variant?: "default" | "white" | "emblem" | "dark" }) {
  if (variant === "white") {
    return (
      <Image
        src="/media/brand/horse-emblem-vector-white.svg"
        alt="Vista Chase Luxury Canadian Rockies Tours"
        width={size}
        height={size}
        className="object-contain w-auto"
        priority
      />
    );
  }

  if (variant === "dark") {
    return (
      <Image
        src="/media/brand/horse-emblem-vector-dark.svg"
        alt="Vista Chase Luxury Canadian Rockies Tours"
        width={size}
        height={size}
        className="object-contain w-auto"
        priority
      />
    );
  }

  // Default & emblem: Official Master Gold Horse Vector
  return (
    <Image
      src="/media/brand/horse-emblem-vector-gold.svg"
      alt="Vista Chase Canadian Rockies"
      width={size}
      height={size}
      className="object-contain drop-shadow-sm"
      priority
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
