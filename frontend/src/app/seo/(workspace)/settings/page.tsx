import type { Metadata } from "next";
import { SettingsView } from "@/components/seo-portal/WorkViews";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return <SettingsView />;
}
