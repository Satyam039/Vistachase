import type { Metadata } from "next";
import { ChecklistView } from "@/components/seo-portal/WorkViews";

export const metadata: Metadata = { title: "Migration checklist" };

export default function Page() {
  return <ChecklistView />;
}
