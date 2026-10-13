"use client";

// Admin staff screen: staff roles, removing access and adding staff. Admins only; the panels live
// in components/admin/staff/StaffPanel.tsx and use /api/admin/staff.

import { useCallback, useState } from "react";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";
import { StaffPanel } from "@/components/admin/staff/StaffPanel";

export default function AdminStaffPage() {
  const [denied, setDenied] = useState(false);
  const [message, setMessage] = useState("");
  const onDenied = useCallback(() => setDenied(true), []);

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <AdminHeader current="/admin/staff" eyebrow="Staff · Access" title="Staff" subtitle="Who can use the staff screens, and what each person can do." />

      <div className="mx-auto max-w-7xl space-y-6 px-page py-8 sm:py-10">
        {denied && <StaffSignIn body="Only admins can manage staff." />}
        <p aria-live="polite" className={message ? "rounded-2xl bg-ocean-50 px-5 py-3 text-sm text-ocean-800" : "sr-only"}>
          {message}
        </p>
        {!denied && <StaffPanel notify={setMessage} onDenied={onDenied} />}
      </div>
    </div>
  );
}
