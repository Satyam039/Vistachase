import type { Metadata } from "next";
import { PageKeywordsView } from "@/components/seo-portal/PageViews";

export const metadata: Metadata = { title: "Keywords by page" };

export default function Page() {
  return <PageKeywordsView />;
}
