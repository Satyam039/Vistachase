import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Check In | Vista Chase Staff",
  description: "Check a guest in from their voucher QR code.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
