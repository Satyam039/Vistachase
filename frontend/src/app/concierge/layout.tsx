import type { Metadata } from "next";

// The page is a client component, so its title and description are set here (WCAG 2.4.2).
export const metadata: Metadata = {
  title: "AI Travel Concierge | Vista Chase",
  description: "Plan your Canadian Rockies trip with the Vista Chase AI concierge: tours, shuttles, pickups and seat holds.",
};

export default function ConciergeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
