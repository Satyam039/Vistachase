import type { Metadata } from "next";
import { AuditView } from "@/components/seo-portal/AuditView";

export const metadata: Metadata = { title: "Website audit" };

export default function Page() {
  return <AuditView />;
}
