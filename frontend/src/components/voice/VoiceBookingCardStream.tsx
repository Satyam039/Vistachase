"use client";

// Rich cards the concierge attaches to a reply (departures, pickups, a seat hold, a confirmed
// booking, live tracking), styled like the attachments in ChatGPT / Claude / Gemini: light,
// quiet cards inside the conversation, with real buttons for choices. Only data the API sent
// is shown (no placeholder drivers or vehicles).

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, Car, CheckCircle2, Clock, MapPin, ShieldCheck, Ticket } from "lucide-react";

export interface VoiceCardData {
  type?: "availability" | "pickups" | "hold" | "confirmed" | "tracking" | "tour";
  tour?: {
    slug?: string;
    title?: string;
    category?: string;
    durationHours?: number;
    basePrice?: number;
    currency?: string;
    featuredImage?: string;
    summary?: string;
    rating?: number;
  };
  departures?: Array<{
    id: string;
    title?: string;
    date: string;
    departureTime: string;
    price: number;
    currency: string;
    availableSeats: number;
  }>;
  stops?: Array<{
    id: string;
    name: string;
    town: string;
    address: string;
  }>;
  departure?: {
    title?: string;
    date?: string;
    departureTime?: string;
    seats?: number;
    pickup?: string;
    price?: number;
    currency?: string;
  };
  bookingReference?: string;
  voucherCode?: string;
  voucherUrl?: string;
  tourTitle?: string;
  date?: string;
  pickup?: string;
  estimatedMinutes?: number;
  vehicle?: string;
  driver?: string;
  licensePlate?: string;
  trackingToken?: string;
}

interface VoiceBookingCardStreamProps {
  data?: VoiceCardData;
  checkoutUrl?: string;
  hasSafetyRefusal?: boolean;
  onSelectDeparture?: (departure: NonNullable<VoiceCardData["departures"]>[number]) => void;
  onSelectPickup?: (stopName: string) => void;
}

const CARD = "rounded-2xl border border-obsidian-900/10 bg-white p-4";
const CARD_TITLE = "mb-3 flex items-center gap-2 text-sm text-slate-700";
const CHOICE =
  "flex w-full items-center justify-between gap-3 rounded-xl border border-obsidian-900/10 px-3.5 py-3 text-left transition-colors hover:border-ocean-600/50 hover:bg-ocean-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ocean-600";

const shortDate = (d?: string) => {
  if (!d) return "";
  const parsed = new Date(`${d}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
};

export function VoiceBookingCardStream({ data, checkoutUrl, hasSafetyRefusal, onSelectDeparture, onSelectPickup }: VoiceBookingCardStreamProps) {
  // Seat holds last 10 minutes.
  const [secondsRemaining, setSecondsRemaining] = useState(600);
  useEffect(() => {
    if (!checkoutUrl && data?.type !== "hold") return;
    const interval = setInterval(() => setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(interval);
  }, [checkoutUrl, data?.type]);
  const countdown = `${Math.floor(secondsRemaining / 60)}:${String(secondsRemaining % 60).padStart(2, "0")}`;

  if (!data && !checkoutUrl && !hasSafetyRefusal) return null;

  return (
    <div className="mt-3 w-full space-y-3">
      {hasSafetyRefusal && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-amber-700" aria-hidden="true" />
            Please don&rsquo;t share card details here
          </p>
          <p className="mt-1 leading-relaxed">
            The concierge never takes card numbers. Payment always happens on our secure checkout page.
          </p>
          {checkoutUrl && (
            <Link href={checkoutUrl} className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-obsidian-900 px-4 text-sm text-white hover:bg-obsidian-800">
              Go to secure checkout
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

      {data?.type === "availability" && data.departures && data.departures.length > 0 && (
        <div className={CARD}>
          <p className={CARD_TITLE}>
            <Calendar className="h-4 w-4 text-ocean-600" aria-hidden="true" />
            Available departures
          </p>
          <ul className="grid gap-2">
            {data.departures.map((dep) => (
              <li key={dep.id}>
                <button type="button" onClick={() => onSelectDeparture?.(dep)} className={CHOICE}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-obsidian-900">{dep.title || "Departure"}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {shortDate(dep.date)} · {dep.departureTime}
                      <span className="text-emerald-700">{dep.availableSeats} seats left</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm text-obsidian-900">
                      ${dep.price} <span className="text-xs text-slate-600">{dep.currency}</span>
                    </span>
                    <span className="text-xs text-ocean-700">Choose</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data?.type === "pickups" && data.stops && data.stops.length > 0 && (
        <div className={CARD}>
          <p className={CARD_TITLE}>
            <MapPin className="h-4 w-4 text-ocean-600" aria-hidden="true" />
            Pickup stops near you
          </p>
          <ul className="grid gap-2">
            {data.stops.map((stop) => (
              <li key={stop.id}>
                <button type="button" onClick={() => onSelectPickup?.(stop.name)} className={CHOICE}>
                  <span className="min-w-0">
                    <span className="block text-sm text-obsidian-900">{stop.name}</span>
                    <span className="block text-xs text-slate-600">
                      {stop.address}, {stop.town}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-ocean-700">Use this stop</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(checkoutUrl || data?.type === "hold") && !hasSafetyRefusal && (
        <div className={`${CARD} border-summit-500/60`}>
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-obsidian-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              Seats held for you
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-summit-100 px-2.5 py-0.5 font-mono text-xs text-obsidian-900">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {countdown}
              <span className="sr-only"> left on your hold</span>
            </span>
          </div>
          {data?.departure && (
            <div className="mt-3 rounded-xl bg-obsidian-50 p-3 text-sm">
              <p className="text-obsidian-900">{data.departure.title}</p>
              <p className="mt-0.5 text-xs text-slate-600">
                {shortDate(data.departure.date)} · {data.departure.departureTime}
                {data.departure.seats ? ` · ${data.departure.seats} guests` : ""}
                {data.departure.pickup ? ` · ${data.departure.pickup}` : ""}
              </p>
              {data.departure.price != null && (
                <p className="mt-2 text-right text-base text-obsidian-900">
                  ${data.departure.price.toFixed(2)} {data.departure.currency || "CAD"}
                </p>
              )}
            </div>
          )}
          {checkoutUrl && (
            <Link href={checkoutUrl} className="golden-summit-btn mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Continue to secure checkout
            </Link>
          )}
        </div>
      )}

      {data?.type === "confirmed" && data.bookingReference && (
        <div className={`${CARD} border-emerald-200`}>
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Booking confirmed
            </p>
            <span className="rounded-full bg-obsidian-900/[0.05] px-2.5 py-0.5 font-mono text-xs text-obsidian-900">{data.bookingReference}</span>
          </div>
          <p className="mt-3 text-base text-obsidian-900">{data.tourTitle || "Your Vista Chase trip"}</p>
          <p className="text-sm text-slate-600">
            {shortDate(data.date)}
            {data.pickup ? ` · Pickup: ${data.pickup}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.voucherUrl && (
              <Link href={data.voucherUrl} className="golden-summit-btn inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm">
                <Ticket className="h-4 w-4" aria-hidden="true" />
                View voucher
              </Link>
            )}
            <Link href="/pickup-finder" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-obsidian-900/15 px-4 text-sm text-obsidian-900 hover:bg-obsidian-50">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Pickup directions
            </Link>
          </div>
        </div>
      )}

      {data?.type === "tracking" && (
        <div className={CARD}>
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-obsidian-900">
              <Car className="h-4 w-4 text-ocean-600" aria-hidden="true" />
              Your vehicle
            </p>
            {data.estimatedMinutes !== undefined && (
              <span className="rounded-full bg-ocean-50 px-2.5 py-0.5 text-xs text-ocean-800">About {data.estimatedMinutes} min away</span>
            )}
          </div>
          {(data.vehicle || data.driver || data.licensePlate) && (
            <p className="mt-2 text-sm text-slate-700">
              {[data.vehicle, data.driver && `Guide: ${data.driver}`, data.licensePlate && `Plate ${data.licensePlate}`].filter(Boolean).join(" · ")}
            </p>
          )}
          {data.trackingToken && (
            <Link
              href={`/track/${encodeURIComponent(data.trackingToken)}`}
            className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-obsidian-900 px-4 text-sm text-white hover:bg-obsidian-800"
          >
            Open live map
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          )}
        </div>
      )}
    </div>
  );
}
