import type { Metadata } from "next";

// The page is a client component, so its title and description are set here (WCAG 2.4.2).
export const metadata: Metadata = {
  title: "My Trips | Vista Chase",
  description: "Your Vista Chase bookings, boarding passes and reviews.",
  robots: { index: false, follow: false },
};

export default function AccountTripsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
