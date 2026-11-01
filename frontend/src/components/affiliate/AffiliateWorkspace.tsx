"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, Clock, Copy, LogOut, ExternalLink, BarChart2, RefreshCw } from "lucide-react";
import { Dropdown } from "@/components/forms/Dropdown";
import { AffiliateHeader } from "./AffiliateHeader";

export interface Profile {
  name: string;
  contactName: string;
  email: string;
  phone: string | null;
  website: string | null;
  payoutEmail: string | null;
}

export interface Dashboard {
  affiliate: Profile & { code: string; type: string; status: string; commissionRate: number; bokunChannelId: string | null };
  totals: {
    bookings: number;
    guests: number;
    revenue: number;
    commission: number;
    pending: number;
    approved: number;
    paid: number;
    reversed: number;
    clicks30d: number;
    conversion30d: number | null;
    currency: string;
  };
  recentBookings: PartnerBooking[];
}

export interface PartnerBooking {
  reference: string;
  experience: string;
  date: string;
  guests: number;
  total: number;
  commission: number;
  status: string;
}

export interface CommissionLine {
  id: string;
  type: "EARNED" | "REVERSAL" | "ADJUSTMENT";
  status: "PENDING" | "APPROVED" | "PAID";
  amount: number;
  basis: number;
  reason: string | null;
  bookingReference: string | null;
  experience: string | null;
  tourDate: string | null;
  createdAt: string;
}

export interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: "DRAFT" | "PAID";
  method: string | null;
  reference: string | null;
  paidAt: string | null;
  createdAt: string;
}

export type Tab = "overview" | "referrals" | "bookings" | "commissions" | "payouts" | "reports" | "settings";

interface TourOption {
  slug: string;
  title: string;
}

const money = (n: number) => `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const SITE = typeof window !== "undefined" ? window.location.origin : "https://www.vistachase.com";
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const words = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
const LINE_LABEL: Record<CommissionLine["type"], string> = { EARNED: "Earned", REVERSAL: "Refund reversal", ADJUSTMENT: "Adjustment" };
const STATUS_HELP: Record<CommissionLine["status"], string> = {
  PENDING: "Pending until the tour runs",
  APPROVED: "Approved, in the next payout",
  PAID: "Paid",
};
const PAGE_SIZE = 25;

export function AffiliateWorkspace({ activeTab = "overview" }: { activeTab?: Tab }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "signed-out" | "not-partner">("loading");
  const [tours, setTours] = useState<TourOption[]>([]);
  const [target, setTarget] = useState("");
  const [copied, setCopied] = useState(false);

  const loadDashboard = useCallback(async () => {
    const res = await fetch("/api/affiliates/me");
    if (res.status === 401) return setState("signed-out");
    if (res.status === 404) return setState("not-partner");
    if (!res.ok) return setState("signed-out");
    setData(await res.json());
    setState("ready");
  }, []);

  useEffect(() => {
    void loadDashboard();
    fetch("/api/tours")
      .then((r) => r.json())
      .then((d) => setTours((d.tours ?? []).map((t: TourOption) => ({ slug: t.slug, title: t.title }))))
      .catch(() => setTours([]));
  }, [loadDashboard]);

  const link = useMemo(() => (data ? `${SITE}/${target}?ref=${data.affiliate.code}` : ""), [data, target]);

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  if (state === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading affiliate workspace…</p>
      </div>
    );
  }

  if (state !== "ready" || !data) {
    return (
      <div className="mx-auto max-w-xl space-y-5 px-page py-24 text-center">
        <h1 className="text-3xl font-light text-slate-900">
          {state === "signed-out" ? "Sign in to your Affiliate Dashboard" : "Partner Account Required"}
        </h1>
        <p className="text-sm text-slate-600">
          {state === "signed-out"
            ? "Sign in with your partner credentials to manage referrals, view bookings and track payouts."
            : "This account isn't registered as a partner yet. Submit an application to get started."}
        </p>
        <Link
          href={state === "signed-out" ? "/affiliate/login" : "/affiliate/register"}
          className="golden-summit-btn inline-flex h-12 items-center rounded-full px-7 text-sm font-medium"
        >
          {state === "signed-out" ? "Affiliate Sign In" : "Apply to Partner Program"}
        </Link>
      </div>
    );
  }

  const { affiliate, totals, recentBookings } = data;
  const active = affiliate.status === "ACTIVE";

  return (
    <div className="bg-slate-50 pb-20 text-slate-900">
      <AffiliateHeader current={`/affiliate/${activeTab}`} />

      <main className="mx-auto max-w-7xl px-page pt-8 space-y-8">
        {!active && (
          <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <p className="font-medium">
                {affiliate.status === "PENDING" ? "Application Under Review" : "Account Suspended"}
              </p>
              <p className="mt-0.5 text-amber-800">
                {affiliate.status === "PENDING"
                  ? "Your application is currently being reviewed. You can create your referral links now; bookings are credited once approved."
                  : "Your affiliate account is currently suspended. Please contact Vista Chase support for assistance."}
              </p>
            </div>
          </div>
        )}

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h1 className="text-2xl font-light text-slate-900">Performance Summary</h1>
                  <p className="text-xs text-slate-500">Live booking attribution and commission totals.</p>
                </div>
                <span className="text-xs text-slate-500 font-mono">Commission Rate: {Math.round(affiliate.commissionRate * 100)}%</span>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Paid Bookings", String(totals.bookings)],
                  ["Referred Guests", String(totals.guests)],
                  ["Referred Revenue", `${money(totals.revenue)} ${totals.currency}`],
                  ["Net Commission", `${money(totals.commission)} ${totals.currency}`],
                  ["Pending Commission", money(totals.pending)],
                  ["Approved Commission", money(totals.approved)],
                  ["Total Paid to You", money(totals.paid)],
                  ["Reversed by Refunds", money(totals.reversed)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</dt>
                    <dd className="mt-1.5 text-2xl font-light text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Quick Link Generator */}
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-medium text-slate-900">Your Primary Referral Link</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  readOnly
                  value={`${SITE}/?ref=${affiliate.code}`}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-800"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${SITE}/?ref=${affiliate.code}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="golden-summit-btn inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-xs font-medium"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy Link"}
                </button>
              </div>
            </section>

            {/* Recent Bookings */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-slate-900">Recent Referred Bookings</h2>
                <Link href="/affiliate/bookings" className="text-xs font-medium text-ocean-700 hover:underline">
                  View all bookings →
                </Link>
              </div>
              <BookingsTable rows={recentBookings} labelledBy="recent-heading" />
            </section>
          </div>
        )}

        {/* Tab 2: Referrals */}
        {activeTab === "referrals" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
            <div>
              <h1 className="text-2xl font-light text-slate-900">Referral Link Generator</h1>
              <p className="mt-1 text-sm text-slate-500">
                Generate customized partner links for specific tours, destinations, or the general site.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
              <Dropdown
                id="link-target"
                label="Destination Page"
                value={target}
                onChange={setTarget}
                searchable={tours.length > 8}
                searchPlaceholder="Search experiences"
                options={[{ value: "", label: "Homepage (/)" }, ...tours.map((t) => ({ value: t.slug, label: t.title }))]}
              />

              <div className="space-y-2">
                <label htmlFor="link-value" className="text-xs font-medium uppercase tracking-wider text-slate-700">
                  Ready-to-share link
                </label>
                <div className="flex gap-2">
                  <input
                    id="link-value"
                    readOnly
                    value={link}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-800"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={copy}
                    className="golden-summit-btn inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-xs font-medium"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  {copied
                    ? "Link copied to clipboard!"
                    : "Any bookings completed within 30 days of clicking this link are automatically credited to your account."}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Tab 3: Bookings */}
        {activeTab === "bookings" && <BookingsPanel />}

        {/* Tab 4: Commissions */}
        {activeTab === "commissions" && <CommissionsPanel />}

        {/* Tab 5: Payouts */}
        {activeTab === "payouts" && <PayoutsPanel />}

        {/* Tab 6: Reports */}
        {activeTab === "reports" && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-light text-slate-900">Traffic & Conversion Analytics</h1>
              <p className="mt-1 text-sm text-slate-500">30-day tracking metrics and visitor conversion rates.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Clicks (Last 30 Days)</span>
                <p className="mt-2 text-3xl font-light text-slate-900">{totals.clicks30d}</p>
                <p className="mt-1 text-xs text-slate-500">Referred unique visits</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Conversion Rate</span>
                <p className="mt-2 text-3xl font-light text-slate-900">
                  {totals.conversion30d === null ? "–" : `${totals.conversion30d}%`}
                </p>
                <p className="mt-1 text-xs text-slate-500">Paid bookings per 100 clicks</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Average Guest Size</span>
                <p className="mt-2 text-3xl font-light text-slate-900">
                  {totals.bookings > 0 ? (totals.guests / totals.bookings).toFixed(1) : "–"}
                </p>
                <p className="mt-1 text-xs text-slate-500">Guests per referred booking</p>
              </div>
            </div>
          </section>
        )}

        {/* Tab 7: Settings */}
        {activeTab === "settings" && <ProfilePanel profile={affiliate} onSaved={loadDashboard} />}
      </main>
    </div>
  );
}

function Table({ labelledBy, head, children }: { labelledBy: string; head: [string, boolean?][]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm" tabIndex={0} role="region" aria-labelledby={labelledBy}>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            {head.map(([h, right]) => (
              <th key={h} scope="col" className={`px-5 py-3.5 font-medium ${right ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

function BookingsTable({ rows, labelledBy }: { rows: PartnerBooking[]; labelledBy: string }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">No referred bookings yet. Share your referral links to get started.</p>;
  return (
    <Table labelledBy={labelledBy} head={[["Reference"], ["Experience"], ["Date"], ["Guests"], ["Total Value", true], ["Commission", true], ["Status"]]}>
      {rows.map((b) => (
        <tr key={b.reference} className="hover:bg-slate-50/70">
          <td className="px-5 py-3 font-mono text-xs font-medium text-slate-800">{b.reference}</td>
          <td className="px-5 py-3 font-medium text-slate-900">{b.experience}</td>
          <td className="px-5 py-3 text-slate-600">{day(b.date)}</td>
          <td className="px-5 py-3 text-slate-600">{b.guests}</td>
          <td className="px-5 py-3 text-right text-slate-800 font-medium">{money(b.total)}</td>
          <td className="px-5 py-3 text-right text-emerald-700 font-medium">{money(b.commission)}</td>
          <td className="px-5 py-3 text-xs">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 font-medium ${
              b.status === "CONFIRMED" || b.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
            }`}>
              {words(b.status)}
            </span>
          </td>
        </tr>
      ))}
    </Table>
  );
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-end gap-3 text-xs">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="h-9 rounded-full border border-slate-200 bg-white px-4 disabled:opacity-50">
        Previous
      </button>
      <span className="text-slate-500">
        Page {page} of {pages}
      </span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="h-9 rounded-full border border-slate-200 bg-white px-4 disabled:opacity-50">
        Next
      </button>
    </nav>
  );
}

function usePaged<T>(url: string, key: string) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; rows: T[]; extra: Record<string, unknown> } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const sep = url.includes("?") ? "&" : "?";
    fetch(`${url}${sep}page=${page}&pageSize=${PAGE_SIZE}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const json = await res.json();
        setData({ total: json.total ?? 0, rows: json[key] ?? [], extra: json });
        setError("");
      })
      .catch(() => setError("Couldn't load this list. Try again in a moment."));
  }, [url, key, page]);
  return { page, setPage, data, error };
}

const BOOKING_FILTERS = ["", "CONFIRMED", "COMPLETED", "PENDING_PAYMENT", "CANCELLED", "REFUNDED"] as const;

function BookingsPanel() {
  const [status, setStatus] = useState("");
  const { page, setPage, data, error } = usePaged<PartnerBooking>(`/api/affiliates/me/bookings${status ? `?status=${status}` : ""}`, "bookings");
  return (
    <section aria-labelledby="bookings-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="bookings-heading" className="text-2xl font-light text-slate-900">Referred Bookings</h1>
          <p className="text-xs text-slate-500">All guest reservations attributed to your referral code.</p>
        </div>
        <div className="w-56">
          <Dropdown
            id="booking-status"
            label="Filter by Status"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={BOOKING_FILTERS.map((f) => ({ value: f, label: f ? words(f) : "All bookings" }))}
          />
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {data ? <BookingsTable rows={data.rows} labelledBy="bookings-heading" /> : !error && <p className="text-sm text-slate-500">Loading bookings…</p>}
      {data && <Pager page={page} total={data.total} onPage={setPage} />}
    </section>
  );
}

function CommissionsPanel() {
  const [status, setStatus] = useState("");
  const { page, setPage, data, error } = usePaged<CommissionLine>(`/api/affiliates/me/commissions${status ? `?status=${status}` : ""}`, "lines");
  const totals = data?.extra.totals as Record<string, number> | undefined;
  return (
    <section aria-labelledby="commissions-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="commissions-heading" className="text-2xl font-light text-slate-900">Commission Statement</h1>
          <p className="text-xs text-slate-500">Itemized statement of commissions, adjustments and payout clearances.</p>
        </div>
        <div className="w-56">
          <Dropdown
            id="commission-status"
            label="Filter by Status"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[{ value: "", label: "All lines" }, ...(["PENDING", "APPROVED", "PAID"] as const).map((s) => ({ value: s, label: words(s) }))]}
          />
        </div>
      </div>
      {totals && (
        <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-700 bg-white p-4 rounded-xl border border-slate-200">
          <span>Pending: <strong className="text-slate-900">{money(totals.pending)}</strong></span>
          <span>·</span>
          <span>Approved: <strong className="text-emerald-700">{money(totals.approved)}</strong></span>
          <span>·</span>
          <span>Paid: <strong className="text-slate-900">{money(totals.paid)}</strong></span>
          <span>·</span>
          <span>Net Total: <strong className="text-ocean-800">{money(totals.net)} CAD</strong></span>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!data ? (
        !error && <p className="text-sm text-slate-500">Loading commission ledger…</p>
      ) : data.rows.length === 0 ? (
        <p className="text-sm text-slate-500">No commission records yet. Commission appears here when a referred guest pays.</p>
      ) : (
        <Table labelledBy="commissions-heading" head={[["Date"], ["Booking / Reason"], ["Type"], ["Status"], ["Basis", true], ["Amount", true]]}>
          {data.rows.map((l) => (
            <tr key={l.id} className="hover:bg-slate-50/70">
              <td className="px-5 py-3 text-xs text-slate-600">{day(l.createdAt)}</td>
              <td className="px-5 py-3">
                {l.bookingReference ? (
                  <>
                    <span className="block font-mono text-xs font-medium text-slate-900">{l.bookingReference}</span>
                    <span className="block text-xs text-slate-500">
                      {l.experience}
                      {l.tourDate ? ` · ${day(l.tourDate)}` : ""}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-slate-600">{l.reason ?? "–"}</span>
                )}
              </td>
              <td className="px-5 py-3 text-xs">{LINE_LABEL[l.type]}</td>
              <td className="px-5 py-3 text-xs">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  l.status === "PAID" ? "bg-emerald-50 text-emerald-700" : l.status === "APPROVED" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                }`}>
                  {STATUS_HELP[l.status]}
                </span>
              </td>
              <td className="px-5 py-3 text-right text-xs text-slate-600">{l.basis ? money(l.basis) : "–"}</td>
              <td className={`px-5 py-3 text-right font-medium ${l.amount < 0 ? "text-red-700" : "text-slate-900"}`}>{money(l.amount)}</td>
            </tr>
          ))}
        </Table>
      )}
      {data && <Pager page={page} total={data.total} onPage={setPage} />}
    </section>
  );
}

function PayoutsPanel() {
  const [payouts, setPayouts] = useState<Payout[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/affiliates/me/payouts")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setPayouts((await res.json()).payouts);
      })
      .catch(() => setError("Couldn't load payouts. Try again in a moment."));
  }, []);
  return (
    <section aria-labelledby="payouts-heading" className="space-y-4">
      <div>
        <h1 id="payouts-heading" className="text-2xl font-light text-slate-900">Payout Records</h1>
        <p className="text-xs text-slate-500">Approved commissions are transferred by Vista Chase according to your payout details.</p>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!payouts ? (
        !error && <p className="text-sm text-slate-500">Loading payouts…</p>
      ) : payouts.length === 0 ? (
        <p className="text-sm text-slate-500">No payout disbursements recorded yet.</p>
      ) : (
        <Table labelledBy="payouts-heading" head={[["Created"], ["Status"], ["Method"], ["Reference"], ["Paid Date"], ["Amount", true]]}>
          {payouts.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50/70">
              <td className="px-5 py-3 text-xs text-slate-600">{day(p.createdAt)}</td>
              <td className="px-5 py-3 text-xs">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  p.status === "PAID" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}>
                  {p.status === "DRAFT" ? "Processing" : "Disbursed"}
                </span>
              </td>
              <td className="px-5 py-3 text-xs text-slate-600">{p.method ?? "Direct Transfer"}</td>
              <td className="px-5 py-3 font-mono text-xs text-slate-800">{p.reference ?? "–"}</td>
              <td className="px-5 py-3 text-xs text-slate-600">{day(p.paidAt) || "–"}</td>
              <td className="px-5 py-3 text-right font-medium text-slate-900">
                {money(p.amount)} {p.currency}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}

function ProfilePanel({ profile, onSaved }: { profile: Profile; onSaved: () => Promise<unknown> }) {
  const [form, setForm] = useState({
    name: profile.name,
    contactName: profile.contactName,
    phone: profile.phone ?? "",
    website: profile.website ?? "",
    payoutEmail: profile.payoutEmail ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/affiliates/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, phone: form.phone.trim() || null }),
    }).catch(() => null);
    setSaving(false);
    if (res?.ok) {
      setMessage({ ok: true, text: "Profile details saved successfully." });
      await onSaved();
    } else {
      setMessage({ ok: false, text: "Couldn't save changes. Please ensure URLs start with https:// and email addresses are valid." });
    }
  }

  const fields: [keyof typeof form, string, string, string][] = [
    ["name", "Business / Organization Name", "text", "organization"],
    ["contactName", "Primary Contact Name", "text", "name"],
    ["phone", "Contact Phone", "tel", "tel"],
    ["website", "Website URL", "url", "url"],
    ["payoutEmail", "Payout Email (PayPal or Interac e-Transfer)", "email", "email"],
  ];

  return (
    <section aria-labelledby="profile-heading" className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
      <div>
        <h1 id="profile-heading" className="text-2xl font-light text-slate-900">Partner Profile & Payout Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sign-in email: <span className="font-medium text-slate-800">{profile.email}</span>. To update your sign-in email or referral code, contact support.
        </p>
      </div>

      <form onSubmit={save} className="grid gap-5 md:grid-cols-2">
        {fields.map(([key, label, type, auto]) => (
          <div key={key} className="space-y-1.5">
            <label htmlFor={`profile-${key}`} className="text-xs font-medium uppercase tracking-wider text-slate-700">
              {label}
            </label>
            <input
              id={`profile-${key}`}
              type={type}
              autoComplete={auto}
              value={form[key]}
              required={key === "name" || key === "contactName"}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-ocean-600 focus:outline-none"
            />
          </div>
        ))}
        <div className="flex items-center gap-4 md:col-span-2 pt-2">
          <button type="submit" disabled={saving} className="golden-summit-btn inline-flex h-11 items-center rounded-full px-7 text-xs font-medium disabled:opacity-60">
            {saving ? "Saving…" : "Save Changes"}
          </button>
          {message && (
            <p role="alert" className={`text-xs font-medium ${message.ok ? "text-emerald-700" : "text-red-700"}`}>
              {message.text}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
