"use client";

// Daily dispatch board: one card per departure with capacity and boarding progress, then each
// pickup stop in order with its passengers and a check-in toggle. Brand light surface, shared
// staff header and tabs.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock, MapPin, RefreshCw, Truck } from "lucide-react";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";

interface DispatchPassenger {
  id: string;
  bookingReference: string;
  voucherCode: string;
  customerName: string;
  customerPhone: string;
  totalSeats: number;
  pickupTime?: string;
  isBoarded: boolean;
  boardedAt?: string;
}

interface DispatchStop {
  stopName: string;
  address?: string;
  pickupTime?: string;
  bookings: DispatchPassenger[];
}

interface DispatchManifest {
  departureId: string;
  date: string;
  departureTime: string;
  title: string;
  capacityTotal: number;
  capacityBooked: number;
  totalPassengers: number;
  boardedPassengers: number;
  stops: DispatchStop[];
}

// Dates are local calendar days (YYYY-MM-DD), not UTC, so evenings in Canmore don't jump ahead.
const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const longDate = (k: string) => fromKey(k).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

function Progress({ label, value, total, tone }: { label: string; value: number; total: number; tone: "ocean" | "summit" }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="rounded-2xl bg-obsidian-50 p-4">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="tabular-nums text-obsidian-900">
          {value} / {total}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-obsidian-900/[0.08]" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
        <div className={`h-full rounded-full transition-[width] duration-500 ${tone === "ocean" ? "bg-ocean-600" : "bg-summit-500"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DispatchBoardPage() {
  const [selectedDate, setSelectedDate] = useState(() => toKey(new Date()));
  const [manifests, setManifests] = useState<DispatchManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchManifests = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/dispatch?date=${date}`);
      if (res.status === 401 || res.status === 403) {
        setUnauthorized(true);
        setManifests([]);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setUnauthorized(false);
      setManifests(data.manifests || []);
    } catch {
      setError("Couldn't load the dispatch board. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchManifests(selectedDate);
  }, [selectedDate, fetchManifests]);

  const shift = (days: number) => {
    const d = fromKey(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(toKey(d));
  };

  async function toggleBoarding(bookingId: string, currentStatus: boolean) {
    setUpdatingId(bookingId);
    try {
      const res = await fetch("/api/admin/dispatch/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, isBoarded: !currentStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error();
      setManifests((prev) =>
        prev.map((m) => {
          let boarded = m.boardedPassengers;
          const stops = m.stops.map((stop) => ({
            ...stop,
            bookings: stop.bookings.map((b) => {
              if (b.id !== bookingId) return b;
              boarded = currentStatus ? Math.max(0, boarded - b.totalSeats) : boarded + b.totalSeats;
              return { ...b, isBoarded: !currentStatus, boardedAt: currentStatus ? undefined : new Date().toISOString() };
            }),
          }));
          return { ...m, boardedPassengers: boarded, stops };
        }),
      );
    } catch {
      setError("Couldn't update check-in. Try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  const isToday = selectedDate === toKey(new Date());

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <AdminHeader
        current="/admin/dispatch"
        eyebrow="Staff · Dispatch"
        title="Dispatch board"
        subtitle="Pickup manifests and passenger check-in by departure."
        actions={
          <div className="flex items-center gap-1 rounded-full bg-white p-1 ring-1 ring-obsidian-900/15">
            <button type="button" onClick={() => shift(-1)} aria-label="Previous day" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-obsidian-50">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <label className="sr-only" htmlFor="dispatch-date">
              Dispatch date
            </label>
            <input
              id="dispatch-date"
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="h-10 rounded-full bg-transparent px-2 text-sm text-obsidian-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600"
            />
            <button type="button" onClick={() => shift(1)} aria-label="Next day" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-obsidian-50">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => fetchManifests(selectedDate)}
              aria-label="Refresh"
              disabled={loading}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-obsidian-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 px-page py-8 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl text-obsidian-900">{longDate(selectedDate)}</h2>
          {!isToday && (
            <button type="button" onClick={() => setSelectedDate(toKey(new Date()))} className="inline-flex h-10 items-center rounded-full border border-obsidian-900/15 bg-white px-4 text-sm hover:bg-obsidian-50">
              Back to today
            </button>
          )}
        </div>

        {unauthorized && !loading && <StaffSignIn body="Sign in with an admin or dispatch account to see manifests." />}
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-4" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-40 rounded-[1.75rem] bg-white ring-1 ring-obsidian-900/[0.07] motion-safe:animate-pulse" />
            ))}
          </div>
        ) : (
          !unauthorized &&
          (manifests.length === 0 ? (
            <div className="rounded-[1.75rem] bg-white p-10 text-center ring-1 ring-obsidian-900/[0.07]">
              <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-ocean-50 text-ocean-700">
                <Truck className="h-6 w-6" aria-hidden="true" />
              </span>
              <p className="mt-4 text-lg text-obsidian-900">No departures on this day</p>
              <p className="mt-1 text-base text-slate-600">Use the arrows or the date picker to check another day.</p>
            </div>
          ) : (
            <ul className="space-y-6">
              {manifests.map((m) => (
                <li key={m.departureId}>
                  <article aria-labelledby={`dep-${m.departureId}`} className="overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-obsidian-900/[0.07]">
                    <header className="flex flex-col gap-5 border-b border-obsidian-900/[0.06] p-6 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-4">
                        <span className="inline-flex h-12 shrink-0 items-center rounded-2xl bg-ocean-950 px-3.5 font-mono text-base text-white">{m.departureTime}</span>
                        <div>
                          <h3 id={`dep-${m.departureId}`} className="text-xl font-light text-obsidian-900">
                            {m.title}
                          </h3>
                          <p className="mt-0.5 text-sm text-slate-600">
                            {m.stops.length} {m.stops.length === 1 ? "pickup stop" : "pickup stops"} · {m.totalPassengers} {m.totalPassengers === 1 ? "guest" : "guests"}
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:w-[26rem]">
                        <Progress label="Seats booked" value={m.capacityBooked} total={m.capacityTotal} tone="summit" />
                        <Progress label="Guests boarded" value={m.boardedPassengers} total={m.totalPassengers} tone="ocean" />
                      </div>
                    </header>

                    {m.stops.length === 0 ? (
                      <p className="px-6 py-8 text-center text-base text-slate-600">No bookings on this departure yet.</p>
                    ) : (
                      <ol className="divide-y divide-obsidian-900/[0.06]">
                        {m.stops.map((stop, i) => (
                          <li key={`${stop.stopName}-${i}`} className="p-6">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-summit-100 text-sm text-obsidian-900">{i + 1}</span>
                                <div>
                                  <h4 className="text-base text-obsidian-900">{stop.stopName}</h4>
                                  {stop.address && (
                                    <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-600">
                                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {stop.address}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                {stop.pickupTime && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-obsidian-50 px-3 py-1 text-obsidian-900">
                                    <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {stop.pickupTime}
                                  </span>
                                )}
                                <span className="rounded-full bg-obsidian-50 px-3 py-1 text-slate-700">{stop.bookings.reduce((s, b) => s + b.totalSeats, 0)} seats</span>
                              </div>
                            </div>

                            <ul className="mt-4 space-y-2">
                              {stop.bookings.map((p) => {
                                const updating = updatingId === p.id;
                                return (
                                  <li
                                    key={p.id}
                                    className={`flex flex-col gap-3 rounded-2xl p-4 ring-1 sm:flex-row sm:items-center sm:justify-between ${
                                      p.isBoarded ? "bg-ocean-50/60 ring-ocean-600/20" : "bg-white ring-obsidian-900/[0.08]"
                                    }`}
                                  >
                                    <div className="flex min-w-0 items-start gap-3">
                                      {p.isBoarded ? (
                                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ocean-600" aria-label="Boarded" />
                                      ) : (
                                        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-label="Waiting" />
                                      )}
                                      <div className="min-w-0">
                                        <p className="text-base text-obsidian-900">
                                          {p.customerName} <span className="text-slate-600">· {p.totalSeats} {p.totalSeats === 1 ? "seat" : "seats"}</span>
                                        </p>
                                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-slate-600">
                                          <a href={`tel:${p.customerPhone}`} className="text-ocean-600 underline-offset-4 hover:underline">
                                            {p.customerPhone}
                                          </a>
                                          <Link href={`/booking/${p.bookingReference}/voucher`} className="font-mono underline-offset-4 hover:underline">
                                            {p.bookingReference}
                                          </Link>
                                          <span className="font-mono">{p.voucherCode}</span>
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => toggleBoarding(p.id, p.isBoarded)}
                                      disabled={updating}
                                      className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm disabled:opacity-60 ${
                                        p.isBoarded ? "border border-obsidian-900/15 bg-white text-obsidian-900 hover:bg-obsidian-50" : "bg-ocean-600 text-white hover:bg-ocean-700"
                                      }`}
                                    >
                                      {updating && <RefreshCw className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden="true" />}
                                      {p.isBoarded ? "Undo check-in" : "Check in"}
                                      <span className="sr-only"> {p.customerName}</span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </li>
                        ))}
                      </ol>
                    )}
                  </article>
                </li>
              ))}
            </ul>
          ))
        )}
      </div>
    </div>
  );
}
