import type { Metadata } from "next";
import { PageSettingsView } from "@/components/seo-portal/PageSettingsView";

export const metadata: Metadata = { title: "Page settings" };

export default function Page() {
  return <PageSettingsView />;
}
