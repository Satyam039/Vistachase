"use client";

// The staff admin frame (/admin/*, not the sign-in page): a dark sidebar on the left with the admin
// sections (the same list and role rules as before, ADMIN_TABS), a Requests shortcut with its
// count, the signed-in person and Sign out, laid out like the SEO portal (PortalShell). Phones and
// tablets get a top bar with a menu button instead. The pages themselves are unchanged; only the
// section links moved here from the tabs under each page title (AdminHeader).

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, LogOut, Menu, Search, X } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { ADMIN_TABS } from "@/components/admin/AdminHeader";

interface Me {
  name: string;
  role: string;
}

const ROLE_LABEL: Record<string, string> = { ADMIN: "Admin", OPERATOR: "Operator", DISPATCHER: "Dispatcher" };
const OPS = ["ADMIN", "OPERATOR", "DISPATCHER"];

const isCurrent = (pathname: string, href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.assign("/admin/login");
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const [me, setMe] = useState<Me | null>(null);
  const [requests, setRequests] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        const role = d?.user?.role ?? "";
        setMe({ name: d?.user?.name || d?.user?.email || "", role });
        if (!OPS.includes(role)) return;
        return fetch("/api/admin/requests")
          .then((r) => (r.ok ? r.json() : null))
          .then((x: { cancellations?: unknown[]; awaitingApproval?: unknown[]; changes?: unknown[] } | null) => {
            if (alive && x) setRequests((x.cancellations?.length ?? 0) + (x.awaitingApproval?.length ?? 0) + (x.changes?.length ?? 0));
          });
      })
      .catch(() => alive && setMe({ name: "", role: "" }));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  const role = me?.role ?? "";
  // Until the role is known only the current section shows, so no one sees links they can't use.
  const tabs = ADMIN_TABS.filter((t) => (role ? t.roles.includes(role) : isCurrent(pathname, t.href)));
  const linkCls = (current: boolean) =>
    `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${current ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5 hover:text-white"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-summit-300`;

  const nav = (
    <nav aria-label="Admin sections">
      <ul className="space-y-0.5">
        {tabs.map(({ label, href, icon: Icon }) => {
          const current = isCurrent(pathname, href);
          return (
            <li key={href}>
              <Link href={href} aria-current={current ? "page" : undefined} className={linkCls(current)}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
              {href === "/admin/bookings" && OPS.includes(role) && (
                // Already on Bookings: setting the hash fires hashchange, which opens the Requests tab.
                <Link
                  href="/admin/bookings#requests"
                  className={`${linkCls(false)} pl-10`}
                  onClick={(e) => {
                    if (pathname !== "/admin/bookings") return;
                    e.preventDefault();
                    window.location.hash = "requests";
                  }}
                >
                  <Inbox className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Requests
                  {requests ? (
                    <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs text-white" aria-label={`${requests} waiting`}>
                      {requests}
                    </span>
                  ) : null}
                </Link>
              )}
            </li>
          );
        })}
        {role === "ADMIN" && (
          <li>
            <Link href="/seo" className={linkCls(false)}>
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              SEO portal
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );

  const account = (
    <div className="border-t border-white/10 pt-4 text-sm">
      {me?.name && <p className="truncate text-white">{me.name}</p>}
      {role && <p className="text-white/70">{ROLE_LABEL[role] ?? role}</p>}
      <button type="button" onClick={() => void signOut()} className="mt-3 inline-flex h-10 items-center gap-2 rounded-full border border-white/20 px-4 text-white/85 hover:bg-white/10">
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-obsidian-50 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* Sidebar (1024px+) */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 overflow-y-auto bg-obsidian-950 px-4 py-6 print:hidden lg:flex">
        <Link href="/admin" className="flex flex-col items-center gap-2 px-3 text-center text-white">
          <BrandMark size={40} variant="white" />
          <span className="text-lg tracking-[0.18em]">VISTA CHASE</span>
          <span className="text-sm text-white/70">Admin Panel</span>
        </Link>
        <div className="flex-1">{nav}</div>
        {account}
      </aside>

      {/* Top bar (phones and tablets) */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-obsidian-950 px-4 py-3 text-white print:hidden lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <BrandMark size={24} variant="white" />
          <span className="text-base">Vista Chase Admin</span>
        </Link>
        <button type="button" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-controls="admin-mobile-nav" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
          {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
        </button>
      </header>
      {menuOpen && (
        <div id="admin-mobile-nav" className="space-y-4 bg-obsidian-950 px-4 pb-6 lg:hidden">
          {nav}
          {account}
        </div>
      )}

      <main id="portal-main" className="min-w-0">
        {children}
      </main>
    </div>
  );
}
