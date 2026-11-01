import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Platform Settings | Admin | Vista Chase",
  description: "Platform configuration, Bókun integration, and system status.",
  robots: { index: false, follow: false },
};

export default function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
