"use client";

// Admin messages: enquiries and live agent requests from the AI concierge. The panel lives in
// components/admin/staff/MessagesPanel.tsx and reads /api/admin/enquiries.

import { useCallback, useState } from "react";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";
import { MessagesPanel } from "@/components/admin/staff/MessagesPanel";

export default function AdminMessagesPage() {
  const [denied, setDenied] = useState(false);
  const onDenied = useCallback(() => setDenied(true), []);

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <AdminHeader current="/admin/messages" eyebrow="Staff · Messages" title="Messages" subtitle="Contact form, tour requests and live agent requests from the AI concierge." />

      <div className="mx-auto max-w-7xl space-y-6 px-page py-8 sm:py-10">
        {denied ? <StaffSignIn body="Sign in as staff to see messages." /> : <MessagesPanel onDenied={onDenied} />}
      </div>
    </div>
  );
}
