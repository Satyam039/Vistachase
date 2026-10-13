import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pickup stops | Vista Chase Admin",
  robots: { index: false, follow: false },
};

export default function AdminPickupStopsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
