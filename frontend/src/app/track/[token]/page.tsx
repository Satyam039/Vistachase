import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import LiveShuttleTrackingClient, { TrackingTelemetry } from "@/components/tracking/LiveShuttleTrackingClient";
import { Phone, MessageSquare, ArrowLeft, ShieldAlert } from "lucide-react";

interface TrackPageProps {
  params: Promise<{
    token: string;
  }>;
}

export const dynamic = "force-dynamic";

async function fetchTelemetry(token: string): Promise<TrackingTelemetry | null> {
  try {
    const backendUrl = (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/$/, "");
    const res = await fetch(`${backendUrl}/api/track/${token}`, {
      cache: "no-store",
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.telemetry || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: TrackPageProps): Promise<Metadata> {
  const { token } = await params;
  const telemetry = await fetchTelemetry(token);

  if (!telemetry) {
    return {
      title: "Live Shuttle Tracking | Vista Chase Canadian Rockies",
      description: "Real-time GPS shuttle tracking portal for Banff and Lake Louise.",
    };
  }

  return {
    title: `Live Shuttle Tracking • ${telemetry.vehicleName} (#${telemetry.bookingReference}) | Vista Chase`,
    description: `Track your Vista Chase alpine shuttle to ${telemetry.pickupStopName} in real-time.`,
  };
}

export default async function TrackPage({ params }: TrackPageProps) {
  const { token } = await params;
  const telemetry = await fetchTelemetry(token);

  if (!telemetry) {
    return (
      <div className="min-h-screen bg-ocean-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-ocean-900 rounded-3xl p-8 border border-forest-800/80 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-serif font-bold text-white tracking-tight">
              Tracking Session Concluded
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              This GPS tracking session is inactive, completed, or unrecognized. Tracking links remain active from 2 hours before departure until 3 hours after tour conclusion.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-forest-950/80 border border-forest-800/60 text-xs text-slate-300 space-y-3">
            <p className="font-semibold text-white">Need immediate assistance with your ride?</p>
            <div className="flex flex-col gap-2">
              <a
                href="tel:+18257349456"
                className="py-2.5 px-3 rounded-lg bg-forest-900 hover:bg-forest-800 text-white font-semibold flex items-center justify-center gap-2 border border-forest-700/60 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Call 24/7 Dispatch (+1 825-734-9456)</span>
              </a>
              <a
                href="https://wa.me/18257349456"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-200 font-semibold flex items-center justify-center gap-2 border border-emerald-800/60 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>Contact WhatsApp Concierge</span>
              </a>
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-gold-400 hover:text-gold-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Vista Chase Home</span>
          </Link>
        </div>
      </div>
    );
  }

  return <LiveShuttleTrackingClient initialTelemetry={telemetry} token={token} />;
}
