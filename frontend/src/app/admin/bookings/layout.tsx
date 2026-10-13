import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bookings | Vista Chase Admin",
  robots: { index: false, follow: false },
};

export default function AdminBookingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
