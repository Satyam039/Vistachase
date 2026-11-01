"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";
import {
  LayoutDashboard,
  Link2,
  Ticket,
  BadgePercent,
  Wallet,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";

export const AFFILIATE_TABS = [
  { label: "Overview", href: "/affiliate/dashboard", icon: LayoutDashboard },
  { label: "Referrals", href: "/affiliate/referrals", icon: Link2 },
  { label: "Bookings", href: "/affiliate/bookings", icon: Ticket },
  { label: "Commissions", href: "/affiliate/commissions", icon: BadgePercent },
  { label: "Payouts", href: "/affiliate/payouts", icon: Wallet },
  { label: "Reports", href: "/affiliate/reports", icon: BarChart3 },
  { label: "Settings", href: "/affiliate/settings", icon: Settings },
];

interface AffiliateInfo {
  name: string;
  code: string;
  commissionRate: number;
  status: string;
}

export function AffiliateHeader({ current }: { current?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [partner, setPartner] = useState<AffiliateInfo | null>(null);

  useEffect(() => {
    fetch("/api/affiliates/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.affiliate) {
          setPartner({
            name: data.affiliate.name,
            code: data.affiliate.code,
            commissionRate: data.affiliate.commissionRate,
            status: data.affiliate.status,
          });
        }
      })
      .catch(() => undefined);
  }, []);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/affiliate/login");
  }

  const activeHref = current || pathname;

  return (
    <header className="border-b border-slate-200 bg-white">
      {/* Top Bar */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-page py-4">
        <div className="flex items-center gap-4">
          <Link href="/affiliate/dashboard" className="flex items-center gap-3">
            <BrandMark size={36} variant="dark" />
            <div className="flex flex-col">
              <span className="font-serif text-lg font-light tracking-wide text-obsidian-900">Vista Chase</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-ocean-700">Affiliate Portal</span>
            </div>
          </Link>
        </div>

        {partner ? (
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">{partner.name}</p>
              <p className="text-xs text-slate-500">
                Code <span className="font-mono font-medium text-slate-700">{partner.code}</span> ·{" "}
                {Math.round(partner.commissionRate * 100)}% Comm.
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        ) : (
          <Link
            href="/affiliate/login"
            className="inline-flex h-9 items-center rounded-full bg-ocean-800 px-4 text-xs font-medium text-white hover:bg-ocean-900"
          >
            Sign in
          </Link>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="mx-auto max-w-7xl px-page">
        <nav aria-label="Affiliate sections" className="vc-rail -mx-page flex gap-1 overflow-x-auto px-page">
          {AFFILIATE_TABS.map(({ label, href, icon: Icon }) => {
            const isActive = activeHref === href || (href !== "/affiliate/dashboard" && activeHref.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-ocean-600 text-ocean-900"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
