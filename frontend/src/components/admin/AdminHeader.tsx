// Shared header for the staff pages: eyebrow, light title, actions on the right and the section
// tabs (Overview, Dispatch, Operations, Partners) underlined under the current page.

import type { ReactNode } from "react";
import Link from "next/link";
import { Handshake, LayoutDashboard, Lock, ArrowRight, Truck, Workflow } from "lucide-react";

export const ADMIN_TABS = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Dispatch", href: "/admin/dispatch", icon: Truck },
  { label: "Operations", href: "/admin/operations", icon: Workflow },
  { label: "Partners", href: "/admin/partners", icon: Handshake },
];

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
          {ADMIN_TABS.map(({ label, href, icon: Icon }) => {
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
        </nav>
      </div>
    </div>
  );
}

/** Signed-out / wrong-role prompt shared by the staff pages. */
export function StaffSignIn({ body = "Sign in with your admin or dispatch account to continue." }: { body?: string }) {
  return (
    <section className="flex flex-col items-start gap-5 rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07] sm:flex-row sm:items-center sm:justify-between sm:p-8">
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
