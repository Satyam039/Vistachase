"use client";

// Staff departures: list departures by date, open a manifest, edit seats and prices, take one off
// sale or put it back, and add departures for a date range. Panels live in components/admin/staff;
// every call goes through /api/admin/* (role-checked, audited).

import { useEffect, useState } from "react";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";
import { DeparturesPanel } from "@/components/admin/staff/DeparturesPanel";

const STAFF_ROLES = ["ADMIN", "OPERATOR", "DISPATCHER"];

export default function AdminDeparturesPage() {
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
      <AdminHeader
        current="/admin/departures"
        eyebrow="Staff · Departures"
        title="Departures"
        subtitle="Seats, prices and sale status of every tour and shuttle departure, with the passenger manifest for each."
      />

      <div className="mx-auto max-w-7xl space-y-6 px-page py-8 sm:py-10">
        {access === "denied" && <StaffSignIn body="Sign in with an admin, operator or dispatch account to see departures." />}
        {access === "error" && (
          <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
            Couldn&apos;t reach the departures service. Try again in a moment.
          </p>
        )}
        <p aria-live="polite" className={message ? "rounded-2xl bg-ocean-50 px-5 py-3 text-sm text-ocean-800" : "sr-only"}>
          {message}
        </p>

        {access === "ok" && <DeparturesPanel notify={setMessage} role={role} />}
      </div>
    </div>
  );
}
