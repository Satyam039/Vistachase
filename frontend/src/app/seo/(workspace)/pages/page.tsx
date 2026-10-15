import type { Metadata } from "next";
import { PagesView } from "@/components/seo-portal/SimpleViews";

export const metadata: Metadata = { title: "Pages & metadata" };

export default function Page() {
  return <PagesView />;
}
