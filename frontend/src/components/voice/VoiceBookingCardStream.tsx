"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Ticket,
  QrCode,
  Compass,
  Car,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

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
  onSelectDeparture?: (departure: any) => void;
  onSelectPickup?: (stopName: string) => void;
}

export function VoiceBookingCardStream({
  data,
  checkoutUrl,
  hasSafetyRefusal,
  onSelectDeparture,
  onSelectPickup,
}: VoiceBookingCardStreamProps) {
  // Hold countdown state (10 minutes)
  const [secondsRemaining, setSecondsRemaining] = useState(600);

  useEffect(() => {
    if (!checkoutUrl && data?.type !== "hold") return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [checkoutUrl, data?.type]);

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, "0")}`;
  };

  if (!data && !checkoutUrl && !hasSafetyRefusal) {
    return null;
  }

  return (
    <div className="space-y-3 w-full">
      {/* 1. Security Refusal Banner */}
      {hasSafetyRefusal && (
        <div className="p-4 rounded-2xl bg-amber-950/70 border border-amber-600/80 text-amber-100 shadow-xl space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-400 text-xs tracking-wider uppercase">
            <ShieldCheck className="w-4 h-4" />
            <span>PCI-DSS Security Notice</span>
          </div>
          <p className="text-xs leading-relaxed text-amber-200">
            For your cardholder security and privacy, our AI Voice Assistant strictly never collects credit card, CVV, or expiry details over voice. All transactions must be completed on our PCI-DSS Level 1 encrypted checkout page.
          </p>
          {checkoutUrl && (
            <Link
              href={checkoutUrl}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md mt-1"
            >
              <span>Go to Encrypted Checkout</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}

      {/* 2. Availability Departures Card */}
      {data?.type === "availability" && data.departures && data.departures.length > 0 && (
        <div className="p-4 rounded-2xl bg-obsidian-900/90 border border-slate-700/80 shadow-2xl space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-summit-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5" />
              <span>Available Departures (Bókun Live)</span>
            </span>
            <span className="text-xs text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
              Guaranteed Seats
            </span>
          </div>

          <div className="grid gap-2">
            {data.departures.map((dep) => (
              <div
                key={dep.id}
                onClick={() => onSelectDeparture?.(dep)}
                className="p-3 rounded-xl bg-obsidian-950/80 border border-slate-800 hover:border-summit-500/80 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-white text-xs group-hover:text-summit-300 transition-colors">
                    {dep.title || "Scheduled Departure"}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {dep.date} at {dep.departureTime}
                    </span>
                    <span className="text-emerald-400 font-medium">
                      • {dep.availableSeats} seats left
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold font-mono text-summit-400">
                    ${dep.price} {dep.currency}
                  </div>
                  <span className="text-xs text-ocean-400 group-hover:underline flex items-center gap-0.5 justify-end">
                    Select <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Hotel Pickup Stops Card */}
      {data?.type === "pickups" && data.stops && data.stops.length > 0 && (
        <div className="p-4 rounded-2xl bg-obsidian-900/90 border border-slate-700/80 shadow-2xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-summit-400 uppercase tracking-wider">
            <MapPin className="w-3.5 h-3.5" />
            <span>Matching Banff &amp; Canmore Pickup Stops</span>
          </div>

          <div className="grid gap-2">
            {data.stops.map((stop) => (
              <div
                key={stop.id}
                onClick={() => onSelectPickup?.(stop.name)}
                className="p-2.5 rounded-xl bg-obsidian-950/80 border border-slate-800 hover:border-summit-500/80 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-summit-300">
                    {stop.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {stop.address}, {stop.town}
                  </div>
                </div>
                <span className="text-xs text-summit-400 border border-summit-500/40 rounded px-2 py-0.5">
                  Confirm Pickup
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. 10-Minute Reservation Hold & Checkout Card */}
      {(checkoutUrl || data?.type === "hold") && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-obsidian-900 via-forest-950 to-obsidian-900 border-2 border-summit-500/90 shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-summit-400 uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Guaranteed 10-Minute Hold Placed</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 bg-amber-950/70 border border-amber-800 px-2 py-0.5 rounded-md">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span>{formatCountdown(secondsRemaining)}</span>
            </div>
          </div>

          {data?.departure && (
            <div className="p-3 rounded-xl bg-obsidian-950/70 border border-slate-800 text-xs space-y-1">
              <div className="font-bold text-white text-sm">{data.departure.title}</div>
              <div className="text-slate-300 flex flex-wrap gap-x-3 gap-y-1">
                <span>🗓️ {data.departure.date} at {data.departure.departureTime}</span>
                <span>👥 {data.departure.seats} Guests</span>
                {data.departure.pickup && <span>📍 {data.departure.pickup}</span>}
              </div>
              {data.departure.price && (
                <div className="text-right pt-1 font-bold text-summit-400 font-mono text-sm">
                  Total: ${data.departure.price}.00 {data.departure.currency || "CAD"}
                </div>
              )}
            </div>
          )}

          {checkoutUrl && (
            <Link
              href={checkoutUrl}
              className="w-full py-3 px-4 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-summit-400 to-amber-300 hover:from-summit-300 hover:to-amber-200 text-xs flex items-center justify-center gap-2 shadow-lg hover:shadow-glow transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Complete Secure Checkout &amp; Pay</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}

          <div className="text-xs text-center text-slate-400">
            🔒 PCI-DSS Level 1 Certified • 256-Bit SSL Encrypted • Bókun System of Record
          </div>
        </div>
      )}

      {/* 5. Booking Confirmed Voucher Card */}
      {data?.type === "confirmed" && data.bookingReference && (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/90 via-obsidian-900 to-emerald-950/90 border-2 border-emerald-500/80 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              <span>Reservation Confirmed</span>
            </div>
            <span className="font-mono text-xs font-bold text-white bg-emerald-900/60 px-2.5 py-1 rounded-md border border-emerald-700">
              #{data.bookingReference}
            </span>
          </div>

          <div className="flex items-center gap-4 bg-obsidian-950/80 p-3 rounded-xl border border-slate-800">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-slate-900 flex-shrink-0">
              <QrCode className="w-10 h-10" />
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="font-bold text-white">{data.tourTitle || "Vista Chase Journey"}</div>
              <div className="text-xs text-slate-400">
                {data.date} • Pickup: {data.pickup || "Designated Stop"}
              </div>
              <div className="text-xs text-emerald-400">
                Voucher Code: {data.voucherCode || "VC-BOARDING-PASS"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {data.voucherUrl && (
              <Link
                href={data.voucherUrl}
                className="flex-1 py-2.5 px-4 rounded-xl bg-summit-500 hover:bg-summit-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all"
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>View Digital Voucher</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
            <Link
              href="/pickup-finder"
              className="py-2.5 px-3 rounded-xl bg-obsidian-950 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-1"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Pickup Directions</span>
            </Link>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            <span>WhatsApp T-60 live GPS tracking corridor activated for this booking.</span>
          </div>
        </div>
      )}

      {/* 6. Live Shuttle Telemetry Card */}
      {data?.type === "tracking" && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-ocean-950 via-obsidian-900 to-ocean-950 border border-ocean-600/80 shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-ocean-400 uppercase tracking-wider">
              <Car className="w-4 h-4 text-ocean-400 animate-pulse" />
              <span>Live Shuttle Telemetry</span>
            </div>
            {data.estimatedMinutes !== undefined && (
              <div className="font-mono text-xs font-bold text-summit-400 bg-obsidian-950 px-2 py-0.5 rounded border border-ocean-700">
                ETA: ~{data.estimatedMinutes} Mins
              </div>
            )}
          </div>

          <div className="text-xs space-y-1 text-slate-300">
            <div className="font-bold text-white">{data.vehicle || "Mercedes-Benz Sprinter Executive #4"}</div>
            <div>Driver / Guide: {data.driver || "Marc Tremblay (Certified Guide)"}</div>
            {data.licensePlate && (
              <div className="text-xs text-slate-400 font-mono">Plate: {data.licensePlate}</div>
            )}
          </div>

          <Link
            href={`/track/${encodeURIComponent(data.trackingToken || "live")}`}
            className="w-full py-2 px-3 rounded-xl bg-ocean-700 hover:bg-ocean-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md"
          >
            <span>Open Live GPS Satellite Map</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
