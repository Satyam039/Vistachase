import type { Metadata } from "next";
import { SocialImagesView } from "@/components/seo-portal/PageViews";

export const metadata: Metadata = { title: "Social images" };

export default function Page() {
  return <SocialImagesView />;
}
