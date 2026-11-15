"use client";

// Admin → Security (admins only): who sent each public form, with IP and location, and the
// blocked IPs and emails. The panel lives in components/admin/staff/SecurityPanel.tsx and reads
// /api/admin/security/*.

import { useCallback, useState } from "react";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";
import { SecurityPanel } from "@/components/admin/staff/SecurityPanel";

export default function AdminSecurityPage() {
  const [denied, setDenied] = useState(false);
  const onDenied = useCallback(() => setDenied(true), []);

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <AdminHeader
        current="/admin/security"
        eyebrow="Staff · Security"
        title="Security"
        subtitle="Who sent the website's forms, from which IP and place, and the senders you've blocked."
      />
      <div className="mx-auto max-w-7xl space-y-6 px-page py-8 sm:py-10">
        {denied ? <StaffSignIn body="Only admins can see the security log." /> : <SecurityPanel onDenied={onDenied} />}
      </div>
    </div>
  );
}
