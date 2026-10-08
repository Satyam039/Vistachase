import Link from "next/link";
import type { Metadata } from "next";
import { MapPinOff, MessageSquare, Phone } from "lucide-react";
import LiveShuttleTrackingClient, { type TrackingTelemetry } from "@/components/tracking/LiveShuttleTrackingClient";

interface TrackPageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic";

async function fetchTelemetry(token: string): Promise<TrackingTelemetry | null> {
  try {
    const backendUrl = (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/$/, "");
    const res = await fetch(`${backendUrl}/api/track/${encodeURIComponent(token)}`, { cache: "no-store" });
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
  return {
    title: telemetry ? `Track your pickup · ${telemetry.bookingReference} | Vista Chase` : "Track your pickup | Vista Chase",
    robots: { index: false, follow: false },
  };
}

export default async function TrackPage({ params }: TrackPageProps) {
  const { token } = await params;
  const telemetry = await fetchTelemetry(token);
  if (telemetry) return <LiveShuttleTrackingClient initialTelemetry={telemetry} token={token} />;

  return (
    <div className="bg-obsidian-50 px-page py-16 sm:py-24">
      <div className="mx-auto max-w-lg rounded-[1.75rem] bg-white p-8 text-center ring-1 ring-obsidian-900/[0.07] sm:p-10">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-ocean-50 text-ocean-700">
          <MapPinOff className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-3xl font-light tracking-tight text-obsidian-900">Tracking isn&apos;t live right now</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          This link has ended or isn&apos;t recognised. Tracking opens shortly before your pickup; we send the link by text and email.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <a href="tel:+18257349456" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ocean-600 px-5 text-sm text-white hover:bg-ocean-700">
            <Phone className="h-4 w-4" aria-hidden="true" /> Call us
          </a>
          <a
            href="https://wa.me/18257349456"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-obsidian-900/10 px-5 text-sm text-obsidian-900 hover:bg-obsidian-50"
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" /> WhatsApp us
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
        <p className="mt-6 text-sm text-slate-600">
          <Link href="/account/trips" className="text-ocean-600 underline underline-offset-4">
            My trips
          </Link>{" "}
          ·{" "}
          <Link href="/pickup-finder" className="text-ocean-600 underline underline-offset-4">
            Find your pickup point
          </Link>
        </p>
      </div>
    </div>
  );
}
