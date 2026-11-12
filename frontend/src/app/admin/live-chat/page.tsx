"use client";

// Admin → Live chat: answer guests who asked the AI concierge for a live agent. The panel lives in
// components/admin/staff/LiveChatPanel.tsx and reads /api/admin/live-chats.

import { Suspense, useCallback, useState } from "react";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";
import { LiveChatPanel } from "@/components/admin/staff/LiveChatPanel";

export default function AdminLiveChatPage() {
  const [denied, setDenied] = useState(false);
  const onDenied = useCallback(() => setDenied(true), []);

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <AdminHeader current="/admin/live-chat" eyebrow="Staff · Live chat" title="Live chat" subtitle="Guests who asked the AI concierge for a live agent. Reply here and they see it in their chat window." />

      <div className="mx-auto max-w-7xl px-page py-8 sm:py-10">
        {denied ? (
          <StaffSignIn body="Sign in as staff to answer live chats." />
        ) : (
          <Suspense fallback={null}>
            <LiveChatPanel onDenied={onDenied} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
