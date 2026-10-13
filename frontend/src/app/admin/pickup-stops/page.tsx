"use client";

// Staff pickup stops: the stops guests choose at checkout and the AI concierge offers. Managers
// add, edit and turn stops off or on; stops are never deleted because bookings point to them.
// Every call goes through /api/admin/* (role-checked, audited).

import { useEffect, useState } from "react";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";
import { PickupStopsPanel } from "@/components/admin/staff/PickupStopsPanel";

const STAFF_ROLES = ["ADMIN", "OPERATOR", "DISPATCHER"];

export default function AdminPickupStopsPage() {
  const [access, setAccess] = useState<"checking" | "ok" | "denied" | "error">("checking");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) return setAccess("denied");
        if (!res.ok) return setAccess("error");
        const data = (await res.json().catch(() => ({}))) as { authenticated?: boolean; user?: { role?: string } };
        const r = data.user?.role ?? "";
        setRole(r);
        setAccess(data.authenticated && STAFF_ROLES.includes(r) ? "ok" : "denied");
      })
      .catch(() => setAccess("error"));
  }, []);

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <AdminHeader current="/admin/pickup-stops" eyebrow="Staff · Pickup stops" title="Pickup stops" subtitle="Where guests are picked up: names, addresses, map points and directions." />

      <div className="mx-auto max-w-7xl space-y-6 px-page py-8 sm:py-10">
        {access === "denied" && <StaffSignIn body="Sign in with an admin, operator or dispatch account to see pickup stops." />}
        {access === "error" && (
          <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
            Couldn&apos;t reach the pickup stops service. Try again in a moment.
          </p>
        )}
        <p aria-live="polite" className={message ? "rounded-2xl bg-ocean-50 px-5 py-3 text-sm text-ocean-800" : "sr-only"}>
          {message}
        </p>

        {access === "ok" && <PickupStopsPanel notify={setMessage} role={role} />}
      </div>
    </div>
  );
}
