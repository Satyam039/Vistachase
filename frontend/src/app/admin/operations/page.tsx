"use client";

// Operations (Mornby runs): KPI cards, every vehicle run of the day with its real departure,
// vehicle, driver and status, and a run manifest dialog for pickup order and check-in. Brand light
// surface with the shared staff header and tabs.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Compass, ExternalLink, MapPin, Navigation, Phone, RefreshCw, Sliders, X } from "lucide-react";
import { Dropdown } from "@/components/forms/Dropdown";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";

interface FleetVehicle {
  id: string;
  name: string;
  type: string;
  capacity: number;
  licensePlate: string;
  status: string;
}

interface StaffDriver {
  id: string;
  name: string;
  publicName: string;
  phone: string;
  licenseClass: string;
  rating: number;
}

interface RunPassenger {
  id: string;
  pickupOrder: number;
  isBoarded: boolean;
  notes?: string;
  booking: {
    id: string;
    bookingReference: string;
    customerName: string;
    customerPhone: string;
    totalSeats: number;
    pickupTime?: string;
    specialRequests?: string;
    voucherCode: string;
    trackingToken?: string;
    pickupStop?: { name: string; town: string; address: string };
  };
}

interface OperationRunItem {
  id: string;
  name: string;
  date: string;
  departureTime?: string;
  status: string;
  notes?: string;
  vehicle?: FleetVehicle;
  driver?: StaffDriver;
  trackingSession?: { token: string; isActive: boolean };
  bookings: RunPassenger[];
}

interface DepartureItem {
  id: string;
  date: string;
  departureTime: string;
  capacityTotal: number;
  capacityBooked: number;
  status: string;
  tour?: { title: string; bokunId?: string };
  shuttleRoute?: { name: string };
  operationRuns: OperationRunItem[];
}

interface Stats {
  totalRuns: number;
  totalPassengers: number;
  boardedPassengers: number;
  totalDepartures: number;
}

const RUN_STATUSES = [
  { value: "PLANNED", label: "Planned", tone: "!bg-obsidian-100 !text-obsidian-900" },
  { value: "READY", label: "Ready", tone: "!bg-ocean-50 !text-ocean-800" },
  { value: "DISPATCHED", label: "Dispatched", tone: "!bg-summit-100 !text-obsidian-900" },
  { value: "BOARDING", label: "Boarding", tone: "!bg-summit-200 !text-obsidian-900" },
  { value: "IN_PROGRESS", label: "In progress", tone: "!bg-ocean-600 !text-white" },
  { value: "COMPLETED", label: "Completed", tone: "!bg-obsidian-900 !text-white" },
  { value: "DELAYED", label: "Delayed", tone: "!bg-red-50 !text-red-800" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const seats = (list: RunPassenger[]) => list.reduce((s, b) => s + b.booking.totalSeats, 0);

export default function OperationsPage() {
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [departures, setDepartures] = useState<DepartureItem[]>([]);
  const [fleet, setFleet] = useState<FleetVehicle[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [updatingRunId, setUpdatingRunId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const fetchDashboard = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/dashboard?date=${date}`);
      if (res.status === 401 || res.status === 403) {
        setUnauthorized(true);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setUnauthorized(false);
      setDepartures(data.departures || []);
      setFleet(data.fleet || []);
      setStats(data.stats || null);
    } catch {
      setError("Couldn't load operations. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard(selectedDate);
  }, [selectedDate, fetchDashboard]);

  // Each run with the departure it belongs to (real tour title, Bokun id and capacity).
  const runs = departures.flatMap((d) => d.operationRuns.map((run) => ({ run, dep: d })));
  const selected = runs.find((r) => r.run.id === selectedRunId) ?? null;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (selected && !el.open) el.showModal();
    if (!selected && el.open) el.close();
  }, [selected]);

  async function post(url: string, body?: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) throw new Error();
    await fetchDashboard(selectedDate);
  }

  async function syncBokun() {
    setSyncing(true);
    setNotice(null);
    try {
      const res = await fetch("/api/operations/sync-bokun", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: selectedDate }) });
      const data = await res.json();
      setNotice(data.success ? `Synced ${data.result.syncedCount} new and ${data.result.updatedCount} updated bookings from Bókun.` : data.error || "Bókun sync failed.");
      if (data.success) await fetchDashboard(selectedDate);
    } catch {
      setNotice("Couldn't reach Bókun. Try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function changeStatus(runId: string, status: string) {
    setUpdatingRunId(runId);
    try {
      await post(`/api/operations/runs/${runId}/status`, { status });
    } catch {
      setError("Couldn't update the run status.");
    } finally {
      setUpdatingRunId(null);
    }
  }

  const kpis = stats
    ? [
        { label: "Vehicle runs", value: String(stats.totalRuns) },
        { label: "Guests boarded", value: `${stats.boardedPassengers} / ${stats.totalPassengers}` },
        { label: "Fleet deployed", value: `${fleet.filter((v) => v.status === "ASSIGNED").length} / ${fleet.length}` },
        { label: "Departures", value: String(stats.totalDepartures) },
      ]
    : [];

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <AdminHeader
        current="/admin/operations"
        eyebrow="Staff · Operations"
        title="Fleet & runs"
        subtitle="Vehicle runs, drivers and pickup order, synced with Bókun."
        actions={
          <>
            <label htmlFor="ops-date" className="sr-only">
              Operations date
            </label>
            <input
              id="ops-date"
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="h-11 rounded-full border border-obsidian-900/10 bg-white px-4 text-sm text-obsidian-900 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/30"
            />
            <button
              type="button"
              onClick={() => fetchDashboard(selectedDate)}
              aria-label="Refresh"
              disabled={loading}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-obsidian-900/10 bg-white hover:bg-obsidian-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />
            </button>
            <button type="button" onClick={syncBokun} disabled={syncing} className="golden-summit-btn inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${syncing ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />
              {syncing ? "Syncing…" : "Sync Bókun"}
            </button>
          </>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 px-page py-8 sm:py-10">
        {unauthorized && !loading && <StaffSignIn body="Sign in with an admin or dispatch account to manage runs." />}
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
            {error}
          </p>
        )}
        <p aria-live="polite" className={notice ? "rounded-2xl bg-ocean-50 px-5 py-3 text-sm text-ocean-800" : "sr-only"}>
          {notice}
        </p>

        {!unauthorized && (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key figures">
              {(kpis.length ? kpis : [0, 1, 2, 3].map((i) => ({ label: String(i), value: "" }))).map((k, i) => (
                <li key={k.label + i} className="rounded-[1.5rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07]">
                  {kpis.length ? (
                    <>
                      <p className="text-sm text-slate-600">{k.label}</p>
                      <p className="mt-2 text-3xl font-light tabular-nums text-obsidian-900">{k.value}</p>
                    </>
                  ) : (
                    <span className="block h-16 rounded-lg bg-obsidian-100 motion-safe:animate-pulse" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ul>

            <section aria-labelledby="runs-heading" className="overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-obsidian-900/[0.07]">
              <div className="flex items-center justify-between gap-3 border-b border-obsidian-900/[0.06] px-6 py-5">
                <h2 id="runs-heading" className="text-xl text-obsidian-900">
                  Vehicle runs
                </h2>
                <span className="text-sm text-slate-600">
                  {runs.length} {runs.length === 1 ? "run" : "runs"}
                </span>
              </div>

              {loading && runs.length === 0 ? (
                <div className="space-y-3 p-6" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="block h-12 rounded-xl bg-obsidian-100 motion-safe:animate-pulse" />
                  ))}
                </div>
              ) : runs.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <Compass className="mx-auto h-8 w-8 text-slate-500" aria-hidden="true" />
                  <p className="mt-3 text-lg text-obsidian-900">No vehicle runs on this day</p>
                  <p className="mt-1 text-base text-slate-600">Sync from Bókun to group the day&apos;s bookings into runs.</p>
                </div>
              ) : (
                <div className="overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ocean-600" tabIndex={0} role="region" aria-label="Vehicle runs table">
                  <table className="w-full min-w-[74rem] text-left text-base">
                    <thead className="bg-obsidian-50/70 text-sm text-slate-600">
                      <tr>
                        <th scope="col" className="px-6 py-3 font-normal">Run</th>
                        <th scope="col" className="px-6 py-3 font-normal">Tour</th>
                        <th scope="col" className="px-6 py-3 font-normal">Guests</th>
                        <th scope="col" className="px-6 py-3 font-normal">Vehicle</th>
                        <th scope="col" className="px-6 py-3 font-normal">Driver</th>
                        <th scope="col" className="px-6 py-3 font-normal">Status</th>
                        <th scope="col" className="px-6 py-3 text-right font-normal">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-obsidian-900/[0.06]">
                      {runs.map(({ run, dep }) => {
                        const status = RUN_STATUSES.find((s) => s.value === run.status) ?? RUN_STATUSES[0];
                        const guests = seats(run.bookings);
                        const boarded = seats(run.bookings.filter((b) => b.isBoarded));
                        const capacity = run.vehicle?.capacity ?? dep.capacityTotal;
                        return (
                          <tr key={run.id} className="hover:bg-obsidian-50/60">
                            <td className="min-w-[13rem] px-6 py-4">
                              <span className="block text-obsidian-900">{run.name}</span>
                              <span className="font-mono text-sm text-slate-600">{run.departureTime || dep.departureTime}</span>
                            </td>
                            <td className="w-[16rem] min-w-[14rem] px-6 py-4">
                              <span className="line-clamp-2 text-sm text-obsidian-900">{dep.tour?.title ?? dep.shuttleRoute?.name ?? "—"}</span>
                              {dep.tour?.bokunId && <span className="font-mono text-sm text-slate-600">Bókun #{dep.tour.bokunId}</span>}
                            </td>
                            <td className="px-6 py-4">
                              <span className="tabular-nums text-obsidian-900">
                                {guests} / {capacity}
                              </span>
                              <span className="block text-sm text-slate-600">{boarded} boarded</span>
                              <span className="mt-1.5 block h-1.5 w-24 overflow-hidden rounded-full bg-obsidian-900/[0.08]" aria-hidden="true">
                                <span className="block h-full rounded-full bg-summit-500" style={{ width: `${capacity ? Math.min(100, (guests / capacity) * 100) : 0}%` }} />
                              </span>
                            </td>
                            <td className="min-w-[13rem] px-6 py-4 text-sm">
                              {run.vehicle ? (
                                <>
                                  <span className="block text-obsidian-900">{run.vehicle.name}</span>
                                  <span className="whitespace-nowrap font-mono text-slate-600">{run.vehicle.licensePlate}</span>
                                </>
                              ) : (
                                <span className="text-slate-600">Unassigned</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                              {run.driver ? (
                                <>
                                  <span className="block text-obsidian-900">{run.driver.name}</span>
                                  <a href={`tel:${run.driver.phone}`} className="text-ocean-600 underline-offset-4 hover:underline">
                                    {run.driver.phone}
                                  </a>
                                </>
                              ) : (
                                <span className="text-slate-600">Unassigned</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <Dropdown
                                id={`status-${run.id}`}
                                variant="pill"
                                label={`Status of ${run.name}`}
                                hideLabel
                                value={run.status}
                                disabled={updatingRunId === run.id}
                                onChange={(v) => changeStatus(run.id, v)}
                                className="w-40"
                                triggerClassName={`!border-transparent ${status.tone}`}
                                options={RUN_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                              />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-end gap-2 whitespace-nowrap">
                                {run.trackingSession && (
                                  <Link
                                    href={`/track/${run.trackingSession.token}`}
                                    target="_blank"
                                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-obsidian-900/10 px-4 text-sm hover:bg-obsidian-50"
                                  >
                                    <Navigation className="h-3.5 w-3.5" aria-hidden="true" /> Live map
                                    <span className="sr-only">for {run.name} (opens in a new tab)</span>
                                  </Link>
                                )}
                                <button type="button" onClick={() => setSelectedRunId(run.id)} className="inline-flex h-10 items-center rounded-full bg-ocean-600 px-4 text-sm text-white hover:bg-ocean-700">
                                  Manifest <span className="sr-only">for {run.name}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Run manifest: native modal dialog (focus trapped, Escape closes). */}
      <dialog
        ref={dialog}
        onClose={() => setSelectedRunId(null)}
        aria-labelledby="manifest-title"
        className="m-auto w-[calc(100%-2rem)] max-w-3xl overflow-hidden rounded-[1.75rem] bg-white p-0 text-obsidian-900 shadow-2xl backdrop:bg-obsidian-950/60 backdrop:backdrop-blur-sm"
      >
        {selected && (
          <div className="flex max-h-[85vh] flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-obsidian-900/[0.06] p-6">
              <div className="min-w-0">
                <p className="text-sm text-slate-600">
                  Run manifest · {selected.run.date} · {selected.run.departureTime || selected.dep.departureTime}
                </p>
                <h2 id="manifest-title" className="mt-1 text-2xl font-light text-obsidian-900">
                  {selected.run.name}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {selected.dep.tour?.title ?? selected.dep.shuttleRoute?.name} · {selected.run.vehicle ? `${selected.run.vehicle.name} (${selected.run.vehicle.licensePlate})` : "No vehicle"} ·{" "}
                  {selected.run.driver?.name ?? "No driver"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => post(`/api/operations/runs/${selected.run.id}/optimize-pickups`).catch(() => setError("Couldn't reorder pickups."))}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-obsidian-900/10 px-4 text-sm hover:bg-obsidian-50"
                >
                  <Sliders className="h-3.5 w-3.5" aria-hidden="true" /> Order east to west
                </button>
                <button type="button" onClick={() => dialog.current?.close()} aria-label="Close manifest" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-obsidian-50">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-6">
              {selected.run.bookings.length === 0 ? (
                <p className="py-8 text-center text-base text-slate-600">No guests on this run yet. Sync from Bókun or assign bookings to the departure.</p>
              ) : (
                <ol className="space-y-3">
                  {selected.run.bookings.map((rb, i) => (
                    <li
                      key={rb.id}
                      className={`flex flex-col gap-3 rounded-2xl p-4 ring-1 sm:flex-row sm:items-start sm:justify-between ${rb.isBoarded ? "bg-ocean-50/60 ring-ocean-600/20" : "ring-obsidian-900/[0.08]"}`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-summit-100 text-sm">{rb.pickupOrder || i + 1}</span>
                        <div className="min-w-0 space-y-1">
                          <p className="text-base text-obsidian-900">
                            {rb.booking.customerName}{" "}
                            <span className="text-slate-600">
                              · {rb.booking.totalSeats} {rb.booking.totalSeats === 1 ? "guest" : "guests"} · <span className="font-mono">{rb.booking.bookingReference}</span>
                            </span>
                          </p>
                          <p className="flex items-center gap-1.5 text-sm text-slate-600">
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {rb.booking.pickupStop ? `${rb.booking.pickupStop.name} (${rb.booking.pickupStop.town})` : "Pickup not set"}
                            {rb.booking.pickupTime && ` · ${rb.booking.pickupTime}`}
                          </p>
                          {rb.booking.specialRequests && <p className="rounded-xl bg-summit-100/70 px-3 py-1.5 text-sm text-obsidian-900">Note: {rb.booking.specialRequests}</p>}
                          <p className="flex flex-wrap gap-x-4 text-sm text-slate-600">
                            <a href={`tel:${rb.booking.customerPhone}`} className="inline-flex items-center gap-1 text-ocean-600 underline-offset-4 hover:underline">
                              <Phone className="h-3.5 w-3.5" aria-hidden="true" /> {rb.booking.customerPhone}
                            </a>
                            <span className="font-mono">Voucher {rb.booking.voucherCode}</span>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => post("/api/operations/runs/check-in", { runBookingId: rb.id, isBoarded: !rb.isBoarded }).catch(() => setError("Couldn't update check-in."))}
                        className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm ${
                          rb.isBoarded ? "border border-obsidian-900/10 bg-white text-obsidian-900 hover:bg-obsidian-50" : "bg-ocean-600 text-white hover:bg-ocean-700"
                        }`}
                      >
                        {rb.isBoarded ? <CheckCircle2 className="h-4 w-4 text-ocean-600" aria-hidden="true" /> : <Circle className="h-4 w-4" aria-hidden="true" />}
                        {rb.isBoarded ? "Boarded · undo" : "Check in"}
                        <span className="sr-only"> {rb.booking.customerName}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-obsidian-900/[0.06] bg-obsidian-50 px-6 py-4 text-sm text-slate-600">
              <span>
                {selected.run.bookings.length} {selected.run.bookings.length === 1 ? "pickup" : "pickups"}
              </span>
              {selected.run.trackingSession && (
                <Link href={`/track/${selected.run.trackingSession.token}`} target="_blank" className="inline-flex items-center gap-1 text-ocean-600 underline-offset-4 hover:underline">
                  Open live map <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
