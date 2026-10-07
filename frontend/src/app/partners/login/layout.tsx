import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner Sign In | Vista Chase",
  robots: { index: false, follow: false },
};

export default function PartnerLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
