"use client";

// Frame for the staff and partner portals (/admin and /partners/dashboard, /partners/login).
// They are kept apart from the public website: no public header, menu, footer, announcement or
// concierge, and the logo goes to the portal's own home. Any link inside a portal that points at
// a public page (a voucher, a tour page, the partner program page) opens in a new tab, so the
// portal itself never turns into the main website. The SEO portal has its own frame (PortalShell).

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";

export type PortalKind = "admin" | "partner";

const PORTALS: Record<PortalKind | "seo", { home: string; label: string; stayIn: string[] }> = {
  // Admins can also open the SEO portal from the admin tabs.
  admin: { home: "/admin", label: "Vista Chase Admin", stayIn: ["/admin", "/seo"] },
  partner: { home: "/partners/dashboard", label: "Vista Chase Partners", stayIn: ["/partners/dashboard", "/partners/login"] },
  // Used only for its links: the SEO portal draws its own frame (PortalShell). Admins switch to /admin.
  seo: { home: "/seo", label: "Vista Chase SEO", stayIn: ["/seo", "/admin"] },
};

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

/** Whether a same-site path belongs to the portal (or is an API/file call), so it may open in place. */
export function staysInPortal(kind: PortalKind | "seo", path: string): boolean {
  if (under(path, "/api") || under(path, "/media") || under(path, "/_next")) return true;
  return PORTALS[kind].stayIn.some((base) => under(path, base));
}

export function portalKindFor(pathname: string | null | undefined): PortalKind | null {
  if (!pathname) return null;
  if (under(pathname, "/admin")) return "admin";
  if (under(pathname, "/partners/dashboard") || under(pathname, "/partners/login")) return "partner";
  return null;
}

/** Links to the public site open in a new tab instead of replacing the portal. Runs in the capture
 * phase so it sees next/link clicks before the router does. */
export function usePortalLinks(kind: PortalKind | "seo") {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return; // mailto:, tel:, other sites: browser default
      if (staysInPortal(kind, url.pathname)) return;
      event.preventDefault();
      event.stopPropagation();
      window.open(url.href, "_blank", "noopener,noreferrer");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [kind]);
}

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.assign("/admin/login");
}

export function PortalFrame({ kind, children }: { kind: PortalKind | "seo"; children: React.ReactNode }) {
  const portal = PORTALS[kind];
  const onSignIn = usePathname()?.startsWith("/admin/login") ?? false;

  usePortalLinks(kind);

  return (
    <div className="flex min-h-screen flex-col bg-obsidian-50">
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-obsidian-900"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 bg-obsidian-950 text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-page">
          <Link
            href={portal.home}
            className="inline-flex items-center gap-2.5 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <BrandMark size={28} variant="white" />
            <span className="text-base">{portal.label}</span>
          </Link>
          {kind === "admin" && !onSignIn && (
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 px-4 text-sm text-white/85 hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          )}
        </div>
      </header>
      <main id="portal-main" className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}

/** Renders nothing; keeps a portal's public-site links in new tabs (used by the SEO portal's layout). */
export function PortalLinks({ kind }: { kind: PortalKind | "seo" }) {
  usePortalLinks(kind);
  return null;
}
