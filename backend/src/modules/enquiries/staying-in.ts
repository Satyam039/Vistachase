// Contact form "We Are Staying In" (owner's "VistaChase Website" PDF, 2026-11-14): where the guest is
// staying, or that they arrive at Calgary Airport. Helps staff spot guests outside Banff/Canmore and
// airport-transfer needs. Mirrored in frontend/src/lib/stayingIn.ts; keep the two lists the same.
export const STAYING_IN_OPTIONS = [
  "Banff",
  "Canmore",
  "Dead Man's Flat",
  "Harvie Heights",
  "Calgary",
  "Lake Louise",
  "Arriving at Calgary Airport",
] as const;

export type StayingIn = (typeof STAYING_IN_OPTIONS)[number];
