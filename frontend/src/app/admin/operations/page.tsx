"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Truck,
  Users,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  ArrowRight,
  Compass,
  Sparkles,
  Phone,
  MessageSquare,
  Play,
  Navigation,
  ExternalLink,
  Sliders,
  Check,
  X,
} from "lucide-react";

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
    pickupStop?: {
      name: string;
      town: string;
      address: string;
    };
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
  trackingSession?: {
    token: string;
    isActive: boolean;
  };
  bookings: RunPassenger[];
}

interface DepartureItem {
  id: string;
  date: string;
  departureTime: string;
  capacityTotal: number;
  capacityBooked: number;
  status: string;
  tour?: {
    title: string;
    bokunId?: string;
  };
  shuttleRoute?: {
    name: string;
  };
  operationRuns: OperationRunItem[];
}

const RUN_STATUSES = [
  { value: "PLANNED", label: "Planned", color: "bg-slate-800 text-slate-300 border-slate-700" },
  { value: "READY", label: "Ready", color: "bg-blue-950 text-blue-300 border-blue-800" },
  { value: "DISPATCHED", label: "Dispatched", color: "bg-amber-950 text-amber-300 border-amber-800" },
  { value: "BOARDING", label: "Boarding", color: "bg-purple-950 text-purple-300 border-purple-800" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-emerald-950 text-emerald-300 border-emerald-800" },
  { value: "COMPLETED", label: "Completed", color: "bg-slate-900 text-slate-400 border-slate-800" },
  { value: "DELAYED", label: "Delayed", color: "bg-rose-950 text-rose-300 border-rose-800" },
];

export default function MornbyOperationsPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [departures, setDepartures] = useState<DepartureItem[]>([]);
  const [fleet, setFleet] = useState<FleetVehicle[]>([]);
  const [drivers, setDrivers] = useState<StaffDriver[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<OperationRunItem | null>(null);
  const [isSyncingBokun, setIsSyncingBokun] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [updatingRunId, setUpdatingRunId] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/dashboard?date=${date}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to load Mornby operations dashboard.");
      } else {
        setDepartures(data.departures || []);
        setFleet(data.fleet || []);
        setDrivers(data.drivers || []);
        setStats(data.stats || null);

        // If a run is open in modal, refresh its view
        if (selectedRun) {
          for (const dep of data.departures || []) {
            const found = (dep.operationRuns || []).find((r: any) => r.id === selectedRun.id);
            if (found) setSelectedRun(found);
          }
        }
      }
    } catch {
      setError("Network connection error reaching Operations API.");
    } finally {
      setLoading(false);
    }
  }, [selectedRun]);

  useEffect(() => {
    fetchDashboard(selectedDate);
  }, [selectedDate]);

  async function handleSyncBokun() {
    setIsSyncingBokun(true);
    setSyncFeedback(null);
    try {
      const res = await fetch("/api/operations/sync-bokun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncFeedback(`Synced ${data.result.syncedCount} new, ${data.result.updatedCount} updated bookings from Bókun.`);
        await fetchDashboard(selectedDate);
      } else {
        setSyncFeedback(data.error || "Bókun sync failed.");
      }
    } catch {
      setSyncFeedback("Failed to trigger Bókun synchronization.");
    } finally {
      setIsSyncingBokun(false);
      setTimeout(() => setSyncFeedback(null), 6000);
    }
  }

  async function handleStatusChange(runId: string, newStatus: string) {
    setUpdatingRunId(runId);
    try {
      const res = await fetch(`/api/operations/runs/${runId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchDashboard(selectedDate);
      }
    } catch (err) {
      console.error("Status update error:", err);
    } finally {
      setUpdatingRunId(null);
    }
  }

  async function handleToggleBoarding(runBookingId: string, currentStatus: boolean) {
    try {
      const res = await fetch("/api/operations/runs/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runBookingId, isBoarded: !currentStatus }),
      });
      if (res.ok) {
        await fetchDashboard(selectedDate);
      }
    } catch (err) {
      console.error("Boarding check-in error:", err);
    }
  }

  async function handleOptimizePickups(runId: string) {
    try {
      const res = await fetch(`/api/operations/runs/${runId}/optimize-pickups`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchDashboard(selectedDate);
      }
    } catch (err) {
      console.error("Optimize pickups error:", err);
    }
  }

  const allRuns = departures.flatMap((d) => d.operationRuns);

  return (
    <div className="min-h-screen bg-[#07130F] text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Top Operational Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-forest-800/80 gap-4">
          <div>
            <div className="flex items-center gap-2 text-gold-400 text-xs font-semibold tracking-wider uppercase mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Mornby Daily Operations &amp; Dispatch • Vista Chase</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
              Canmore Fleet &amp; Dispatch Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Run grouping, vehicle telemetry, driver rosters, and pickup routing synchronized with Bókun.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Date Switcher */}
            <div className="flex items-center gap-2 bg-[#0C1E18] px-3 py-1.5 rounded-xl border border-forest-700/60 text-xs">
              <Calendar className="w-3.5 h-3.5 text-gold-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white font-mono text-xs focus:outline-none"
              />
            </div>

            {/* Sync Bókun CTA */}
            <button
              onClick={handleSyncBokun}
              disabled={isSyncingBokun}
              className="px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-forest-950 font-bold text-xs flex items-center gap-2 transition-colors shadow-glow"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBokun ? "animate-spin" : ""}`} />
              <span>{isSyncingBokun ? "Syncing Bókun..." : "Sync Bókun"}</span>
            </button>

            <Link
              href="/admin"
              className="px-3.5 py-2 rounded-xl bg-forest-900 hover:bg-forest-800 border border-forest-700/60 text-slate-300 text-xs font-semibold"
            >
              Admin Metrics
            </Link>
          </div>
        </div>

        {/* Sync Feedback Toast */}
        {syncFeedback && (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* KPI Metrics Strip */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#0C1E18] p-4 rounded-2xl border border-forest-800/80 shadow-lg">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                Active Vehicle Runs
              </span>
              <p className="text-2xl font-serif font-bold text-white mt-1">
                {stats.totalRuns} <span className="text-xs font-sans text-slate-400 font-normal">Runs</span>
              </p>
            </div>

            <div className="bg-[#0C1E18] p-4 rounded-2xl border border-forest-800/80 shadow-lg">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                Boarding Manifest
              </span>
              <p className="text-2xl font-serif font-bold text-emerald-400 mt-1">
                {stats.boardedPassengers} / {stats.totalPassengers}
                <span className="text-xs font-sans text-slate-400 font-normal ml-1">Boarded</span>
              </p>
            </div>

            <div className="bg-[#0C1E18] p-4 rounded-2xl border border-forest-800/80 shadow-lg">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                Fleet Deployed
              </span>
              <p className="text-2xl font-serif font-bold text-gold-400 mt-1">
                {fleet.filter((v) => v.status === "ASSIGNED").length} / {fleet.length}
                <span className="text-xs font-sans text-slate-400 font-normal ml-1">Vehicles</span>
              </p>
            </div>

            <div className="bg-[#0C1E18] p-4 rounded-2xl border border-forest-800/80 shadow-lg">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                Departures Scheduled
              </span>
              <p className="text-2xl font-serif font-bold text-white mt-1">
                {stats.totalDepartures}
                <span className="text-xs font-sans text-slate-400 font-normal ml-1">Departures</span>
              </p>
            </div>
          </div>
        )}

        {/* Departures & Runs Manifest Table */}
        <div className="bg-[#0C1E18] rounded-3xl border border-forest-800/80 shadow-2xl overflow-hidden">
          <div className="p-5 border-b border-forest-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-gold-400" />
              <h2 className="text-base font-serif font-bold text-white">
                Daily Departures &amp; Vehicle Runs Manifest
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {allRuns.length} Total Runs Scheduled
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-gold-400" />
              <p className="text-xs">Loading Mornby operations manifest...</p>
            </div>
          ) : allRuns.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <Compass className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">No vehicle runs scheduled for {selectedDate}.</p>
              <button
                onClick={handleSyncBokun}
                className="px-4 py-2 rounded-xl bg-forest-900 border border-forest-700 text-gold-400 hover:text-white text-xs font-semibold inline-flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync Today&apos;s Bookings from Bókun</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#050C0A] text-slate-400 uppercase tracking-wider font-mono text-[10px] border-b border-forest-800">
                  <tr>
                    <th className="py-3.5 px-4">Time &amp; Run Name</th>
                    <th className="py-3.5 px-4">Tour / Bókun ID</th>
                    <th className="py-3.5 px-4">Capacity / Booked</th>
                    <th className="py-3.5 px-4">Vehicle</th>
                    <th className="py-3.5 px-4">Driver / Guide</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest-800/60 font-medium">
                  {allRuns.map((run) => {
                    const statusObj = RUN_STATUSES.find((s) => s.value === run.status) || RUN_STATUSES[0];
                    const passengerCount = run.bookings.reduce((sum, b) => sum + b.booking.totalSeats, 0);
                    const boardedCount = run.bookings.filter((b) => b.isBoarded).reduce((sum, b) => sum + b.booking.totalSeats, 0);
                    const capacity = run.vehicle?.capacity || 14;

                    return (
                      <tr key={run.id} className="hover:bg-forest-900/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white text-sm">{run.name}</div>
                          <span className="text-[11px] font-mono text-gold-400">{run.departureTime || "08:30"}</span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-300">
                          <p className="line-clamp-1">Lake Louise &amp; Moraine Lake Explorer</p>
                          <span className="text-[10px] font-mono text-slate-500">BÓKUN: #1142134</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white">{passengerCount} / {capacity}</span>
                            <span className="text-[10px] text-slate-400">({boardedCount} Boarded)</span>
                          </div>
                          <div className="w-24 bg-forest-950 h-1.5 rounded-full overflow-hidden mt-1 border border-forest-800">
                            <div
                              className="bg-gold-500 h-full rounded-full transition-all"
                              style={{ width: `${Math.min(100, (passengerCount / capacity) * 100)}%` }}
                            />
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {run.vehicle ? (
                            <div>
                              <p className="text-white font-semibold">{run.vehicle.name}</p>
                              <span className="text-[10px] font-mono text-gold-300">{run.vehicle.licensePlate}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Unassigned</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {run.driver ? (
                            <div>
                              <p className="text-white font-semibold">{run.driver.name}</p>
                              <span className="text-[10px] text-slate-400">{run.driver.phone}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Unassigned</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <select
                            value={run.status}
                            disabled={updatingRunId === run.id}
                            onChange={(e) => handleStatusChange(run.id, e.target.value)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border cursor-pointer ${statusObj.color} focus:outline-none`}
                          >
                            {RUN_STATUSES.map((s) => (
                              <option key={s.value} value={s.value} className="bg-slate-900 text-white">
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => setSelectedRun(run)}
                            className="px-3 py-1.5 rounded-lg bg-forest-900 hover:bg-forest-800 text-slate-200 border border-forest-700/60 transition-colors text-xs font-semibold"
                          >
                            Manifest &amp; Stops
                          </button>

                          {run.trackingSession && (
                            <Link
                              href={`/track/${run.trackingSession.token}`}
                              target="_blank"
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 inline-flex items-center gap-1 text-xs"
                              title="Live GPS Session"
                            >
                              <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                              <span>GPS</span>
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Run Manifest Modal / Drawer */}
        {selectedRun && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0C1E18] rounded-3xl border border-forest-800 shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="p-6 border-b border-forest-800/80 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gold-950 text-gold-300 border border-gold-800/40">
                      Mornby Run Manifest
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {selectedRun.date} • {selectedRun.departureTime}
                    </span>
                  </div>
                  <h3 className="text-xl font-serif font-bold text-white mt-1">
                    {selectedRun.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Vehicle: {selectedRun.vehicle?.name || "Unassigned"} ({selectedRun.vehicle?.licensePlate || "N/A"}) • Guide: {selectedRun.driver?.name || "Unassigned"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOptimizePickups(selectedRun.id)}
                    className="px-3 py-1.5 rounded-xl bg-forest-900 border border-forest-700/60 text-gold-400 text-xs font-semibold flex items-center gap-1.5 hover:text-white"
                    title="Sort stops East to West (Canmore -> Banff -> Lake Louise)"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Optimize Route</span>
                  </button>
                  <button
                    onClick={() => setSelectedRun(null)}
                    className="p-2 rounded-xl bg-forest-900 text-slate-400 hover:text-white border border-forest-700/60"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Stops & Passengers List */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {selectedRun.bookings.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-8">
                    No passengers assigned to this run yet. Synchronize Bókun or assign bookings from departure.
                  </p>
                ) : (
                  selectedRun.bookings.map((rb, idx) => (
                    <div
                      key={rb.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        rb.isBoarded
                          ? "bg-forest-950/60 border-emerald-500/40"
                          : "bg-forest-950/80 border-forest-800/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-gold-500/20 text-gold-400 border border-gold-400/40 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {rb.pickupOrder || idx + 1}
                          </span>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white">
                                {rb.booking.customerName}
                              </h4>
                              <span className="text-xs font-mono text-gold-300 bg-gold-950/60 px-2 py-0.5 rounded border border-gold-800/40">
                                {rb.booking.totalSeats} Guests
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">
                                #{rb.booking.bookingReference}
                              </span>
                            </div>

                            <p className="text-xs text-slate-300 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                              <span>{rb.booking.pickupStop?.name || "Fairmont Banff Springs"} ({rb.booking.pickupStop?.town || "Banff"})</span>
                            </p>

                            {rb.booking.specialRequests && (
                              <p className="text-[11px] text-amber-300 italic">
                                Note: {rb.booking.specialRequests}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                              <a href={`tel:${rb.booking.customerPhone}`} className="hover:text-gold-300 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-emerald-400" />
                                <span>{rb.booking.customerPhone}</span>
                              </a>
                              <span className="font-mono">Voucher: {rb.booking.voucherCode}</span>
                            </div>
                          </div>
                        </div>

                        {/* 1-Click Boarding Check-in */}
                        <button
                          onClick={() => handleToggleBoarding(rb.id, rb.isBoarded)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors ${
                            rb.isBoarded
                              ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-glow"
                              : "bg-forest-900 hover:bg-forest-800 text-slate-300 border border-forest-700"
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{rb.isBoarded ? "Boarded" : "Check-in"}</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-[#050C0A] border-t border-forest-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>{selectedRun.bookings.length} Pickups on Manifest</span>
                {selectedRun.trackingSession && (
                  <Link
                    href={`/track/${selectedRun.trackingSession.token}`}
                    target="_blank"
                    className="text-gold-400 hover:text-gold-300 font-semibold flex items-center gap-1"
                  >
                    <span>Open Live GPS Telemetry View</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
