"use client";

// Staff promo codes: the codes guests type at checkout. Admins create, edit, turn off and delete
// them; operators can see them. Every call goes through /api/admin/* (role-checked, audited).

import { useEffect, useState } from "react";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";
import { PromoCodesPanel } from "@/components/admin/staff/PromoCodesPanel";

const VIEW_ROLES = ["ADMIN", "OPERATOR"];

export default function AdminPromoCodesPage() {
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
        setAccess(data.authenticated && VIEW_ROLES.includes(r) ? "ok" : "denied");
      })
      .catch(() => setAccess("error"));
  }, []);

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <AdminHeader current="/admin/promo-codes" eyebrow="Staff · Promo codes" title="Promo codes" subtitle="Discount codes guests enter at checkout: percent or dollar amount off, dates and use limits." />

      <div className="mx-auto max-w-7xl space-y-6 px-page py-8 sm:py-10">
        {access === "denied" && <StaffSignIn body="Sign in with an admin or operator account to see promo codes." />}
        {access === "error" && (
          <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
            Couldn&apos;t reach the promo codes service. Try again in a moment.
          </p>
        )}
        <p aria-live="polite" className={message ? "rounded-2xl bg-ocean-50 px-5 py-3 text-sm text-ocean-800" : "sr-only"}>
          {message}
        </p>

        {access === "ok" && <PromoCodesPanel notify={setMessage} role={role} />}
      </div>
    </div>
  );
}
