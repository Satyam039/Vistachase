import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manage booking | Vista Chase Admin",
  robots: { index: false, follow: false },
};

export default function ManageBookingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
