import type { Metadata } from "next";
import { BlogPostEditor } from "@/components/seo-portal/BlogPostEditor";

export const metadata: Metadata = { title: "Edit blog post" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BlogPostEditor key={id} id={id} />;
}
