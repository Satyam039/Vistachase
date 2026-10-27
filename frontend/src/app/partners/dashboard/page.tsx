"use client";

// Partner dashboard: overview, referral link builder, referred bookings, commission ledger,
// payouts and profile (no guest details anywhere). Data: GET /api/affiliates/me and /me/*.
// Links carry ?ref=<code>; the site keeps the code for 30 days and credits bookings to the
// partner (src/middleware.ts). Commission is earned only when a referred booking is paid.

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, Clock, Copy, LogOut } from "lucide-react";
import { Dropdown } from "@/components/forms/Dropdown";

interface Profile {
  name: string;
  contactName: string;
  email: string;
  phone: string | null;
  website: string | null;
  payoutEmail: string | null;
}

interface Dashboard {
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

interface PartnerBooking {
  reference: string;
  experience: string;
  date: string;
  guests: number;
  total: number;
  commission: number;
  status: string;
}

interface CommissionLine {
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

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: "DRAFT" | "PAID";
  method: string | null;
  reference: string | null;
  paidAt: string | null;
  createdAt: string;
}

const TABS = [
  ["overview", "Overview"],
  ["links", "Links"],
  ["bookings", "Bookings"],
  ["commissions", "Commissions"],
  ["payouts", "Payouts"],
  ["profile", "Profile"],
] as const;
type Tab = (typeof TABS)[number][0];

interface TourOption {
  slug: string;
  title: string;
}

const money = (n: number) => `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const SITE = "https://www.vistachase.com";
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const words = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
const LINE_LABEL: Record<CommissionLine["type"], string> = { EARNED: "Earned", REVERSAL: "Refund reversal", ADJUSTMENT: "Adjustment" };
const STATUS_HELP: Record<CommissionLine["status"], string> = {
  PENDING: "Pending until the tour runs",
  APPROVED: "Approved, in the next payout",
  PAID: "Paid",
};
const PAGE_SIZE = 25;

export default function PartnerDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "signed-out" | "not-partner">("loading");
  const [tours, setTours] = useState<TourOption[]>([]);
  const [target, setTarget] = useState("");
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

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
        <Link href={state === "signed-out" ? "/partners/login" : "/partners#apply"} className="golden-summit-btn inline-flex h-12 items-center rounded-full px-7 text-base">
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
            <p className="text-sm uppercase tracking-[0.22em] text-ocean-600">Partner dashboard</p>
            <h1 className="text-4xl font-light">{affiliate.name}</h1>
            <p className="text-base text-slate-700">
              Referral code <span className="font-mono">{affiliate.code}</span> · {Math.round(affiliate.commissionRate * 100)}% commission
            </p>
          </div>
          <button type="button" onClick={signOut} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-obsidian-900/10 bg-white px-5 text-sm hover:bg-obsidian-50">
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

        <div role="tablist" aria-label="Dashboard sections" className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(([id, name]) => (
            <button
              key={id}
              id={`tab-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              onClick={() => setTab(id)}
              className={`inline-flex h-11 shrink-0 items-center rounded-full border px-5 text-sm ${
                tab === id ? "border-obsidian-900 bg-obsidian-900 text-white" : "border-obsidian-900/10 bg-white text-obsidian-900 hover:border-obsidian-900/40"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="space-y-10">
          {tab === "overview" && (
            <>
              <section aria-labelledby="totals-heading" className="space-y-4">
                <h2 id="totals-heading" className="text-2xl font-light">Your results</h2>
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Paid bookings", String(totals.bookings)],
                    ["Guests", String(totals.guests)],
                    ["Booking value", `${money(totals.revenue)} ${totals.currency}`],
                    ["Commission (net)", `${money(totals.commission)} ${totals.currency}`],
                    ["Pending", money(totals.pending)],
                    ["Approved, not yet paid", money(totals.approved)],
                    ["Paid to you", money(totals.paid)],
                    ["Reversed by refunds", money(totals.reversed)],
                    ["Link clicks (30 days)", String(totals.clicks30d)],
                    ["Conversion (30 days)", totals.conversion30d === null ? "–" : `${totals.conversion30d}%`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-none bg-white p-6 ring-1 ring-obsidian-900/[0.07]">
                      <dt className="text-sm text-slate-600">{label}</dt>
                      <dd className="mt-1 text-3xl font-light">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-sm text-slate-600">
                  Commission is earned when a guest you referred pays. It stays pending until the tour has run, then it&apos;s approved for your next payout. Refunds reduce it.
                </p>
              </section>
              <section aria-labelledby="recent-heading" className="space-y-4">
                <h2 id="recent-heading" className="text-2xl font-light">Recent referred bookings</h2>
                <BookingsTable rows={recentBookings} labelledBy="recent-heading" />
              </section>
            </>
          )}

          {tab === "links" && (
            <section aria-labelledby="links-heading" className="space-y-4 rounded-none bg-white p-6 ring-1 ring-obsidian-900/[0.07] sm:p-8">
              <h2 id="links-heading" className="text-2xl font-light">Your referral link</h2>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
                <Dropdown
                  id="link-target"
                  label="Link to"
                  value={target}
                  onChange={setTarget}
                  searchable={tours.length > 8}
                  searchPlaceholder="Search tours"
                  options={[{ value: "", label: "Home page" }, ...tours.map((t) => ({ value: t.slug, label: t.title }))]}
                />
                <div className="space-y-1.5">
                  <label htmlFor="link-value" className="text-sm text-slate-700">Link to share</label>
                  <div className="flex gap-2">
                    <input id="link-value" readOnly value={link} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
                    <button type="button" onClick={copy} className="golden-summit-btn inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm">
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
          )}

          {tab === "bookings" && <BookingsPanel />}
          {tab === "commissions" && <CommissionsPanel />}
          {tab === "payouts" && <PayoutsPanel />}
          {tab === "profile" && <ProfilePanel profile={affiliate} onSaved={loadDashboard} />}
        </div>
      </div>
    </div>
  );
}

function Table({ labelledBy, head, children }: { labelledBy: string; head: [string, boolean?][]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-none bg-white ring-1 ring-obsidian-900/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600" tabIndex={0} role="region" aria-labelledby={labelledBy}>
      <table className="w-full text-left text-base">
        <thead className="border-b border-obsidian-900/[0.07] bg-obsidian-50 text-xs uppercase tracking-wider text-slate-600">
          <tr>
            {head.map(([h, right]) => (
              <th key={h} scope="col" className={`px-5 py-3 font-normal ${right ? "text-right" : ""}`}>
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
  if (rows.length === 0) return <p className="text-base text-slate-700">No referred bookings yet. Share your link to get started.</p>;
  return (
    <Table labelledBy={labelledBy} head={[["Reference"], ["Experience"], ["Date"], ["Guests"], ["Value", true], ["Commission", true], ["Status"]]}>
      {rows.map((b) => (
        <tr key={b.reference}>
          <td className="px-5 py-3 font-mono text-sm">{b.reference}</td>
          <td className="px-5 py-3">{b.experience}</td>
          <td className="px-5 py-3">{day(b.date)}</td>
          <td className="px-5 py-3">{b.guests}</td>
          <td className="px-5 py-3 text-right">{money(b.total)}</td>
          <td className="px-5 py-3 text-right">{money(b.commission)}</td>
          <td className="px-5 py-3 text-sm">{words(b.status)}</td>
        </tr>
      ))}
    </Table>
  );
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-end gap-3 text-sm">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="h-10 rounded-full border border-obsidian-900/10 bg-white px-4 disabled:opacity-50">
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="h-10 rounded-full border border-obsidian-900/10 bg-white px-4 disabled:opacity-50">
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
        <h2 id="bookings-heading" className="text-2xl font-light">Referred bookings</h2>
        <div className="w-60">
          <Dropdown
            id="booking-status"
            label="Status"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={BOOKING_FILTERS.map((f) => ({ value: f, label: f ? words(f) : "All bookings" }))}
          />
        </div>
      </div>
      {error && <p role="alert" className="text-base text-red-700">{error}</p>}
      {data ? <BookingsTable rows={data.rows} labelledBy="bookings-heading" /> : !error && <p role="status">Loading…</p>}
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
        <h2 id="commissions-heading" className="text-2xl font-light">Commission statement</h2>
        <div className="w-60">
          <Dropdown
            id="commission-status"
            label="Status"
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
        <p className="text-base text-slate-700">
          Pending {money(totals.pending)} · Approved {money(totals.approved)} · Paid {money(totals.paid)} · Net {money(totals.net)} CAD
        </p>
      )}
      {error && <p role="alert" className="text-base text-red-700">{error}</p>}
      {!data ? (
        !error && <p role="status">Loading…</p>
      ) : data.rows.length === 0 ? (
        <p className="text-base text-slate-700">No commission yet. It appears here when a guest you referred pays.</p>
      ) : (
        <Table labelledBy="commissions-heading" head={[["Date"], ["Booking"], ["Line"], ["Status"], ["Basis", true], ["Amount", true]]}>
          {data.rows.map((l) => (
            <tr key={l.id}>
              <td className="px-5 py-3 text-sm">{day(l.createdAt)}</td>
              <td className="px-5 py-3">
                {l.bookingReference ? (
                  <>
                    <span className="block font-mono text-sm">{l.bookingReference}</span>
                    <span className="block text-sm text-slate-600">
                      {l.experience}
                      {l.tourDate ? ` · ${day(l.tourDate)}` : ""}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-slate-600">{l.reason ?? "–"}</span>
                )}
              </td>
              <td className="px-5 py-3 text-sm">{LINE_LABEL[l.type]}</td>
              <td className="px-5 py-3 text-sm">{STATUS_HELP[l.status]}</td>
              <td className="px-5 py-3 text-right">{l.basis ? money(l.basis) : "–"}</td>
              <td className={`px-5 py-3 text-right ${l.amount < 0 ? "text-red-700" : ""}`}>{money(l.amount)}</td>
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
      <h2 id="payouts-heading" className="text-2xl font-light">Payouts</h2>
      <p className="text-base text-slate-700">Approved commission is paid out by Vista Chase to the payout details on file. Each payout shows its transfer reference once sent.</p>
      {error && <p role="alert" className="text-base text-red-700">{error}</p>}
      {!payouts ? (
        !error && <p role="status">Loading…</p>
      ) : payouts.length === 0 ? (
        <p className="text-base text-slate-700">No payouts yet.</p>
      ) : (
        <Table labelledBy="payouts-heading" head={[["Created"], ["Status"], ["Method"], ["Reference"], ["Paid on"], ["Amount", true]]}>
          {payouts.map((p) => (
            <tr key={p.id}>
              <td className="px-5 py-3 text-sm">{day(p.createdAt)}</td>
              <td className="px-5 py-3 text-sm">{p.status === "DRAFT" ? "Being prepared" : "Sent"}</td>
              <td className="px-5 py-3 text-sm">{p.method ?? "–"}</td>
              <td className="px-5 py-3 font-mono text-sm">{p.reference ?? "–"}</td>
              <td className="px-5 py-3 text-sm">{day(p.paidAt) || "–"}</td>
              <td className="px-5 py-3 text-right">
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
      setMessage({ ok: true, text: "Profile saved." });
      await onSaved();
    } else {
      setMessage({ ok: false, text: "Couldn't save. Check the website starts with https:// and the emails are valid." });
    }
  }

  const fields: [keyof typeof form, string, string, string][] = [
    ["name", "Business name", "text", "organization"],
    ["contactName", "Contact name", "text", "name"],
    ["phone", "Phone", "tel", "tel"],
    ["website", "Website", "url", "url"],
    ["payoutEmail", "Payout email (e-Transfer or PayPal)", "email", "email"],
  ];

  return (
    <section aria-labelledby="profile-heading" className="space-y-4 rounded-none bg-white p-6 ring-1 ring-obsidian-900/[0.07] sm:p-8">
      <h2 id="profile-heading" className="text-2xl font-light">Profile</h2>
      <p className="text-base text-slate-700">Sign-in email: {profile.email}. To change it, your referral code or your commission, contact Vista Chase.</p>
      <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
        {fields.map(([key, label, type, auto]) => (
          <div key={key} className="space-y-1.5">
            <label htmlFor={`profile-${key}`} className="text-sm text-slate-700">
              {label}
            </label>
            <input
              id={`profile-${key}`}
              type={type}
              autoComplete={auto}
              value={form[key]}
              required={key === "name" || key === "contactName"}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base"
            />
          </div>
        ))}
        <div className="flex items-center gap-4 md:col-span-2">
          <button type="submit" disabled={saving} className="golden-summit-btn inline-flex h-12 items-center rounded-full px-7 text-base disabled:opacity-60">
            {saving ? "Saving…" : "Save profile"}
          </button>
          <p aria-live="polite" className={`text-sm ${message?.ok ? "text-ocean-700" : "text-red-700"}`}>
            {message?.text}
          </p>
        </div>
      </form>
    </section>
  );
}
