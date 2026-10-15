import type { Metadata } from "next";
import { BlogView } from "@/components/seo-portal/BlogView";

export const metadata: Metadata = { title: "Blog SEO" };

export default function Page() {
  return <BlogView />;
}
