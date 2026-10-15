"use client";

// The SEO portal's frame (/seo/*): a sidebar with the workspace sections, the signed-in person and
// sign out. The session is checked on load (/api/seo/portal/me): signed out goes to /seo/login,
// a non-SEO account sees "no access". Every API call checks the role again on the server, so the
// sidebar only hides what a role can't use. A lapsed session mid-work returns to the sign-in page
// (shared.tsx). No public header, footer or concierge is shown here (SiteFrame skips /seo).

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Braces,
  ClipboardCheck,
  FileSearch,
  FileText,
  Gauge,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Newspaper,
  Settings,
  Shuffle,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { SeoBaseContext } from "@/components/admin/seo/shared";

export interface PortalMe {
  id: string;
  name: string;
  role: "ADMIN" | "SEO_MANAGER" | "EDITOR" | "VIEWER";
  seo: { read: boolean; manage: boolean; editContent: boolean };
  staff: boolean;
}

interface PortalState {
  me: PortalMe;
  notify: (message: string) => void;
}

const PortalContext = createContext<PortalState | null>(null);

export function usePortal(): PortalState {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal outside PortalShell");
  return ctx;
}

export const NAV = [
  { href: "/seo", label: "Overview", icon: LayoutDashboard },
  { href: "/seo/audit", label: "Website audit", icon: FileSearch },
  { href: "/seo/pages", label: "Pages & metadata", icon: FileText },
  { href: "/seo/blog", label: "Blog SEO", icon: Newspaper },
  { href: "/seo/keywords", label: "Keywords", icon: KeyRound },
  { href: "/seo/technical", label: "Technical SEO", icon: Gauge },
  { href: "/seo/schema", label: "Schema markup", icon: Braces },
  { href: "/seo/redirects", label: "Redirects", icon: Shuffle },
  { href: "/seo/images", label: "Images & alt text", icon: ImageIcon },
  { href: "/seo/analytics", label: "Analytics & Search Console", icon: BarChart3 },
  { href: "/seo/tasks", label: "SEO tasks", icon: ListTodo },
  { href: "/seo/checklist", label: "Migration checklist", icon: ClipboardCheck },
  { href: "/seo/activity", label: "Change history", icon: Activity },
  { href: "/seo/settings", label: "Settings", icon: Settings },
];

const ROLE_LABEL: Record<PortalMe["role"], string> = { ADMIN: "Admin", SEO_MANAGER: "SEO manager", EDITOR: "Editor", VIEWER: "Viewer" };

const isCurrent = (pathname: string, href: string) => (href === "/seo" ? pathname === "/seo" : pathname === href || pathname.startsWith(`${href}/`));

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.assign("/seo/login");
}

export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/seo";
  const router = useRouter();
  const [me, setMe] = useState<PortalMe | null>(null);
  const [state, setState] = useState<"checking" | "ok" | "denied" | "error">("checking");
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/seo/portal/me", { cache: "no-store" })
      .then(async (res) => {
        if (!alive) return;
        if (res.status === 401) {
          router.replace(`/seo/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        if (res.status === 403) return setState("denied");
        if (!res.ok) return setState("error");
        setMe(await res.json());
        setState("ok");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
    // Checked once per visit; the API re-checks the role on every call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the phone menu and clear the last message when the section changes.
  useEffect(() => {
    setMenuOpen(false);
    setMessage("");
  }, [pathname]);

  const notify = useCallback((m: string) => setMessage(m), []);

  if (state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-obsidian-50 text-slate-600">
        <p role="status">Checking your session…</p>
      </div>
    );
  }
  if (state === "denied" || state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-obsidian-50 px-page">
        <div className="w-full max-w-md rounded-[1.75rem] bg-white p-8 ring-1 ring-obsidian-900/[0.07]">
          <h1 className="text-2xl font-light text-obsidian-900">{state === "denied" ? "No access to the SEO portal" : "Couldn't reach the SEO service"}</h1>
          <p className="mt-2 text-base text-slate-600">
            {state === "denied"
              ? "This account isn't an SEO manager, editor, viewer or admin. Ask an admin to give you SEO access under Admin → Staff, or sign in with a different account."
              : "Try again in a moment."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {state === "denied" ? (
              <button type="button" onClick={() => void signOut()} className="inline-flex h-11 items-center rounded-full bg-ocean-600 px-5 text-sm text-white hover:bg-ocean-700">
                Sign in with another account
              </button>
            ) : (
              <button type="button" onClick={() => window.location.reload()} className="inline-flex h-11 items-center rounded-full bg-ocean-600 px-5 text-sm text-white hover:bg-ocean-700">
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
  if (!me) return null;

  const nav = (
    <nav aria-label="SEO portal sections">
      <ul className="space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const current = isCurrent(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${current ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5 hover:text-white"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-summit-300`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const account = (
    <div className="border-t border-white/10 pt-4 text-sm">
      <p className="truncate text-white">{me.name}</p>
      <p className="text-white/70">{ROLE_LABEL[me.role]}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {me.role === "ADMIN" && (
          <Link href="/admin" className="inline-flex h-10 items-center rounded-full border border-white/20 px-4 text-white/85 hover:bg-white/10">
            Admin
          </Link>
        )}
        <button type="button" onClick={() => void signOut()} className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 px-4 text-white/85 hover:bg-white/10">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <PortalContext.Provider value={{ me, notify }}>
      <SeoBaseContext.Provider value="/seo">
        <a href="#seo-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-obsidian-900">
          Skip to content
        </a>
        <div className="min-h-screen bg-obsidian-50 text-obsidian-900 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
          {/* Sidebar (1024px+) */}
          <aside className="sticky top-0 hidden h-screen flex-col gap-6 overflow-y-auto bg-obsidian-950 px-4 py-6 lg:flex">
            <Link href="/seo" className="flex items-center gap-2.5 px-3 text-white">
              <BrandMark size={28} variant="white" />
              <span className="text-base">Vista Chase SEO</span>
            </Link>
            <div className="flex-1">{nav}</div>
            {account}
          </aside>

          {/* Top bar (phones and tablets) */}
          <header className="sticky top-0 z-30 flex items-center justify-between bg-obsidian-950 px-4 py-3 text-white lg:hidden">
            <Link href="/seo" className="flex items-center gap-2">
              <BrandMark size={24} variant="white" />
              <span className="text-base">Vista Chase SEO</span>
            </Link>
            <button type="button" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-controls="seo-mobile-nav" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
              {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
              <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
            </button>
          </header>
          {menuOpen && (
            <div id="seo-mobile-nav" className="space-y-4 bg-obsidian-950 px-4 pb-6 lg:hidden">
              {nav}
              {account}
            </div>
          )}

          <main id="seo-main" className="min-w-0 px-page py-8">
            <div className="mx-auto max-w-7xl space-y-6">
              {!me.seo.manage && (
                <p className="rounded-2xl bg-white px-5 py-3 text-sm text-obsidian-700 ring-1 ring-obsidian-900/10">
                  {me.seo.editContent
                    ? "You're signed in as an editor: you can draft page and blog copy and work on tasks. Publishing, titles, URLs, redirects and settings stay with the SEO manager."
                    : "You're signed in as a viewer: you can see everything here but not change it."}
                </p>
              )}
              <p aria-live="polite" className={message ? "rounded-2xl bg-ocean-50 px-5 py-3 text-sm text-ocean-800" : "sr-only"}>
                {message}
              </p>
              {children}
            </div>
          </main>
        </div>
      </SeoBaseContext.Provider>
    </PortalContext.Provider>
  );
}

/** Page heading used by every portal section. */
export function PortalHeading({ title, intro, actions }: { title: string; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-light tracking-tight text-obsidian-900">{title}</h1>
        {intro && <p className="mt-1 max-w-3xl text-base text-slate-600">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
