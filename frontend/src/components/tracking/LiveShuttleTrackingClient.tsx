"use client";

// Live pickup tracking (Uber / Lyft trip-status layout): status and ETA first, a simplified route map
// projected from the real coordinates, then driver, vehicle and pickup details. Everything shown
// comes from /api/track/:token; it refreshes every 8 seconds while the tab is visible.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LiveMap } from "@/components/tracking/LiveMap";
import { CarFront, Clock, ExternalLink, MapPin, MessageSquare, Navigation, Phone, RefreshCw } from "lucide-react";

export interface VehicleCoordinates {
  latitude: number;
  longitude: number;
  heading: number;
  speedKmh: number;
  altitudeMeters?: number;
  updatedAt: string;
}

export interface RouteWaypoint {
  name: string;
  latitude: number;
  longitude: number;
  isPassed: boolean;
  isCurrent: boolean;
  estimatedTime?: string;
}

export interface TrackingTelemetry {
  sessionToken: string;
  bookingReference: string;
  customerName: string;
  tourName: string;
  departureDate: string;
  departureTime: string;
  pickupStopName: string;
  pickupAddress: string;
  pickupInstructions: string;
  pickupTime: string;
  vehicleName: string;
  licensePlate: string;
  driverName: string;
  driverPhoto: string;
  driverPhone?: string;
  status: "PREPARING" | "ON_THE_WAY" | "ARRIVING_SOON" | "SHUTTLE_IS_HERE" | "IN_TRANSIT" | "COMPLETED";
  statusLabel: string;
  statusDescription: string;
  estimatedArrivalMinutes: number;
  vehicleCoordinates: VehicleCoordinates;
  destinationCoordinates: { latitude: number; longitude: number };
  routeWaypoints: RouteWaypoint[];
  isTrackingActive: boolean;
}

const OFFICE_PHONE = "+18257349456";
const CARD = "rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07] sm:p-7";

// Progress steps shown under the ETA; each status maps to how far along the pickup is.
const STEPS = ["Preparing", "On the way", "Arriving", "Picked up"];
const STEP_OF: Record<TrackingTelemetry["status"], number> = {
  PREPARING: 0,
  ON_THE_WAY: 1,
  ARRIVING_SOON: 2,
  SHUTTLE_IS_HERE: 2,
  IN_TRANSIT: 3,
  COMPLETED: 3,
};

// Headlines come from the status, not the backend's label, so they never contradict the live ETA.
const HEADLINE: Record<TrackingTelemetry["status"], string> = {
  PREPARING: "Getting ready to leave",
  ON_THE_WAY: "Your shuttle is on the way",
  ARRIVING_SOON: "Arriving soon",
  SHUTTLE_IS_HERE: "Your shuttle is here",
  IN_TRANSIT: "You're on your way",
  COMPLETED: "Trip complete",
};

const formatDate = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
};
const mapsLink = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

export default function LiveShuttleTrackingClient({ initialTelemetry, token }: { initialTelemetry: TrackingTelemetry; token: string }) {
  const [t, setT] = useState(initialTelemetry);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [stale, setStale] = useState(false);
  const busy = useRef(false);

  const refresh = useCallback(
    async (manual = false) => {
      if (busy.current) return;
      busy.current = true;
      if (manual) setRefreshing(true);
      try {
        const res = await fetch(`/api/track/${encodeURIComponent(token)}`, { cache: "no-store" });
        const data = res.ok ? await res.json() : null;
        if (data?.telemetry) {
          setT(data.telemetry);
          setUpdatedAt(new Date());
          setStale(false);
        } else setStale(true);
      } catch {
        setStale(true);
      } finally {
        busy.current = false;
        if (manual) setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    setUpdatedAt(new Date());
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 8000);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const [mapFailed, setMapFailed] = useState(false);
  const { latitude: vLat, longitude: vLng } = t.vehicleCoordinates;
  const { latitude: pLat, longitude: pLng } = t.destinationCoordinates;
  const first = t.routeWaypoints[0];
  const vehicleLL = useMemo<[number, number]>(() => [vLng, vLat], [vLng, vLat]);
  const pickupLL = useMemo<[number, number]>(() => [pLng, pLat], [pLng, pLat]);
  const startLL = useMemo<[number, number] | undefined>(() => (first ? [first.longitude, first.latitude] : undefined), [first?.longitude, first?.latitude]); // eslint-disable-line react-hooks/exhaustive-deps
  const step = STEP_OF[t.status] ?? 1;
  const here = t.status === "SHUTTLE_IS_HERE";
  const onboard = t.status === "IN_TRANSIT" || t.status === "COMPLETED";
  const phone = t.driverPhone ? t.driverPhone.replace(/[^\d+]/g, "") : OFFICE_PHONE;
  const whatsapp = `https://wa.me/${OFFICE_PHONE.slice(1)}?text=${encodeURIComponent(`Hi Vista Chase, I'm tracking my pickup for booking ${t.bookingReference}.`)}`;

  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      <div className="mx-auto max-w-6xl px-page pb-16 pt-8 sm:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <span className="relative inline-flex h-2.5 w-2.5" aria-hidden="true">
                <span className={`absolute inset-0 rounded-full ${stale ? "bg-slate-400" : "bg-ocean-500 motion-safe:animate-ping"} opacity-60`} />
                <span className={`relative h-2.5 w-2.5 rounded-full ${stale ? "bg-slate-400" : "bg-ocean-600"}`} />
              </span>
              {stale ? "Reconnecting…" : "Live pickup tracking"} · Booking {t.bookingReference}
            </p>
            <h1 className="mt-2 text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl">{t.tourName}</h1>
            <p className="mt-1.5 text-base text-slate-600">
              {formatDate(t.departureDate)} · Departs {t.departureTime}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refresh(true)}
            disabled={refreshing}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-obsidian-900/15 bg-white px-5 text-sm text-obsidian-900 hover:bg-obsidian-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          {/* Status + map */}
          <div className="space-y-6">
            <section aria-labelledby="status-h" className="rounded-[1.75rem] bg-ocean-950 p-6 text-white sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="min-w-0 flex-1" role="status" aria-live="polite" aria-atomic="true">
                  <h2 id="status-h" className="text-2xl font-light text-white sm:text-3xl">
                    {HEADLINE[t.status] ?? t.statusLabel}
                  </h2>
                  <p className="mt-2 max-w-xl text-base leading-relaxed text-white/80">{t.statusDescription}</p>
                </div>
                {!onboard && !here && (
                  <div className="shrink-0 sm:text-right">
                    <p className="text-sm text-white/70">Arrives in about</p>
                    <p className="text-4xl font-light tabular-nums text-white sm:text-5xl">{t.estimatedArrivalMinutes} min</p>
                  </div>
                )}
              </div>

              <ol className="mt-8 grid grid-cols-4 gap-2" aria-label="Pickup progress">
                {STEPS.map((label, i) => (
                  <li key={label} aria-current={i === step ? "step" : undefined}>
                    <span className={`block h-1.5 rounded-full ${i <= step ? "bg-summit-400" : "bg-white/15"}`} />
                    <span className={`mt-2 block text-xs sm:text-sm ${i === step ? "text-white" : "text-white/70"}`}>{label}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="map-h" className="overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-obsidian-900/[0.07]">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 sm:px-7">
                <h2 id="map-h" className="text-lg text-obsidian-900">
                  Where your shuttle is
                </h2>
                <a
                  href={mapsLink(t.vehicleCoordinates.latitude, t.vehicleCoordinates.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-ocean-600 underline-offset-4 hover:underline"
                >
                  Open in Google Maps <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>
              {mapFailed ? (
                <RouteMap t={t} />
              ) : (
                <LiveMap
                  start={startLL}
                  vehicle={vehicleLL}
                  pickup={pickupLL}
                  label={`Map: the shuttle is about ${t.estimatedArrivalMinutes} minutes from ${t.pickupStopName}.`}
                  onError={() => setMapFailed(true)}
                />
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-obsidian-900/[0.06] px-6 py-4 text-sm text-slate-600 sm:px-7">
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-ocean-600" aria-hidden="true" /> Shuttle
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-summit-500" aria-hidden="true" /> Your pickup
                  </span>
                </span>
                <span>
                  {t.vehicleCoordinates.speedKmh > 0 ? `${t.vehicleCoordinates.speedKmh} km/h · ` : ""}
                  Updated {updatedAt ? updatedAt.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "just now"}
                </span>
              </div>
            </section>
          </div>

          {/* Driver, vehicle, pickup */}
          <div className="space-y-6">
            <section aria-labelledby="driver-h" className={CARD}>
              <h2 id="driver-h" className="text-sm text-slate-600">
                Your driver
              </h2>
              <div className="mt-3 flex items-center gap-4">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-ocean-950 ring-1 ring-obsidian-900/10">
                  <Image src={t.driverPhoto} alt="" fill sizes="56px" className="object-cover" />
                </span>
                <p className="min-w-0 text-xl text-obsidian-900">{t.driverName}</p>
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-2xl bg-obsidian-50 p-4">
                <CarFront className="mt-0.5 h-5 w-5 shrink-0 text-ocean-600" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-base text-obsidian-900">{t.vehicleName}</p>
                  <p className="mt-1 inline-flex rounded-md border border-obsidian-900/15 bg-white px-2 py-0.5 font-mono text-sm tracking-wide text-obsidian-900">
                    {t.licensePlate}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <a href={`tel:${phone}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ocean-600 px-4 text-sm text-white hover:bg-ocean-700">
                  <Phone className="h-4 w-4" aria-hidden="true" /> Call
                </a>
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-obsidian-900/15 px-4 text-sm text-obsidian-900 hover:bg-obsidian-50"
                >
                  <MessageSquare className="h-4 w-4" aria-hidden="true" /> WhatsApp
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>
            </section>

            <section aria-labelledby="pickup-h" className={CARD}>
              <div className="flex items-center justify-between gap-3">
                <h2 id="pickup-h" className="text-sm text-slate-600">
                  Pickup
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-summit-100 px-3 py-1 text-sm text-obsidian-900">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {t.pickupTime}
                </span>
              </div>
              <p className="mt-3 flex items-start gap-2 text-lg text-obsidian-900">
                <MapPin className="mt-1 h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
                {t.pickupStopName}
              </p>
              <p className="ml-6 text-sm text-slate-600">{t.pickupAddress}</p>
              {t.pickupInstructions && <p className="mt-4 rounded-2xl bg-obsidian-50 p-4 text-sm leading-relaxed text-slate-700">{t.pickupInstructions}</p>}
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${t.destinationCoordinates.latitude},${t.destinationCoordinates.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-ocean-600 underline-offset-4 hover:underline"
              >
                <Navigation className="h-3.5 w-3.5" aria-hidden="true" /> Walking directions
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </section>

            <p className="px-2 text-sm leading-relaxed text-slate-600">
              Running late or can&apos;t find the shuttle? Call{" "}
              <a href={`tel:${OFFICE_PHONE}`} className="text-ocean-600 underline underline-offset-4">
                +1 825-734-9456
              </a>
              . See your{" "}
              <Link href={`/booking/${encodeURIComponent(t.bookingReference)}/voucher`} className="text-ocean-600 underline underline-offset-4">
                voucher
              </Link>{" "}
              for the full itinerary.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Fallback when the street map can't load (no WebGL). Simplified map: the route's real coordinates fitted to the frame (equirectangular, corrected for
// latitude), so positions are true relative to each other. No tiles: only our own drawing.
function RouteMap({ t }: { t: TrackingTelemetry }) {
  const W = 640;
  const H = 320;
  const PAD = 48;
  const start = t.routeWaypoints[0];
  const pts = [
    ...(start ? [start] : []),
    t.vehicleCoordinates,
    t.destinationCoordinates,
  ];
  const k = Math.cos((t.destinationCoordinates.latitude * Math.PI) / 180);
  const xs = pts.map((p) => p.longitude * k);
  const ys = pts.map((p) => p.latitude);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((W - PAD * 2) / Math.max(x1 - x0, 1e-4), (H - PAD * 2) / Math.max(y1 - y0, 1e-4));
  const ox = (W - (x1 - x0) * scale) / 2;
  const oy = (H - (y1 - y0) * scale) / 2;
  const project = (p: { latitude: number; longitude: number }) => ({
    x: ox + (p.longitude * k - x0) * scale,
    y: H - (oy + (p.latitude - y0) * scale),
  });
  const s = start ? project(start) : null;
  const v = project(t.vehicleCoordinates);
  const d = project(t.destinationCoordinates);
  // Anchor labels so they stay inside the frame near either edge.
  const anchor = (x: number) => (x < W * 0.3 ? "start" : x > W * 0.7 ? "end" : "middle");
  const labelX = (x: number) => (x < W * 0.3 ? Math.max(x - 12, 12) : x > W * 0.7 ? Math.min(x + 12, W - 12) : x);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Map: the shuttle is about ${t.estimatedArrivalMinutes} minutes from ${t.pickupStopName}.`}>
      <defs>
        <pattern id="vc-map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" fill="none" className="stroke-obsidian-900/[0.05]" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W} height={H} className="fill-obsidian-50" />
      <rect width={W} height={H} fill="url(#vc-map-grid)" />
      {s && (
        <>
          <line x1={s.x} y1={s.y} x2={d.x} y2={d.y} className="stroke-obsidian-900/20" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 10" />
          <line x1={s.x} y1={s.y} x2={v.x} y2={v.y} className="stroke-ocean-600" strokeWidth="5" strokeLinecap="round" />
          <circle cx={s.x} cy={s.y} r="5" className="fill-white stroke-obsidian-900/40" strokeWidth="2" />
          <text x={labelX(s.x)} y={s.y + 26} textAnchor={anchor(s.x)} className="fill-slate-600 text-[13px]">
            {start!.name.replace(/^Vista Chase /, "")}
          </text>
        </>
      )}
      <g>
        <circle cx={d.x} cy={d.y} r="16" className="fill-summit-500/25" />
        <circle cx={d.x} cy={d.y} r="8" className="fill-summit-500 stroke-white" strokeWidth="3" />
        <text x={labelX(d.x)} y={d.y < 40 ? d.y + 34 : d.y - 22} textAnchor={anchor(d.x)} className="fill-obsidian-900 text-[14px]">
          {t.pickupStopName}
        </text>
      </g>
      <g style={{ transform: `translate(${v.x}px, ${v.y}px)`, transition: "transform 1s ease-out" }}>
        <circle r="18" className="fill-ocean-500/20 motion-safe:animate-ping" />
        <circle r="11" className="fill-ocean-600 stroke-white" strokeWidth="3" />
      </g>
    </svg>
  );
}
