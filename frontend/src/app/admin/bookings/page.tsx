"use client";

// Staff bookings: find a booking and open its detail (payments, flags, history, approve, cancel),
// answer requests (guests' cancellation requests, bookings waiting for approval), work the flags
// queue (refunds owed, payments due, mismatches), see what reached Bókun and book for a guest
// with Quick Book.
// Panels live in components/admin/staff; every call goes through /api/admin/* (role-checked, audited).

import { useCallback, useEffect, useState } from "react";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";
import { BokunPanel } from "@/components/admin/staff/BokunPanel";
import { BookingsPanel } from "@/components/admin/staff/BookingsPanel";
import { FlagsPanel } from "@/components/admin/staff/FlagsPanel";
import { QuickBookForm } from "@/components/admin/staff/QuickBookForm";
import { RequestsPanel } from "@/components/admin/staff/RequestsPanel";

type SectionId = "bookings" | "requests" | "flags" | "bokun" | "quick-book";
const STAFF_ROLES = ["ADMIN", "OPERATOR", "DISPATCHER"];
const MANAGERS = ["ADMIN", "OPERATOR"];

export default function AdminBookingsPage() {
  const [section, setSection] = useState<SectionId>("bookings");
  const [access, setAccess] = useState<"checking" | "ok" | "denied" | "error">(
    "checking",
  );
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [requestCount, setRequestCount] = useState<number | null>(null);

  const isManager = MANAGERS.includes(role);
  const sections: [SectionId, string][] = [
    ["bookings", "Bookings"],
    ["requests", requestCount ? `Requests (${requestCount})` : "Requests"],
    ["flags", "Flags"],
    ["bokun", "Bókun"],
    ...(isManager
      ? ([["quick-book", "Quick Book"]] as [SectionId, string][])
      : []),
  ];

  // The section is kept in the address (#flags) so it survives reloads and can be linked.
  useEffect(() => {
    const read = () => {
      const hash = window.location.hash.slice(1);
      if (
        hash === "bookings" ||
        hash === "requests" ||
        hash === "flags" ||
        hash === "bokun" ||
        hash === "quick-book"
      )
        setSection(hash);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const goTo = useCallback((id: SectionId) => {
    setSection(id);
    setMessage("");
    window.history.replaceState(null, "", `#${id}`);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403)
          return setAccess("denied");
        if (!res.ok) return setAccess("error");
        const data = (await res.json().catch(() => ({}))) as {
          authenticated?: boolean;
          user?: { role?: string };
        };
        const r = data.user?.role ?? "";
        setRole(r);
        setAccess(
          data.authenticated && STAFF_ROLES.includes(r) ? "ok" : "denied",
        );
      })
      .catch(() => setAccess("error"));
  }, []);

  // How many requests are waiting, for the tab label (the Requests tab refreshes it).
  useEffect(() => {
    if (access !== "ok") return;
    fetch("/api/admin/requests")
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          d: { cancellations?: unknown[]; awaitingApproval?: unknown[] } | null,
        ) => {
          if (d)
            setRequestCount(
              (d.cancellations?.length ?? 0) +
                (d.awaitingApproval?.length ?? 0),
            );
        },
      )
      .catch(() => {});
  }, [access]);

  const shown: SectionId =
    section === "quick-book" && !isManager ? "bookings" : section;

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <AdminHeader
        current="/admin/bookings"
        eyebrow="Staff · Bookings"
        title="Bookings"
        subtitle="Find a booking, approve or cancel it, answer guests' cancellation requests, work open flags and book for a guest at the desk or on the phone."
      />

      <div className="mx-auto max-w-7xl space-y-6 px-page py-8 sm:py-10">
        {access === "denied" && (
          <StaffSignIn body="Sign in with an admin, operator or dispatch account to see bookings." />
        )}
        {access === "error" && (
          <p
            role="alert"
            className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200"
          >
            Couldn&apos;t reach the bookings service. Try again in a moment.
          </p>
        )}
        <p
          aria-live="polite"
          className={
            message
              ? "rounded-2xl bg-ocean-50 px-5 py-3 text-sm text-ocean-800"
              : "sr-only"
          }
        >
          {message}
        </p>

        {access === "ok" && (
          <>
            <div
              role="tablist"
              aria-label="Booking sections"
              className="flex gap-2 overflow-x-auto pb-1"
            >
              {sections.map(([id, name]) => (
                <button
                  key={id}
                  id={`bookings-tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={shown === id}
                  aria-controls={`bookings-panel-${id}`}
                  onClick={() => goTo(id)}
                  className={`inline-flex h-11 shrink-0 items-center rounded-full border px-5 text-sm ${
                    shown === id
                      ? "border-obsidian-900 bg-obsidian-900 text-white"
                      : "border-obsidian-900/10 bg-white text-obsidian-900 hover:border-obsidian-900/40"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            <div
              id={`bookings-panel-${shown}`}
              role="tabpanel"
              aria-labelledby={`bookings-tab-${shown}`}
            >
              {shown === "bookings" && (
                <BookingsPanel notify={setMessage} role={role} />
              )}
              {shown === "requests" && (
                <RequestsPanel
                  notify={setMessage}
                  role={role}
                  onCounts={setRequestCount}
                />
              )}
              {shown === "flags" && (
                <FlagsPanel notify={setMessage} role={role} />
              )}
              {shown === "bokun" && (
                <BokunPanel notify={setMessage} role={role} />
              )}
              {shown === "quick-book" && <QuickBookForm notify={setMessage} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
