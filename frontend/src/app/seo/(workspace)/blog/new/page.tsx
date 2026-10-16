import type { Metadata } from "next";
import { BlogPostEditor } from "@/components/seo-portal/BlogPostEditor";

export const metadata: Metadata = { title: "New blog post" };

export default function Page() {
  return <BlogPostEditor id={null} />;
}
