"use client";

// Admin → Content: tour and destination copy and photos (components/admin/content). Admins, SEO
// managers and editors can change it; viewers can read it. Everything goes through /api/content.

import { useCallback, useState } from "react";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";
import { ContentWorkspace } from "@/components/admin/content/ContentEditor";

export default function AdminContentPage() {
  const [denied, setDenied] = useState(false);
  const onDenied = useCallback(() => setDenied(true), []);

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <AdminHeader
        current="/admin/content"
        eyebrow="Staff · Content"
        title="Content"
        subtitle="The words and photos on tour and destination pages. Prices, dates and booking settings stay on the Departures screen; search titles and descriptions are in SEO."
      />
      <div className="mx-auto max-w-7xl space-y-6 px-page py-8 sm:py-10">
        {denied ? <StaffSignIn body="Sign in with an admin, SEO or editor account to edit content." /> : <ContentWorkspace onDenied={onDenied} />}
      </div>
    </div>
  );
}
