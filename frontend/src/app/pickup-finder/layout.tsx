import type { Metadata } from "next";

// The page is a client component, so its title and description are set here (WCAG 2.4.2).
export const metadata: Metadata = {
  title: "Hotel Pickup Finder | Vista Chase",
  description: "Find your Vista Chase pickup point and time for hotels in Banff, Canmore and Lake Louise.",
};

export default function PickupFinderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
