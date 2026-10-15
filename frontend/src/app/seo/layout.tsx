import type { Metadata } from "next";

// The SEO portal: a staff workspace, never indexed (robots.txt also disallows /seo and next.config
// sends X-Robots-Tag: noindex). The public header and footer are left out (SiteFrame).
export const metadata: Metadata = {
  title: { default: "SEO portal | Vista Chase", template: "%s | Vista Chase SEO portal" },
  robots: { index: false, follow: false },
};

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
