"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Users,
  Ticket,
  Clock,
  Truck,
  ArrowRight,
  ShieldCheck,
  Calendar,
  RefreshCw,
  AlertCircle,
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

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics();
  }, []);

  async function fetchMetrics() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/metrics");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to load metrics. Ensure you are signed in as an Admin or Operator.");
      } else {
        setMetrics(data.metrics);
      }
    } catch {
      setError("Unable to connect to Admin API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-forest-950 text-white py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-forest-800 gap-4">
          <div>
            <div className="flex items-center gap-2 text-gold-400 text-xs font-semibold tracking-wider uppercase mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Operations Management • Vista Chase</span>
            </div>
            <h1 className="text-3xl font-display font-bold text-white">Banff Operations &amp; Admin Panel</h1>
            <p className="text-sm text-slate-400 mt-1">
              Real-time Canadian Rockies dispatch, inventory capacity, and booking controls.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/dispatch"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-forest-950 gold-gradient shadow-glow hover:opacity-95 transition-all text-sm"
            >
              <Truck className="w-4 h-4" />
              <span>Open Dispatch Board</span>
            </Link>
            <button
              onClick={fetchMetrics}
              disabled={loading}
              className="p-2.5 rounded-xl bg-forest-900 border border-forest-800 text-slate-300 hover:text-white hover:border-forest-700 transition-colors"
              title="Refresh Metrics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Error Notification / Login reminder */}
        {error && (
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-sm flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-300">{error}</p>
                <p className="text-xs text-amber-400/80 mt-1">
                  Tip: Log in with <code className="bg-amber-900/60 px-1 py-0.5 rounded">admin@vistachase.com</code> or <code className="bg-amber-900/60 px-1 py-0.5 rounded">dispatch@vistachase.com</code> to access staff controls.
                </p>
              </div>
            </div>
            <Link
              href="/login"
              className="px-4 py-1.5 rounded-lg bg-amber-400 text-forest-950 font-bold text-xs hover:bg-amber-300 transition-colors whitespace-nowrap"
            >
              Sign In to Staff Account
            </Link>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 rounded-2xl bg-forest-900 border border-forest-800 shadow-xl space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Total Revenue</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-display font-bold text-white font-mono">
              ${metrics?.totalRevenue?.toFixed(2) || "0.00"}
              <span className="text-xs text-slate-400 ml-1.5 font-sans">CAD</span>
            </div>
            <div className="text-xs text-emerald-400">Processed via Payment Provider</div>
          </div>

          <div className="p-6 rounded-2xl bg-forest-900 border border-forest-800 shadow-xl space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Confirmed Bookings</span>
              <Ticket className="w-4 h-4 text-gold-400" />
            </div>
            <div className="text-3xl font-display font-bold text-white font-mono">
              {metrics?.confirmedBookings || 0}
            </div>
            <div className="text-xs text-slate-400">
              Out of {metrics?.totalBookings || 0} total records
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-forest-900 border border-forest-800 shadow-xl space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Active Holds</span>
              <Clock className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-display font-bold text-white font-mono">
              {metrics?.activeHoldsCount || 0}
            </div>
            <div className="text-xs text-cyan-400">10-minute temporary locks active</div>
          </div>

          <div className="p-6 rounded-2xl bg-forest-900 border border-forest-800 shadow-xl space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Registered Accounts</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-display font-bold text-white font-mono">
              {metrics?.totalUsers || 0}
            </div>
            <div className="text-xs text-slate-400">Customers, Guides &amp; Dispatchers</div>
          </div>
        </div>

        {/* Quick Operations Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/dispatch"
            className="p-5 rounded-2xl bg-forest-900/60 border border-forest-800 hover:border-gold-500/50 transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/30 flex items-center justify-center text-gold-400 group-hover:scale-105 transition-transform">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white group-hover:text-gold-300 transition-colors">
                  Daily Dispatch Manifests
                </h4>
                <p className="text-xs text-slate-400">Driver pickup routes &amp; passenger check-in</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-gold-400 group-hover:translate-x-1 transition-all" />
          </Link>

          <Link
            href="/pickup-finder"
            className="p-5 rounded-2xl bg-forest-900/60 border border-forest-800 hover:border-emerald-500/50 transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Hotel Pickup Directory
                </h4>
                <p className="text-xs text-slate-400">25+ Banff, Canmore &amp; Lake Louise stops</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </Link>

          <Link
            href="/search"
            className="p-5 rounded-2xl bg-forest-900/60 border border-forest-800 hover:border-cyan-500/50 transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                <Ticket className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                  Inventory &amp; Search Engine
                </h4>
                <p className="text-xs text-slate-400">Live seat availability &amp; departures</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
          </Link>
        </div>

        {/* Recent Bookings Table */}
        <div className="rounded-2xl bg-forest-900 border border-forest-800 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-forest-800 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Recent Guest Reservations</h3>
            <span className="text-xs text-slate-400">Showing latest transactions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-forest-950/80 text-xs uppercase text-slate-400 border-b border-forest-800">
                <tr>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Guest</th>
                  <th className="py-3 px-4">Tour / Route</th>
                  <th className="py-3 px-4">Departure</th>
                  <th className="py-3 px-4">Seats</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest-800/60 font-medium">
                {metrics?.recentBookings && metrics.recentBookings.length > 0 ? (
                  metrics.recentBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-forest-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-gold-400 text-xs">
                        <Link href={`/booking/${b.bookingReference}/voucher`} className="hover:underline">
                          {b.bookingReference}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-white text-xs font-semibold">{b.customerName}</div>
                        <div className="text-[11px] text-slate-400">{b.customerEmail}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-200">
                        {b.tourDeparture?.tour?.title || b.tourDeparture?.shuttleRoute?.name || "Rockies Tour"}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div>{b.tourDeparture?.date}</div>
                        <div className="text-[11px] text-slate-400">{b.tourDeparture?.departureTime || "08:00 AM"}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono">{b.totalSeats}</td>
                      <td className="py-3.5 px-4 text-xs font-mono text-white">
                        ${b.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            b.status === "CONFIRMED"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : b.status === "CANCELLED"
                              ? "bg-red-950 text-red-400 border border-red-800"
                              : "bg-forest-800 text-slate-300"
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                      {loading ? "Loading bookings..." : "No bookings recorded yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
