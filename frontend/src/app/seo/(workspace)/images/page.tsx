import type { Metadata } from "next";
import { ImagesView } from "@/components/seo-portal/MoreViews";

export const metadata: Metadata = { title: "Images & alt text" };

export default function Page() {
  return <ImagesView />;
}
