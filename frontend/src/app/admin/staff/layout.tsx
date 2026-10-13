import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff | Vista Chase Admin",
  robots: { index: false, follow: false },
};

export default function AdminStaffLayout({ children }: { children: React.ReactNode }) {
  return children;
}
