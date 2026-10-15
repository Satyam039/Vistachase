import type { Metadata } from "next";
import { PageEditorView } from "@/components/seo-portal/SimpleViews";

export const metadata: Metadata = { title: "Edit page" };

export default function Page() {
  return <PageEditorView />;
}
