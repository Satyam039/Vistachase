import type { Metadata } from "next";
import { SchemaView } from "@/components/seo-portal/SchemaView";

export const metadata: Metadata = { title: "Schema markup" };

export default function Page() {
  return <SchemaView />;
}
