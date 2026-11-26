"use client";

// Partner dashboard → Coupons. Since 2026-11-26 (owner) only the Vista Chase team creates coupon
// codes (Admin → Promo codes, given to a partner). The partner sees the codes made for them, with
// dates, where they apply and how often guests used them, and asks for a new or changed code with
// a change request (/affiliate/requests?category=COUPON).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Scope = "SHARED" | "PRIVATE" | "SHUTTLE";
type State = "ACTIVE" | "INACTIVE" | "SCHEDULED" | "EXPIRED";

interface Coupon {
  id: string;
  code: string;
  percentOff: number;
  label: string;
  isActive: boolean;
  startsOn: string | null;
  endsOn: string | null;
  appliesTo: Scope[];
  uses: number;
  paidBookings: number;
  state: State;
}

const SCOPES: { value: Scope; label: string }[] = [
  { value: "SHARED", label: "Shared tours" },
  { value: "PRIVATE", label: "Private tours" },
  { value: "SHUTTLE", label: "Shuttles" },
];
const STATE: Record<State, { label: string; cls: string }> = {
  ACTIVE: { label: "Active", cls: "bg-emerald-50 text-emerald-700" },
  INACTIVE: { label: "Inactive", cls: "bg-slate-100 text-slate-600" },
  SCHEDULED: { label: "Starts later", cls: "bg-amber-50 text-amber-700" },
  EXPIRED: { label: "Expired", cls: "bg-slate-100 text-slate-600" },
};
const scopeText = (a: Scope[]) => (a.length === SCOPES.length ? "Shared, private & shuttles" : SCOPES.filter((s) => a.includes(s.value)).map((s) => s.label).join(", "));
const fmtDay = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : null);

export function PartnerCoupons() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/affiliates/me/coupons").catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setError("Couldn't load your coupons. Try again in a moment.");
    setError("");
    setCoupons(data.coupons ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section aria-labelledby="coupons-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="coupons-heading" className="text-2xl font-light text-slate-900">Coupons</h1>
          <p className="max-w-2xl text-xs text-slate-500">
            Coupon codes the Vista Chase team made for your guests. Guests type the code at checkout and get the discount; every booking made with your coupon is credited to you.
          </p>
        </div>
        <Link href="/affiliate/requests?category=COUPON" className="golden-summit-btn inline-flex h-11 items-center rounded-full px-6 text-xs font-medium">
          Ask for a coupon
        </Link>
      </div>

      <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
        Only the Vista Chase team creates coupon codes. To get a new code or change one, press Ask for a coupon and tell us the discount, dates and where it should apply.
      </p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {!coupons ? (
        !error && <p className="text-sm text-slate-500">Loading coupons…</p>
      ) : coupons.length === 0 ? (
        <p className="text-sm text-slate-500">No coupons yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm" tabIndex={0} role="region" aria-labelledby="coupons-heading">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                {["Code", "Discount", "Start / end date", "Where it applies", "Uses", "Status"].map((h) => (
                  <th key={h} scope="col" className={`px-5 py-3.5 font-medium ${h === "Uses" ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coupons.map((c) => (
                <tr key={c.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-5 py-3 font-mono text-slate-900">{c.code}</td>
                  <td className="px-5 py-3">{c.label}</td>
                  <td className="px-5 py-3 text-xs text-slate-600">{!c.startsOn && !c.endsOn ? "Any time" : `${fmtDay(c.startsOn) ?? "Now"} to ${fmtDay(c.endsOn) ?? "no end"}`}</td>
                  <td className="px-5 py-3 text-xs text-slate-600">{scopeText(c.appliesTo)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {c.uses}
                    <span className="block text-[11px] text-slate-500">{c.paidBookings} paid</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATE[c.state].cls}`}>{STATE[c.state].label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
