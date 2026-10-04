"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Truck,
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";

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

export default function DispatchBoardPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [manifests, setManifests] = useState<DispatchManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchManifests(selectedDate);
  }, [selectedDate]);

  async function fetchManifests(date: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/dispatch?date=${date}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to load dispatch manifest. Please ensure you are logged in as staff.");
      } else {
        setManifests(data.manifests || []);
      }
    } catch {
      setError("Network error fetching dispatch board.");
    } finally {
      setLoading(false);
    }
  }

  function handleDateShift(days: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  }

  async function handleToggleBoarding(bookingId: string, currentStatus: boolean) {
    setUpdatingId(bookingId);
    try {
      const res = await fetch("/api/admin/dispatch/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          isBoarded: !currentStatus,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Optimistically update manifest in state
        setManifests((prev) =>
          prev.map((manifest) => {
            let newlyBoardedCount = manifest.boardedPassengers;
            const updatedStops = manifest.stops.map((stop) => {
              const updatedBookings = stop.bookings.map((b) => {
                if (b.id === bookingId) {
                  const nextBoarded = !currentStatus;
                  if (nextBoarded) {
                    newlyBoardedCount += b.totalSeats;
                  } else {
                    newlyBoardedCount = Math.max(0, newlyBoardedCount - b.totalSeats);
                  }
                  return {
                    ...b,
                    isBoarded: nextBoarded,
                    boardedAt: nextBoarded ? new Date().toISOString() : undefined,
                  };
                }
                return b;
              });
              return { ...stop, bookings: updatedBookings };
            });

            return {
              ...manifest,
              boardedPassengers: newlyBoardedCount,
              stops: updatedStops,
            };
          })
        );
      }
    } catch (e) {
      console.error("Boarding toggle error", e);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-forest-950 text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Breadcrumb & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-forest-800">
          <div className="space-y-1">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300 font-semibold mb-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Admin Panel</span>
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-white flex items-center gap-2">
                <Truck className="w-7 h-7 text-gold-400" />
                <span>Daily Dispatch &amp; Driver Board</span>
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Live Dispatch Active</span>
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Hotel pickup manifests, scheduled routes, passenger manifests, and real-time boarding check-ins.
            </p>
          </div>

          {/* Date Selector Bar */}
          <div className="flex items-center gap-2 bg-forest-900 border border-forest-800 p-1.5 rounded-2xl">
            <button
              onClick={() => handleDateShift(-1)}
              className="p-2 rounded-xl hover:bg-forest-800 text-slate-300 hover:text-white transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 px-3 py-1 bg-forest-950 rounded-xl border border-forest-800/80">
              <Calendar className="w-4 h-4 text-gold-400" />
              <input
                type="date"
                aria-label="Dispatch date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-semibold text-white rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-summit-500"
              />
            </div>
            <button
              onClick={() => handleDateShift(1)}
              className="p-2 rounded-xl hover:bg-forest-800 text-slate-300 hover:text-white transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchManifests(selectedDate)}
              className="p-2 rounded-xl hover:bg-forest-800 text-slate-300 hover:text-gold-400 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-sm flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-300">{error}</p>
                <p className="text-xs text-amber-400/80 mt-1">
                  Ensure you are signed in with a staff account (<code className="bg-amber-900/60 px-1 py-0.5 rounded">dispatch@vistachase.com</code> / <code className="bg-amber-900/60 px-1 py-0.5 rounded">Dispatch2026!</code>).
                </p>
              </div>
            </div>
            <Link
              href="/login"
              className="px-4 py-1.5 rounded-lg bg-amber-400 text-forest-950 font-bold text-xs hover:bg-amber-300 transition-colors whitespace-nowrap"
            >
              Sign In
            </Link>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="py-24 text-center">
            <RefreshCw className="w-8 h-8 text-gold-400 animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Loading daily manifests for {selectedDate}...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && manifests.length === 0 && (
          <div className="py-20 text-center bg-forest-900/40 rounded-3xl border border-forest-800 p-8">
            <Truck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white">No Departures Scheduled for {selectedDate}</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-6">
              There are no tour or shuttle runs scheduled on this specific date. Switch dates using the arrows above or view upcoming peak season runs.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setSelectedDate(today);
                }}
                className="px-4 py-2 rounded-xl font-semibold bg-forest-800 hover:bg-forest-700 text-white text-xs border border-forest-700 transition-colors"
              >
                Go to Today
              </button>
            </div>
          </div>
        )}

        {/* Manifests List */}
        {!loading && manifests.length > 0 && (
          <div className="space-y-8">
            {manifests.map((manifest) => {
              const capacityPercent = Math.min(
                100,
                Math.round((manifest.capacityBooked / manifest.capacityTotal) * 100)
              );
              const boardingPercent =
                manifest.totalPassengers > 0
                  ? Math.round((manifest.boardedPassengers / manifest.totalPassengers) * 100)
                  : 0;

              return (
                <div
                  key={manifest.departureId}
                  className="rounded-3xl bg-forest-900 border border-forest-800 shadow-2xl overflow-hidden"
                >
                  {/* Departure Header Banner */}
                  <div className="p-6 bg-forest-950/80 border-b border-forest-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-md bg-gold-400/10 text-gold-400 border border-gold-400/30 text-xs font-mono font-bold">
                          {manifest.departureTime || "08:00 AM"}
                        </span>
                        <h2 className="text-xl font-display font-bold text-white">
                          {manifest.title}
                        </h2>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span>Date: <strong className="text-slate-200">{manifest.date}</strong></span>
                        <span>•</span>
                        <span>Stops: <strong className="text-slate-200">{manifest.stops.length} locations</strong></span>
                        <span>•</span>
                        <span>Departure ID: <code className="text-slate-400">{manifest.departureId.slice(0, 10)}...</code></span>
                      </div>
                    </div>

                    {/* Capacity & Boarding Progress */}
                    <div className="grid grid-cols-2 gap-4 lg:w-96">
                      <div className="bg-forest-900 p-3 rounded-xl border border-forest-800">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                          <span>Capacity Booked</span>
                          <span className="font-bold text-white font-mono">
                            {manifest.capacityBooked} / {manifest.capacityTotal}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-forest-950 overflow-hidden">
                          <div
                            className="h-full bg-gold-400 transition-all duration-300"
                            style={{ width: `${capacityPercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="bg-forest-900 p-3 rounded-xl border border-forest-800">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                          <span>Boarded Guests</span>
                          <span className="font-bold text-emerald-400 font-mono">
                            {manifest.boardedPassengers} / {manifest.totalPassengers}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-forest-950 overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 transition-all duration-300"
                            style={{ width: `${boardingPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stops & Passengers Breakdown */}
                  <div className="p-6 space-y-6">
                    {manifest.stops.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4 text-center">
                        No passenger bookings registered for this departure run yet.
                      </p>
                    ) : (
                      manifest.stops.map((stop, sIdx) => (
                        <div
                          key={sIdx}
                          className="rounded-2xl bg-forest-950/60 border border-forest-800/80 p-5 space-y-4"
                        >
                          {/* Stop Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-forest-800/60">
                            <div className="flex items-start gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-400 font-bold text-xs flex-shrink-0 mt-0.5">
                                {sIdx + 1}
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                  <span>{stop.stopName}</span>
                                </h3>
                                {stop.address && (
                                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3 h-3 text-gold-400" />
                                    <span>{stop.address}</span>
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 text-xs">
                              {stop.pickupTime && (
                                <div className="flex items-center gap-1 text-gold-300 font-mono font-medium">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Pickup: {stop.pickupTime}</span>
                                </div>
                              )}
                              <span className="px-2 py-0.5 rounded bg-forest-800 text-slate-300 text-[11px]">
                                {stop.bookings.reduce((sum, b) => sum + b.totalSeats, 0)} Seats
                              </span>
                            </div>
                          </div>

                          {/* Stop Passengers Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="text-[10px] uppercase text-slate-500 border-b border-forest-800/40 pb-2">
                                <tr>
                                  <th className="py-2 px-3">Status</th>
                                  <th className="py-2 px-3">Guest Name</th>
                                  <th className="py-2 px-3">Contact</th>
                                  <th className="py-2 px-3">Reference</th>
                                  <th className="py-2 px-3">Voucher</th>
                                  <th className="py-2 px-3">Seats</th>
                                  <th className="py-2 px-3 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-forest-800/30">
                                {stop.bookings.map((p) => {
                                  const isUpdating = updatingId === p.id;
                                  return (
                                    <tr
                                      key={p.id}
                                      className={`hover:bg-forest-900/40 transition-colors ${
                                        p.isBoarded ? "bg-emerald-950/10" : ""
                                      }`}
                                    >
                                      <td className="py-2.5 px-3">
                                        {p.isBoarded ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                                            <CheckCircle2 className="w-3 h-3" />
                                            <span>BOARDED</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-forest-800 text-slate-400">
                                            <Circle className="w-3 h-3" />
                                            <span>WAITING</span>
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3 font-semibold text-white">
                                        {p.customerName}
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-300 font-mono">
                                        <a href={`tel:${p.customerPhone}`} className="hover:text-gold-400">
                                          {p.customerPhone}
                                        </a>
                                      </td>
                                      <td className="py-2.5 px-3 font-mono text-gold-400">
                                        <Link
                                          href={`/booking/${p.bookingReference}/voucher`}
                                          target="_blank"
                                          className="hover:underline"
                                        >
                                          {p.bookingReference}
                                        </Link>
                                      </td>
                                      <td className="py-2.5 px-3 font-mono text-slate-300">
                                        {p.voucherCode}
                                      </td>
                                      <td className="py-2.5 px-3 font-mono font-bold text-white">
                                        {p.totalSeats}
                                      </td>
                                      <td className="py-2.5 px-3 text-right">
                                        <button
                                          onClick={() => handleToggleBoarding(p.id, p.isBoarded)}
                                          disabled={isUpdating}
                                          className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all inline-flex items-center gap-1.5 ${
                                            p.isBoarded
                                              ? "bg-forest-800 hover:bg-forest-700 text-slate-300 border border-forest-700"
                                              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                                          }`}
                                        >
                                          {isUpdating && <RefreshCw className="w-3 h-3 animate-spin" />}
                                          <span>{p.isBoarded ? "Undo Check-In" : "Check In"}</span>
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
