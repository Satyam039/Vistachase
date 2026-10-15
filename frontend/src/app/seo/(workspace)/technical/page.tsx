import type { Metadata } from "next";
import { TechnicalView } from "@/components/seo-portal/TechnicalView";

export const metadata: Metadata = { title: "Technical SEO" };

export default function Page() {
  return <TechnicalView />;
}
