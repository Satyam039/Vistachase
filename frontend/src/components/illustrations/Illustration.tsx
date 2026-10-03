import type { ReactNode } from "react";

/**
 * Astryx illustration guidelines (`npx astryx docs illustrations`):
 * - simple, flat, one consistent style, readable in light and dark mode
 * - sized to the container: 120px inline, up to 240px for full-page states
 * - centered above a title + description (pass to EmptyState's `icon` slot)
 *
 * Every fill/stroke uses a token-backed Tailwind color (see astryx-tailwind-bridge.ts),
 * so the artwork follows the active theme and color mode.
 */
export const ILLUSTRATION_SIZES = { sm: 120, md: 180, lg: 240 } as const;
export type IllustrationSize = keyof typeof ILLUSTRATION_SIZES;

export interface IllustrationProps {
  /** sm 120px for inline/compact states, md 180px default, lg 240px for full-page states. */
  size?: IllustrationSize;
}

export function Illustration({ size = "md", children }: IllustrationProps & { children: ReactNode }) {
  const px = ILLUSTRATION_SIZES[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 240 240"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className="max-w-full h-auto"
    >
      {children}
    </svg>
  );
}
