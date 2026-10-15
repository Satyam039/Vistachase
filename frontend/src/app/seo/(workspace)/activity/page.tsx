import type { Metadata } from "next";
import { ActivityView } from "@/components/seo-portal/WorkViews";

export const metadata: Metadata = { title: "Change history" };

export default function Page() {
  return <ActivityView />;
}
