import type { Metadata } from "next";
import { OverviewView } from "@/components/seo-portal/OverviewView";

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return <OverviewView />;
}
