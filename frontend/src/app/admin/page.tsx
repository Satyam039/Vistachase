"use client";

// Staff overview, in the Vista Chase brand system (light surface, Ocean Teal + Golden Summit,
// light IBM Plex type) with the structure of modern ops dashboards: greeting header with the
// date in Canmore, section tabs, KPI cards, a searchable reservations table, and a side column
// with booking health and shortcuts. Signed-out visitors get a staff sign-in prompt (no staff
// account details are shown on the page). Managers can approve a booking waiting for payment or
// cancel one straight from the reservations table (same endpoints as Admin → Bookings).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Handshake,
  LayoutDashboard,
  Lock,
  MapPin,
  RefreshCw,
  Search,
  Ticket,
  TrendingUp,
  Truck,
  Users,
  Workflow,
  XCircle,
} from "lucide-react";

interface AdminMetrics {
  totalBookings: number;
  confirmedBookings: number;
  totalUsers: number;
  totalDepartures: number;
  activeHoldsCount: number;
  totalRevenue: number;
  recentBookings: Array<{
    id: string;
    bookingReference: string;
    customerName: string;
    customerEmail: string;
    totalSeats: number;
    totalAmount: number;
    currency: string;
    status: string;
    createdAt: string;
    tourDeparture: {
      date: string;
      departureTime: string;
      tour?: { title: string };
      shuttleRoute?: { name: string };
    };
  }>;
}


const SHORTCUTS = [
  { label: "Daily dispatch manifests", body: "Pickup routes and passenger check-in", href: "/admin/dispatch", icon: Truck },
  { label: "Operations board", body: "Departures, capacity and vehicles", href: "/admin/operations", icon: Workflow },
  { label: "Partner program", body: "Approve partners and see referrals", href: "/admin/partners", icon: Handshake },
  { label: "Hotel pickup directory", body: "Banff, Canmore and Lake Louise stops", href: "/pickup-finder", icon: MapPin },
  { label: "Live inventory", body: "Seats and departures as guests see them", href: "/search", icon: Ticket },
];

const money = (n: number) => `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const APPROVABLE = ["PENDING_PAYMENT", "PAID_UNSYNCED"];
const CANCELLABLE = ["PENDING_PAYMENT", "PAID_UNSYNCED", "CONFIRMED"];
const PAYMENT_METHODS = [
  { value: "UNPAID", label: "Not paid yet (mark payment due)" },
  { value: "CASH", label: "Cash" },
  { value: "ETRANSFER", label: "E-transfer" },
  { value: "CARD_TERMINAL", label: "Card terminal" },
  { value: "OTHER", label: "Other" },
];
const REFUNDS = [
  { value: "POLICY", label: "Per cancellation policy" },
  { value: "FULL", label: "Full refund" },
  { value: "NONE", label: "No refund" },
];

type Action = { kind: "approve" | "cancel"; booking: AdminMetrics["recentBookings"][number] };

function statusTone(status: string) {
  if (status === "CONFIRMED") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (status === "CANCELLED" || status === "EXPIRED") return "bg-red-50 text-red-800 ring-red-200";
  if (status === "PENDING" || status === "HELD") return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [greeting, setGreeting] = useState<{ hello: string; date: string } | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [method, setMethod] = useState("UNPAID");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState("POLICY");
  const [notifyGuest, setNotifyGuest] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const openAction = (kind: Action["kind"], booking: Action["booking"]) => {
    setAction({ kind, booking });
    setMethod("UNPAID");
    setReference("");
    setReason("");
    setRefund("POLICY");
    setNotifyGuest(true);
    setActionError(null);
  };

  async function submitAction() {
    if (!action) return;
    const { kind, booking } = action;
    if (kind === "cancel" && reason.trim().length < 3) {
      setActionError("Add a short reason (at least 3 characters).");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const body =
        kind === "approve"
          ? { payment: { method, reference: reference.trim() || undefined }, notifyGuest }
          : { reason: reason.trim(), refund, notifyGuest };
      const res = await fetch(`/api/admin/bookings/${booking.id}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setActionError(res.status === 403 ? "Only managers and admins can do this." : data.error || "That didn't work. Try again.");
        return;
      }
      setNotice(`${booking.bookingReference} ${kind === "approve" ? "approved" : "cancelled"}.`);
      setAction(null);
      fetchMetrics();
    } catch {
      setActionError("Couldn't reach the admin API.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    fetchMetrics();
    const now = new Date();
    const hour = Number(now.toLocaleString("en-CA", { hour: "numeric", hour12: false, timeZone: "America/Edmonton" }));
    setGreeting({
      hello: hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening",
      date: now.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Edmonton" }),
    });
  }, []);

  async function fetchMetrics() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/metrics");
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        setUnauthorized(true);
        setMetrics(null);
      } else if (!res.ok || !data.success) {
        setError(data.error || "Couldn't load the dashboard.");
      } else {
        setUnauthorized(false);
        setMetrics(data.metrics);
      }
    } catch {
      setError("Couldn't reach the admin API.");
    } finally {
      setLoading(false);
    }
  }

  const bookings = useMemo(() => {
    const list = metrics?.recentBookings ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((b) =>
      [b.bookingReference, b.customerName, b.customerEmail, b.tourDeparture?.tour?.title, b.tourDeparture?.shuttleRoute?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [metrics, query]);

  const confirmedRate = metrics && metrics.totalBookings > 0 ? Math.round((metrics.confirmedBookings / metrics.totalBookings) * 100) : 0;

  const kpis = [
    { label: "Revenue", value: metrics ? money(metrics.totalRevenue) : "—", note: "CAD, confirmed bookings", icon: TrendingUp },
    { label: "Confirmed bookings", value: metrics ? String(metrics.confirmedBookings) : "—", note: metrics ? `of ${metrics.totalBookings} total` : "", icon: Ticket },
    { label: "Seats on hold", value: metrics ? String(metrics.activeHoldsCount) : "—", note: "10-minute checkout holds", icon: Clock },
    { label: "Accounts", value: metrics ? String(metrics.totalUsers) : "—", note: "Guests, guides and staff", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <AdminHeader
        current="/admin"
        title={greeting ? greeting.hello : "Welcome"}
        subtitle={greeting ? `${greeting.date} in Canmore` : "Vista Chase operations"}
        actions={
          <>
            <button
              type="button"
              onClick={fetchMetrics}
              disabled={loading}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-obsidian-900/10 bg-white px-4 text-sm text-obsidian-900 hover:bg-obsidian-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />
              Refresh
            </button>
            <Link href="/admin/dispatch" className="golden-summit-btn inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm">
              <Truck className="h-4 w-4" aria-hidden="true" />
              Open dispatch
            </Link>
          </>
        }
      />

      <div className="mx-auto max-w-7xl space-y-8 px-page py-8 sm:py-10">
        {unauthorized && !loading && <StaffSignIn body="Sign in with your admin or dispatch account to see bookings and operations." />}

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
            {error}
          </p>
        )}

        {/* KPIs */}
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key figures">
          {kpis.map(({ label, value, note, icon: Icon }) => (
            <li key={label} className="rounded-none bg-white p-6 ring-1 ring-obsidian-900/[0.07]">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">{label}</p>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ocean-50 text-ocean-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
              {loading ? (
                <span className="mt-3 block h-9 w-32 rounded-lg bg-obsidian-100 motion-safe:animate-pulse" aria-hidden="true" />
              ) : (
                <p className="mt-3 text-3xl font-light tabular-nums text-obsidian-900">{value}</p>
              )}
              <p className="mt-1 text-sm text-slate-600">{note}</p>
            </li>
          ))}
        </ul>

        <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Reservations */}
          <section aria-labelledby="reservations-heading" className="overflow-hidden rounded-none bg-white ring-1 ring-obsidian-900/[0.07]">
            <div className="flex flex-col gap-4 border-b border-obsidian-900/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <h2 id="reservations-heading" className="text-xl text-obsidian-900">
                  Recent reservations
                </h2>
                <p className="text-sm text-slate-600">The latest bookings across all tours and shuttles</p>
                {notice && <p className="mt-1 text-sm text-emerald-700" role="status">{notice}</p>}
              </div>
              <label className="relative block sm:w-72">
                <span className="sr-only">Search reservations</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Reference, guest or tour"
                  className="h-11 w-full rounded-full border border-obsidian-900/10 bg-obsidian-50 pl-10 pr-4 text-sm text-obsidian-900 placeholder:text-slate-500 focus:border-ocean-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-ocean-600/30"
                />
              </label>
            </div>

            <div className="overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ocean-600" tabIndex={0} role="region" aria-label="Reservations table">
              <table className="w-full min-w-[62rem] text-left text-sm">
                <thead className="bg-obsidian-50 text-xs uppercase tracking-wider text-slate-600">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-normal">Reference</th>
                    <th scope="col" className="px-5 py-3 font-normal">Guest</th>
                    <th scope="col" className="px-5 py-3 font-normal">Tour</th>
                    <th scope="col" className="px-5 py-3 font-normal">Departs</th>
                    <th scope="col" className="px-5 py-3 text-right font-normal">Seats</th>
                    <th scope="col" className="px-5 py-3 text-right font-normal">Total</th>
                    <th scope="col" className="px-5 py-3 font-normal">Actions</th>
                    <th scope="col" className="px-5 py-3 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-900/[0.06]">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={8} className="px-5 py-4">
                          <span className="block h-5 rounded bg-obsidian-100 motion-safe:animate-pulse" aria-hidden="true" />
                        </td>
                      </tr>
                    ))
                  ) : bookings.length > 0 ? (
                    bookings.map((b) => (
                      <tr key={b.id} className="transition-colors hover:bg-ocean-50/50">
                        <td className="px-5 py-4">
                          <Link href={`/booking/${b.bookingReference}/voucher`} className="whitespace-nowrap font-mono text-sm text-ocean-700 hover:underline">
                            {b.bookingReference}
                          </Link>
                        </td>
                        <td className="min-w-[12rem] px-5 py-4">
                          <span className="block text-obsidian-900">{b.customerName}</span>
                          <span className="block text-xs text-slate-600">{b.customerEmail}</span>
                        </td>
                        <td className="w-[13rem] min-w-[11rem] px-5 py-4 text-obsidian-900">
                          <span className="line-clamp-2">{b.tourDeparture?.tour?.title || b.tourDeparture?.shuttleRoute?.name || "Tour"}</span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <span className="block text-obsidian-900">{b.tourDeparture?.date}</span>
                          <span className="block text-xs text-slate-600">{b.tourDeparture?.departureTime}</span>
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums">{b.totalSeats}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-obsidian-900">{money(b.totalAmount)}</td>
                        <td className="px-5 py-4">
                          <div className="flex gap-2">
                            {APPROVABLE.includes(b.status) && (
                              <button
                                type="button"
                                onClick={() => openAction("approve", b)}
                                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-700 px-3 text-xs text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Approve
                              </button>
                            )}
                            {CANCELLABLE.includes(b.status) && (
                              <button
                                type="button"
                                onClick={() => openAction("cancel", b)}
                                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-red-200 px-3 text-xs text-red-700 hover:border-red-700 hover:bg-red-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                              >
                                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                Cancel
                              </button>
                            )}
                            {!APPROVABLE.includes(b.status) && !CANCELLABLE.includes(b.status) && <span className="text-xs text-slate-500">—</span>}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs ring-1 ${statusTone(b.status)}`}>
                            {(b.status.charAt(0) + b.status.slice(1).toLowerCase()).replace(/_/g, " ")}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-600">
                        {query ? `No reservations match “${query}”.` : unauthorized ? "Sign in to see reservations." : "No bookings yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Side column */}
          <div className="grid items-start gap-6 lg:grid-cols-2 2xl:grid-cols-1">
            <section aria-labelledby="health-heading" className="rounded-none bg-ocean-950 p-6 text-white">
              <h2 id="health-heading" className="text-base text-white">
                Booking health
              </h2>
              <p className="mt-4 text-4xl font-light tabular-nums text-white">{metrics ? `${confirmedRate}%` : "—"}</p>
              <p className="text-sm text-white/75">of bookings confirmed</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10" role="presentation">
                <span className="block h-full rounded-full bg-summit-500 transition-[width] duration-700" style={{ width: `${confirmedRate}%` }} />
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-white/70">Departures</dt>
                  <dd className="text-lg tabular-nums text-white">{metrics?.totalDepartures ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-white/70">On hold now</dt>
                  <dd className="text-lg tabular-nums text-white">{metrics?.activeHoldsCount ?? "—"}</dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="shortcuts-heading" className="rounded-none bg-white p-2 ring-1 ring-obsidian-900/[0.07]">
              <h2 id="shortcuts-heading" className="px-4 pb-1 pt-4 text-base text-obsidian-900">
                Shortcuts
              </h2>
              <ul>
                {SHORTCUTS.map(({ label, body, href, icon: Icon }) => (
                  <li key={href}>
                    <Link href={href} className="group flex items-center gap-3.5 rounded-2xl px-4 py-3 transition-colors hover:bg-obsidian-50">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-summit-100 text-obsidian-900">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-obsidian-900">{label}</span>
                        <span className="block truncate text-xs text-slate-600">{body}</span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-obsidian-900" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>

      {action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="action-heading">
          <div className="w-full max-w-md rounded-none bg-white p-6 shadow-xl">
            <h2 id="action-heading" className="text-xl text-obsidian-900">
              {action.kind === "approve" ? "Approve booking" : "Cancel booking"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {action.booking.bookingReference} · {action.booking.customerName} · {money(action.booking.totalAmount)}
            </p>
            {action.kind === "approve" ? (
              <div className="mt-5 space-y-4">
                <label className="block text-sm text-obsidian-900">
                  Payment
                  <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-obsidian-900/15 bg-white px-3 text-sm">
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                {method !== "UNPAID" && (
                  <label className="block text-sm text-obsidian-900">
                    Reference (optional)
                    <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className="mt-1.5 h-11 w-full rounded-xl border border-obsidian-900/15 px-3 text-sm" />
                  </label>
                )}
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <label className="block text-sm text-obsidian-900">
                  Reason
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className="mt-1.5 w-full rounded-xl border border-obsidian-900/15 px-3 py-2 text-sm" />
                </label>
                <label className="block text-sm text-obsidian-900">
                  Refund
                  <select value={refund} onChange={(e) => setRefund(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-obsidian-900/15 bg-white px-3 text-sm">
                    {REFUNDS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <label className="mt-4 flex items-center gap-2 text-sm text-obsidian-900">
              <input type="checkbox" checked={notifyGuest} onChange={(e) => setNotifyGuest(e.target.checked)} className="h-4 w-4" />
              Email the guest
            </label>
            {actionError && <p className="mt-3 text-sm text-red-700" role="alert">{actionError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setAction(null)} disabled={busy} className="h-11 rounded-full border border-obsidian-900/10 px-5 text-sm text-obsidian-900 hover:bg-obsidian-50">
                Back
              </button>
              <button
                type="button"
                onClick={submitAction}
                disabled={busy}
                className={`h-11 rounded-full px-5 text-sm text-white disabled:opacity-60 ${action.kind === "approve" ? "bg-emerald-700 hover:bg-emerald-800" : "bg-red-700 hover:bg-red-800"}`}
              >
                {busy ? "Saving…" : action.kind === "approve" ? "Approve booking" : "Cancel booking"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
