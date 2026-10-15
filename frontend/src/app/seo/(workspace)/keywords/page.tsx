import type { Metadata } from "next";
import { KeywordsView } from "@/components/seo-portal/SimpleViews";

export const metadata: Metadata = { title: "Keywords" };

export default function Page() {
  return <KeywordsView />;
}
