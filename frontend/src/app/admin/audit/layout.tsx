import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audit log | Vista Chase Admin",
  robots: { index: false, follow: false },
};

export default function AdminAuditLayout({ children }: { children: React.ReactNode }) {
  return children;
}
