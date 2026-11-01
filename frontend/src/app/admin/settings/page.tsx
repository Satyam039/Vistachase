"use client";

import { useEffect, useState } from "react";
import { AdminHeader, StaffSignIn, useStaffRole } from "@/components/admin/AdminHeader";
import { CheckCircle2, RefreshCw, Server, ShieldCheck, Mail, CreditCard, Layers, ExternalLink } from "lucide-react";
import Link from "next/link";

interface BokunStatus {
  configured: boolean;
  apiUrl?: string;
  autoSyncSeats?: boolean;
}

export default function AdminSettingsPage() {
  const role = useStaffRole();
  const [bokun, setBokun] = useState<BokunStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/bokun")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setBokun(data);
      })
      .catch(() => undefined);
  }, []);

  async function triggerBokunSync() {
    setSyncing(true);
    setSyncMessage("");
    try {
      const res = await fetch("/api/admin/bokun/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncMessage(`Sync triggered successfully. Synced ${data.synced ?? 0} departures.`);
      } else {
        setSyncMessage(data.error || "Sync request failed.");
      }
    } catch {
      setSyncMessage("Failed to reach server.");
    } finally {
      setSyncing(false);
    }
  }

  if (role === "") {
    return (
      <main className="mx-auto max-w-7xl px-page py-12">
        <StaffSignIn body="Sign in with an administrator account to view and manage platform settings." />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AdminHeader
        current="/admin/settings"
        eyebrow="Staff · Platform Settings"
        title="Settings & System Controls"
        subtitle="Platform configuration, integrations, background synchronizations and portal architecture."
      />

      <main className="mx-auto max-w-7xl px-page py-10 space-y-8">
        {/* Multi-Portal Architecture Status */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ocean-50 text-ocean-700">
              <Layers className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-medium text-slate-900">Active Multi-Portal Architecture</h2>
              <p className="text-sm text-slate-500">Separated route groups, isolated authentication experiences, and independent layouts.</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-ocean-700">Customer Portal</span>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Active
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-900">Path: /</p>
              <p className="mt-1 text-xs text-slate-500">Discovery, Booking, Account Trips (/account)</p>
              <Link href="/" target="_blank" className="mt-3 inline-flex items-center gap-1 text-xs text-ocean-700 hover:underline">
                Open customer site <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-ocean-700">Affiliate Portal</span>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Active
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-900">Path: /affiliate</p>
              <p className="mt-1 text-xs text-slate-500">Dedicated Login, Referrals, Commissions, Payouts</p>
              <Link href="/affiliate/dashboard" target="_blank" className="mt-3 inline-flex items-center gap-1 text-xs text-ocean-700 hover:underline">
                Open affiliate portal <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-ocean-700">Admin Portal</span>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Active
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-900">Path: /admin</p>
              <p className="mt-1 text-xs text-slate-500">Operations, Bookings, Departures, Dispatch, Staff</p>
              <span className="mt-3 inline-block text-xs text-slate-400">Current workspace</span>
            </div>
          </div>
        </section>

        {/* Integration Controls */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Bokun Integration */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-summit-50 text-summit-700">
                  <Server className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-medium text-slate-900">Bókun Channel Integration</h3>
                  <p className="text-xs text-slate-500">Seat availability sync & booking reservation push</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                Connected
              </span>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">API Gateway</span>
                <span className="font-mono text-xs text-slate-700">{bokun?.apiUrl || "https://api.bokuntest.com"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Availability Sync</span>
                <span className="font-medium text-emerald-700">Enabled (Every 15m)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Booking Outbox</span>
                <span className="font-medium text-emerald-700">Active (Queue processor every 2m)</span>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={triggerBokunSync}
                disabled={syncing}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Trigger Manual Seat Sync"}
              </button>
              {syncMessage && <p className="text-xs text-slate-600">{syncMessage}</p>}
            </div>
          </section>

          {/* Email & Stripe Providers */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-medium text-slate-900">Communication & Payments</h3>
                  <p className="text-xs text-slate-500">Customer notifications & payment gateway</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                Live
              </span>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Email Delivery</span>
                <span className="font-medium text-slate-800">SMTP / Resend Configured</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Stripe Payment</span>
                <span className="font-medium text-slate-800">Direct Checkout & Webhook Auto-Confirm</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Audit Logging</span>
                <span className="font-medium text-slate-800">All administrative operations logged</span>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100">
              <Link
                href="/admin/audit"
                className="inline-flex items-center gap-1 text-xs font-medium text-ocean-700 hover:underline"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> View System Audit Trail
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
