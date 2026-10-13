"use client";

// Admin: edit one SEO page (metadata overrides, guide content, publishing, keywords, change log).
// The editor itself lives in components/admin/seo/PageEditor.tsx.

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { SeoPageEditor } from "@/components/admin/seo/PageEditor";

export default function AdminSeoPageEditorPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id ?? "";

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <AdminHeader
        current="/admin/seo"
        eyebrow="Staff · SEO"
        title="Edit page"
        subtitle="Search metadata, sharing, content and publishing for one page."
        actions={
          <Link href="/admin/seo#pages" className="inline-flex h-11 items-center gap-2 rounded-full border border-obsidian-900/10 bg-white px-4 text-sm text-obsidian-900 hover:bg-obsidian-50">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to SEO pages
          </Link>
        }
      />
      <div className="mx-auto max-w-7xl px-page py-8 sm:py-10">{id ? <SeoPageEditor key={id} id={id} /> : null}</div>
    </div>
  );
}
