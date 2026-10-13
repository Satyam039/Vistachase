"use client";

// Admin audit log: who changed what and when. Admins only; the panel lives in
// components/admin/staff/AuditLogPanel.tsx and reads /api/admin/audit-logs.

import { useCallback, useState } from "react";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";
import { AuditLogPanel } from "@/components/admin/staff/AuditLogPanel";

export default function AdminAuditPage() {
  const [denied, setDenied] = useState(false);
  const onDenied = useCallback(() => setDenied(true), []);

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <AdminHeader current="/admin/audit" eyebrow="Staff · Audit log" title="Audit log" subtitle="Bookings, refunds, departures, staff changes and system jobs, as recorded." />

      <div className="mx-auto max-w-7xl space-y-6 px-page py-8 sm:py-10">
        {denied ? <StaffSignIn body="Only admins can see the audit log." /> : <AuditLogPanel onDenied={onDenied} />}
      </div>
    </div>
  );
}
