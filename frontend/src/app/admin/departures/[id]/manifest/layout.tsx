import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manifest | Vista Chase Admin",
  robots: { index: false, follow: false },
};

export default function AdminManifestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
