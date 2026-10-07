"use client";

// Partner dashboard: referral link builder, totals and referred bookings (no guest details).
// Data: GET /api/affiliates/me (the signed-in partner). Links carry ?ref=<code>; the site keeps
// the code for 30 days and credits bookings to the partner (src/middleware.ts).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Clock, Copy, LogOut } from "lucide-react";

interface Dashboard {
  affiliate: { name: string; code: string; type: string; status: string; commissionRate: number; bokunChannelId: string | null };
  totals: { bookings: number; guests: number; revenue: number; commission: number; currency: string };
  recentBookings: { reference: string; experience: string; date: string; guests: number; total: number; commission: number; status: string }[];
}

interface TourOption {
  slug: string;
  title: string;
}

const money = (n: number) => `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const SITE = "https://www.vistachase.com";

export default function PartnerDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "signed-out" | "not-partner">("loading");
  const [tours, setTours] = useState<TourOption[]>([]);
  const [target, setTarget] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/affiliates/me").then(async (res) => {
      if (res.status === 401) return setState("signed-out");
      if (res.status === 404) return setState("not-partner");
      setData(await res.json());
      setState("ready");
    });
    fetch("/api/tours")
      .then((r) => r.json())
      .then((d) => setTours((d.tours ?? []).map((t: TourOption) => ({ slug: t.slug, title: t.title }))))
      .catch(() => setTours([]));
  }, []);

  const link = useMemo(() => (data ? `${SITE}/${target}?ref=${data.affiliate.code}` : ""), [data, target]);

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/partners/login";
  }

  if (state === "loading") {
    return <p className="px-page py-24 text-center text-lg text-slate-700" role="status">Loading your dashboard…</p>;
  }
  if (state !== "ready" || !data) {
    return (
      <div className="mx-auto max-w-xl space-y-4 px-page py-24 text-center">
        <h1 className="text-3xl font-light text-obsidian-900">{state === "signed-out" ? "Sign in to see your dashboard" : "This isn't a partner account"}</h1>
        <Link href={state === "signed-out" ? "/partners/login" : "/partners#apply"} className="golden-summit-btn inline-flex h-12 items-center rounded-md px-7 text-sm uppercase tracking-[0.14em]">
          {state === "signed-out" ? "Partner sign in" : "Apply to partner"}
        </Link>
      </div>
    );
  }

  const { affiliate, totals, recentBookings } = data;
  const active = affiliate.status === "ACTIVE";

  return (
    <div className="bg-obsidian-50 px-page py-16 text-obsidian-900">
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-ocean-600">Partner dashboard</p>
            <h1 className="text-4xl font-light">{affiliate.name}</h1>
            <p className="text-base text-slate-700">
              Referral code <span className="font-mono">{affiliate.code}</span> · {Math.round(affiliate.commissionRate * 100)}% commission
            </p>
          </div>
          <button type="button" onClick={signOut} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm hover:bg-white">
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
        </div>

        {!active && (
          <p role="status" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-base text-amber-900">
            <Clock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            {affiliate.status === "PENDING"
              ? "Your application is being reviewed. You can prepare your links now; bookings are credited once your account is approved."
              : "Your partner account is suspended. Contact us to reactivate it."}
          </p>
        )}

        <section aria-labelledby="links-heading" className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 id="links-heading" className="text-2xl font-light">Your referral link</h2>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <div className="space-y-1.5">
              <label htmlFor="link-target" className="text-sm text-slate-700">Link to</label>
              <select
                id="link-target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base focus:border-ocean-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600"
              >
                <option value="">Home page</option>
                {tours.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="link-value" className="text-sm text-slate-700">Link to share</label>
              <div className="flex gap-2">
                <input id="link-value" readOnly value={link} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
                <button type="button" onClick={copy} className="golden-summit-btn inline-flex min-h-11 items-center gap-2 rounded-md px-5 text-sm uppercase tracking-[0.14em]">
                  {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-sm text-slate-600" aria-live="polite">
                {copied ? "Link copied to the clipboard." : "Bookings made within 30 days of a click on this link are credited to you."}
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="totals-heading" className="space-y-4">
          <h2 id="totals-heading" className="text-2xl font-light">Your results</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Bookings", String(totals.bookings)],
              ["Guests", String(totals.guests)],
              ["Booking value", `${money(totals.revenue)} ${totals.currency}`],
              ["Your commission", `${money(totals.commission)} ${totals.currency}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-3xl border border-slate-200 bg-white p-6">
                <dt className="text-sm uppercase tracking-widest text-slate-600">{label}</dt>
                <dd className="mt-1 text-3xl font-light">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-slate-600">
            Bokun channel: {affiliate.bokunChannelId ? <span className="font-mono">{affiliate.bokunChannelId}</span> : "set up when Vista Chase connects Bokun; your bookings are tracked here until then."}
          </p>
        </section>

        <section aria-labelledby="bookings-heading" className="space-y-4">
          <h2 id="bookings-heading" className="text-2xl font-light">Referred bookings</h2>
          {recentBookings.length === 0 ? (
            <p className="text-base text-slate-700">No referred bookings yet. Share your link to get started.</p>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600" tabIndex={0} role="region" aria-labelledby="bookings-heading">
              <table className="w-full text-left text-base">
                <thead className="border-b border-slate-200 text-sm uppercase tracking-widest text-slate-600">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-normal">Reference</th>
                    <th scope="col" className="px-5 py-3 font-normal">Experience</th>
                    <th scope="col" className="px-5 py-3 font-normal">Date</th>
                    <th scope="col" className="px-5 py-3 font-normal">Guests</th>
                    <th scope="col" className="px-5 py-3 text-right font-normal">Value</th>
                    <th scope="col" className="px-5 py-3 text-right font-normal">Commission</th>
                    <th scope="col" className="px-5 py-3 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentBookings.map((b) => (
                    <tr key={b.reference}>
                      <td className="px-5 py-3 font-mono text-sm">{b.reference}</td>
                      <td className="px-5 py-3">{b.experience}</td>
                      <td className="px-5 py-3">{b.date}</td>
                      <td className="px-5 py-3">{b.guests}</td>
                      <td className="px-5 py-3 text-right">{money(b.total)}</td>
                      <td className="px-5 py-3 text-right">{money(b.commission)}</td>
                      <td className="px-5 py-3 text-sm">{b.status.toLowerCase()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
