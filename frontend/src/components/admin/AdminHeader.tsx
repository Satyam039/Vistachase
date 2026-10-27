"use client";

// Shared header for the staff pages: eyebrow, light title, actions on the right and the section
// tabs underlined under the current page. Tabs follow the signed-in role (the API enforces the
// same rules; this only hides sections a role can't open).

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, Handshake, LayoutDashboard, Lock, ArrowRight, MapPin, ScrollText, Search, Ticket, Truck, Users, Workflow } from "lucide-react";

// Admin pages are for admins, operators and dispatchers only (src/lib/portals.ts). SEO and page
// copy live in the separate SEO portal at /seo, which admins open from here.
const OPS = ["ADMIN", "OPERATOR", "DISPATCHER"];

export const ADMIN_TABS = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard, roles: OPS },
  { label: "Bookings", href: "/admin/bookings", icon: Ticket, roles: OPS },
  { label: "Departures", href: "/admin/departures", icon: CalendarDays, roles: OPS },
  { label: "Dispatch", href: "/admin/dispatch", icon: Truck, roles: OPS },
  { label: "Operations", href: "/admin/operations", icon: Workflow, roles: OPS },
  { label: "Partners", href: "/admin/partners", icon: Handshake, roles: ["ADMIN"] },
  { label: "Pickup stops", href: "/admin/pickup-stops", icon: MapPin, roles: OPS },
  { label: "Audit log", href: "/admin/audit", icon: ScrollText, roles: ["ADMIN"] },
  { label: "Staff", href: "/admin/staff", icon: Users, roles: ["ADMIN"] },
];


/** The signed-in person's role, or null while loading / signed out. */
export function useStaffRole() {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setRole(d?.user?.role ?? ""))
      .catch(() => alive && setRole(""));
    return () => {
      alive = false;
    };
  }, []);
  return role;
}

export function AdminHeader({
  eyebrow = "Staff · Operations",
  title,
  subtitle,
  actions,
  current,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  current: string;
}) {
  const role = useStaffRole();
  // Until the role is known show only the current tab, so a role never sees tabs flash that it can't use.
  const tabs = ADMIN_TABS.filter((t) => (role ? t.roles.includes(role) : t.href === current));
  return (
    <div className="border-b border-obsidian-900/[0.07] bg-white">
      <div className="mx-auto max-w-7xl px-page pt-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-ocean-700">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl">{title}</h1>
            {subtitle && <p className="mt-1 text-base text-slate-600">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <nav aria-label="Admin sections" className="vc-rail -mx-page mt-7 flex gap-1 overflow-x-auto px-page">
          {tabs.map(({ label, href, icon: Icon }) => {
            const isCurrent = href === current;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isCurrent ? "page" : undefined}
                className={`inline-flex h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm transition-colors ${
                  isCurrent ? "border-ocean-600 text-obsidian-900" : "border-transparent text-slate-600 hover:border-obsidian-900/15 hover:text-obsidian-900"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
          {role === "ADMIN" && (
            <Link
              href="/seo"
              className="inline-flex h-12 shrink-0 items-center gap-2 border-b-2 border-transparent px-4 text-sm text-slate-600 hover:border-obsidian-900/15 hover:text-obsidian-900"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              SEO portal
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}

/** Signed-out / wrong-role prompt shared by the staff pages. */
export function StaffSignIn({ body = "Sign in with your admin or dispatch account to continue." }: { body?: string }) {
  return (
    <section className="flex flex-col items-start gap-5 rounded-none bg-white p-6 ring-1 ring-obsidian-900/[0.07] sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div className="flex items-start gap-4">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ocean-50 text-ocean-700">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl text-obsidian-900">Staff sign-in required</h2>
          <p className="mt-1 text-base text-slate-600">{body}</p>
        </div>
      </div>
      <Link href="/login" className="golden-summit-btn inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-6 text-sm">
        Sign in
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
