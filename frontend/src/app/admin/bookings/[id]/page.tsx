"use client";

// One booking on its own page: Admin → Bookings → open a booking → "Open full page". Laid out as
// the owner's Admin Booking Management reference (components/admin/staff/ManageBooking.tsx).

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";
import { ManageBooking } from "@/components/admin/staff/ManageBooking";

const STAFF_ROLES = ["ADMIN", "OPERATOR", "DISPATCHER"];

export default function ManageBookingPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params.id ?? ""));
  const [access, setAccess] = useState<"checking" | "ok" | "denied" | "error">("checking");
  const [role, setRole] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) return setAccess("denied");
        if (!res.ok) return setAccess("error");
        const data = (await res.json().catch(() => ({}))) as { authenticated?: boolean; user?: { role?: string; name?: string; email?: string } };
        const r = data.user?.role ?? "";
        setRole(r);
        setName(data.user?.name || data.user?.email || "");
        setAccess(data.authenticated && STAFF_ROLES.includes(r) ? "ok" : "denied");
      })
      .catch(() => setAccess("error"));
  }, []);

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <AdminHeader current="/admin/bookings" eyebrow="Staff · Bookings" title="Manage booking" subtitle="Everything about one booking: change the date, cancel, edit, payments, history and Bókun." />
      <div className="mx-auto max-w-7xl px-page py-8 sm:py-10">
        {access === "denied" && <StaffSignIn body="Sign in with an admin, operator or dispatch account to see bookings." />}
        {access === "error" && (
          <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
            Couldn&apos;t reach the bookings service. Try again in a moment.
          </p>
        )}
        {access === "ok" && id && <ManageBooking id={id} role={role} staffName={name} />}
      </div>
    </div>
  );
}
