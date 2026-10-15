import type { Metadata } from "next";
import { RedirectsView } from "@/components/seo-portal/MoreViews";

export const metadata: Metadata = { title: "Redirects" };

export default function Page() {
  return <RedirectsView />;
}
