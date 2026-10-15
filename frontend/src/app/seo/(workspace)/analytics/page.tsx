import type { Metadata } from "next";
import { AnalyticsView } from "@/components/seo-portal/SimpleViews";

export const metadata: Metadata = { title: "Analytics & Search Console" };

export default function Page() {
  return <AnalyticsView />;
}
