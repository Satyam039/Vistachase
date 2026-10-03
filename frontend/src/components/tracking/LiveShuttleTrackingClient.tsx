"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Navigation,
  Car,
  MapPin,
  Compass,
  Phone,
  MessageSquare,
  ShieldCheck,
  Clock,
  RefreshCw,
  Wifi,
  Thermometer,
  Sparkles,
} from "lucide-react";

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
  destinationCoordinates: {
    latitude: number;
    longitude: number;
  };
  routeWaypoints: RouteWaypoint[];
  isTrackingActive: boolean;
}

interface LiveShuttleTrackingClientProps {
  initialTelemetry: TrackingTelemetry;
  token: string;
}

export default function LiveShuttleTrackingClient({
  initialTelemetry,
  token,
}: LiveShuttleTrackingClientProps) {
  const [telemetry, setTelemetry] = useState<TrackingTelemetry>(initialTelemetry);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [mapZoom, setMapZoom] = useState<"route" | "vehicle">("route");

  // Auto-poll telemetry every 8 seconds
  const fetchTelemetry = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/track/${token}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.telemetry) {
          setTelemetry(data.telemetry);
          setLastUpdated(new Date());
        }
      }
    } catch (err) {
      console.error("Telemetry fetch error:", err);
    } finally {
      if (isManual) {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  }, [token]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchTelemetry(false);
    }, 8000);
    return () => clearInterval(timer);
  }, [fetchTelemetry]);

  // Status visual styles
  const getStatusBadge = () => {
    switch (telemetry.status) {
      case "SHUTTLE_IS_HERE":
        return {
          bg: "bg-amber-400/20 text-amber-300 border-amber-400/50",
          dot: "bg-amber-400 animate-ping",
          title: "SHUTTLE HAS ARRIVED",
          accentColor: "text-amber-400",
        };
      case "ARRIVING_SOON":
        return {
          bg: "bg-sky-500/20 text-sky-300 border-sky-400/50",
          dot: "bg-sky-400 animate-ping",
          title: `ARRIVING IN ${telemetry.estimatedArrivalMinutes} MINS`,
          accentColor: "text-sky-400",
        };
      case "IN_TRANSIT":
        return {
          bg: "bg-emerald-500/20 text-emerald-300 border-emerald-400/50",
          dot: "bg-emerald-400",
          title: "JOURNEY IN PROGRESS",
          accentColor: "text-emerald-400",
        };
      case "PREPARING":
        return {
          bg: "bg-slate-500/20 text-slate-300 border-slate-400/50",
          dot: "bg-slate-400",
          title: "PREPARING DEPARTURE",
          accentColor: "text-slate-300",
        };
      case "ON_THE_WAY":
      default:
        return {
          bg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
          dot: "bg-emerald-400 animate-pulse",
          title: `ON THE WAY • ${telemetry.estimatedArrivalMinutes} MINS AWAY`,
          accentColor: "text-emerald-400",
        };
    }
  };

  const statusStyle = getStatusBadge();

  // Normalize lat/lng to aesthetic SVG canvas
  const minLat = 51.05;
  const maxLat = 51.45;
  const minLng = -116.25;
  const maxLng = -115.3;

  const toSvgX = (lng: number) => {
    const clamped = Math.max(minLng, Math.min(maxLng, lng));
    return ((clamped - minLng) / (maxLng - minLng)) * 800;
  };

  const toSvgY = (lat: number) => {
    const clamped = Math.max(minLat, Math.min(maxLat, lat));
    return (1 - (clamped - minLat) / (maxLat - minLat)) * 450;
  };

  const vehicleX = toSvgX(telemetry.vehicleCoordinates.longitude);
  const vehicleY = toSvgY(telemetry.vehicleCoordinates.latitude);
  const targetX = toSvgX(telemetry.destinationCoordinates.longitude);
  const targetY = toSvgY(telemetry.destinationCoordinates.latitude);

  return (
    <div className="min-h-screen bg-[#07130F] text-slate-100 flex flex-col selection:bg-gold-500 selection:text-forest-950">
      {/* Top Luxury Navigation Header */}
      <header className="sticky top-0 z-50 bg-[#07130F]/90 backdrop-blur-md border-b border-forest-800/60 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="font-serif font-bold text-xl tracking-wider text-white group-hover:text-gold-300 transition-colors">
              VISTA CHASE
            </span>
            <span className="text-[10px] tracking-widest text-gold-400 font-semibold uppercase px-2 py-0.5 rounded bg-gold-950/60 border border-gold-800/40">
              LIVE CONCIERGE
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="hidden sm:flex items-center gap-2 text-slate-400 bg-forest-950/80 px-3 py-1.5 rounded-full border border-forest-800/50 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>GPS 10Hz TELEMETRY LIVE</span>
          </div>

          <button
            onClick={() => fetchTelemetry(true)}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-forest-900/60 border border-forest-700/60 text-slate-300 hover:text-white hover:border-gold-500/50 transition-all"
            title="Refresh GPS Signal"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-gold-400" : ""}`} />
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: Map & Telemetry (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">

          {/* Status Header Banner */}
          <div className="bg-[#0C1E18] rounded-2xl p-5 border border-forest-800/60 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase border ${statusStyle.bg}`}>
                  <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                  {statusStyle.title}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Ref #{telemetry.bookingReference}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
                {telemetry.tourName}
              </h1>
              <p className="text-sm text-slate-300 mt-1">
                {telemetry.statusDescription}
              </p>
            </div>

            {/* Prominent ETA Dial */}
            <div className="shrink-0 flex items-center gap-3 bg-forest-950/80 px-4 py-3 rounded-xl border border-gold-500/30">
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-widest text-gold-400 font-bold block">
                  ESTIMATED ARRIVAL
                </span>
                <span className="text-2xl sm:text-3xl font-bold font-serif text-white">
                  {telemetry.estimatedArrivalMinutes} <span className="text-sm font-sans font-normal text-slate-400">MINS</span>
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-gold-500/10 border border-gold-400/30 flex items-center justify-center text-gold-400">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Interactive Topographic Vector Map */}
          <div className="relative bg-[#050C0A] rounded-3xl border border-forest-800/80 shadow-2xl overflow-hidden min-h-[380px] sm:min-h-[460px] flex flex-col">
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-[#07130F]/90 backdrop-blur-md border border-forest-700/60 text-xs font-semibold text-slate-200 flex items-center gap-2 shadow-lg">
                <Compass className="w-3.5 h-3.5 text-gold-400" />
                <span>Bow Valley Parkway • Trans-Canada Hwy 1</span>
              </div>
            </div>

            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              <button
                onClick={() => setMapZoom(mapZoom === "route" ? "vehicle" : "route")}
                className="px-3 py-1.5 rounded-xl bg-[#07130F]/90 backdrop-blur-md border border-forest-700/60 text-xs font-semibold text-gold-300 hover:text-white transition-colors shadow-lg flex items-center gap-1.5"
              >
                <Navigation className="w-3.5 h-3.5 text-gold-400" />
                <span>{mapZoom === "route" ? "Follow Vehicle" : "Full Route"}</span>
              </button>
            </div>

            {/* SVG Canvas */}
            <div className="relative w-full flex-1 flex items-center justify-center p-4">
              <svg
                viewBox="0 0 800 450"
                className="w-full h-full max-h-[440px] drop-shadow-md select-none transition-transform duration-700"
                style={{
                  transform: mapZoom === "vehicle" ? `scale(1.4) translate(${400 - vehicleX}px, ${225 - vehicleY}px)` : "none",
                  transformOrigin: "center center",
                }}
              >
                <defs>
                  <linearGradient id="rockiesGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0B1A14" />
                    <stop offset="50%" stopColor="#0E231B" />
                    <stop offset="100%" stopColor="#081510" />
                  </linearGradient>

                  <linearGradient id="routeProgressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#C5A880" />
                    <stop offset="100%" stopColor="#F5D061" />
                  </linearGradient>

                  <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Background Terrain */}
                <rect width="800" height="450" fill="url(#rockiesGradient)" rx="16" />

                {/* Mountain Ridge Outlines */}
                <path
                  d="M 50,420 Q 150,180 250,380 T 450,220 T 650,340 T 780,180"
                  fill="none"
                  stroke="#16382C"
                  strokeWidth="2.5"
                  strokeDasharray="4 4"
                  opacity="0.5"
                />
                <path
                  d="M 20,380 Q 180,90 320,300 T 520,110 T 720,260"
                  fill="none"
                  stroke="#1E4D3C"
                  strokeWidth="1.5"
                  opacity="0.4"
                />

                {/* Peak Labels */}
                <text x="180" y="85" fill="#4E7A68" fontSize="11" fontFamily="sans-serif" letterSpacing="2">
                  ▲ MT. RUNDLE (2,949M)
                </text>
                <text x="460" y="70" fill="#4E7A68" fontSize="11" fontFamily="sans-serif" letterSpacing="2">
                  ▲ CASTLE MOUNTAIN (2,766M)
                </text>
                <text x="630" y="110" fill="#4E7A68" fontSize="11" fontFamily="sans-serif" letterSpacing="2">
                  ▲ MT. TEMPLE (3,544M)
                </text>

                {/* Road Corridor */}
                <path
                  d="M 120,370 C 220,340 320,290 420,240 S 600,160 700,120"
                  fill="none"
                  stroke="#1A3B30"
                  strokeWidth="8"
                  strokeLinecap="round"
                />

                {/* Driven Path Highlight */}
                <path
                  d={`M 120,370 Q ${vehicleX * 0.7 + 60},${vehicleY * 0.7 + 100} ${vehicleX},${vehicleY}`}
                  fill="none"
                  stroke="url(#routeProgressGradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  filter="url(#goldGlow)"
                />

                {/* Static Waypoints */}
                <g transform="translate(120, 370)">
                  <circle r="5" fill="#C5A880" />
                  <text x="-15" y="20" fill="#88A397" fontSize="10" fontWeight="bold">
                    Canmore Fleet Depot
                  </text>
                </g>

                {/* Target Pickup Location */}
                <g transform={`translate(${targetX}, ${targetY})`}>
                  <circle r="14" fill="#C5A880" fillOpacity="0.2" className="animate-ping" />
                  <circle r="8" fill="#C5A880" />
                  <circle r="4" fill="#07130F" />
                  <text
                    x="15"
                    y="4"
                    fill="#F5D061"
                    fontSize="11"
                    fontWeight="bold"
                    filter="drop-shadow(0 1px 2px rgba(0,0,0,0.8))"
                  >
                    ★ {telemetry.pickupStopName}
                  </text>
                </g>

                {/* Destination */}
                <g transform="translate(700, 120)">
                  <circle r="6" fill="#3B82F6" />
                  <circle r="2" fill="#FFFFFF" />
                  <text x="-30" y="-12" fill="#93C5FD" fontSize="10" fontWeight="bold">
                    Moraine Lake &amp; Ten Peaks
                  </text>
                </g>

                {/* LIVE MOVING VEHICLE MARKER */}
                <g
                  transform={`translate(${vehicleX}, ${vehicleY})`}
                  className="transition-all duration-1000 ease-out cursor-pointer"
                >
                  <circle r="22" fill="#10B981" fillOpacity="0.15" className="animate-ping" />
                  <circle r="14" fill="#10B981" fillOpacity="0.3" />
                  <circle r="11" fill="#0A1F18" stroke="#10B981" strokeWidth="2.5" />

                  {/* Heading Arrow */}
                  <g transform={`rotate(${telemetry.vehicleCoordinates.heading})`}>
                    <polygon points="0,-7 5,6 0,3 -5,6" fill="#F5D061" />
                  </g>

                  {/* Speed Badge */}
                  <rect
                    x="-32"
                    y="-30"
                    width="64"
                    height="18"
                    rx="9"
                    fill="#050C0A"
                    stroke="#10B981"
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="-18"
                    fill="#34D399"
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {telemetry.vehicleCoordinates.speedKmh} KM/H
                  </text>
                </g>
              </svg>
            </div>

            {/* Map Telemetry Footer */}
            <div className="bg-[#07130F]/95 border-t border-forest-800/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 text-slate-300">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span>Live Sprinter #4</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-gold-400" />
                  <span>Your Pickup Point</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                <span>LAT: {telemetry.vehicleCoordinates.latitude.toFixed(4)}°N</span>
                <span>LNG: {Math.abs(telemetry.vehicleCoordinates.longitude).toFixed(4)}°W</span>
                <span>UPDATED: {lastUpdated.toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          {/* Pickup Instructions Box */}
          <div className="bg-[#0C1E18] rounded-2xl p-5 border border-forest-800/60 shadow-xl space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-gold-500/10 border border-gold-500/30 text-gold-400 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Pickup Location &amp; Instructions
                  </h3>
                  <span className="text-xs font-mono text-gold-400 font-bold">
                    {telemetry.pickupTime}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-200 mt-0.5">
                  {telemetry.pickupStopName}
                </p>
                <p className="text-xs text-slate-400">
                  {telemetry.pickupAddress}
                </p>
                <div className="mt-3 p-3 rounded-xl bg-forest-950/60 border border-forest-800/40 text-xs text-slate-300 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Guest Tip:</strong> {telemetry.pickupInstructions}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Guide Profile, Vehicle Specs, Route Steps (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">

          {/* Guide Card */}
          <div className="bg-[#0C1E18] rounded-2xl p-6 border border-forest-800/60 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-gold-400 font-bold">
                Your Certified Guide &amp; Chauffeur
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-800/40">
                <ShieldCheck className="w-3.5 h-3.5" />
                Parks Canada Certified
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-gold-500/40 shadow-md shrink-0">
                <Image
                  src={telemetry.driverPhoto}
                  alt={telemetry.driverName}
                  fill
                  className="object-cover"
                />
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white font-serif tracking-tight truncate">
                  {telemetry.driverName}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lead Naturalist &amp; Commercial Alpine Driver
                </p>
                <p className="text-xs text-gold-300 font-mono mt-1 flex items-center gap-1">
                  <span>★ 4.98</span>
                  <span className="text-slate-500">•</span>
                  <span>1,420+ Rockies Expeditions</span>
                </p>
              </div>
            </div>

            {/* Direct Contact Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <a
                href={telemetry.driverPhone ? `tel:${telemetry.driverPhone.replace(/[^\d+]/g, "")}` : "tel:+18257349456"}
                className="py-2.5 px-3 rounded-xl bg-forest-900 hover:bg-forest-800 border border-forest-700/60 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Call Chauffeur</span>
              </a>

              <a
                href={`https://wa.me/18257349456?text=Hi%20Vista%20Chase,%20I'm%20tracking%20my%20shuttle%20for%20booking%20${telemetry.bookingReference}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>WhatsApp Concierge</span>
              </a>
            </div>
          </div>

          {/* Vehicle Specs */}
          <div className="bg-[#0C1E18] rounded-2xl p-6 border border-forest-800/60 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-gold-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Assigned Vehicle
                </h3>
              </div>
              <span className="font-mono text-xs font-bold text-gold-300 px-2 py-0.5 rounded bg-gold-950/60 border border-gold-800/40">
                {telemetry.licensePlate}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-forest-950/80 border border-forest-800/60 space-y-2">
              <p className="text-sm font-bold text-white">
                {telemetry.vehicleName}
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
                <div className="flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-gold-400" />
                  <span>Starlink Wi-Fi Onboard</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-gold-400" />
                  <span>Climate Controlled Cabin</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-gold-400" />
                  <span>Commercial Inspection Pass</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-gold-400" />
                  <span>Panorama Glass Roof</span>
                </div>
              </div>
            </div>
          </div>

          {/* Route Progression Timeline */}
          <div className="bg-[#0C1E18] rounded-2xl p-6 border border-forest-800/60 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Route Progression
            </h3>

            <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-forest-800">
              {telemetry.routeWaypoints.map((wp, idx) => (
                <div key={idx} className="relative flex items-start gap-4 text-xs">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 text-[10px] font-bold ${
                      wp.isCurrent
                        ? "bg-gold-500 text-forest-950 ring-4 ring-gold-500/20 animate-pulse"
                        : wp.isPassed
                        ? "bg-emerald-600 text-white"
                        : "bg-forest-900 text-slate-400 border border-forest-700"
                    }`}
                  >
                    {wp.isPassed ? "✓" : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p
                      className={`font-semibold ${
                        wp.isCurrent
                          ? "text-gold-300"
                          : wp.isPassed
                          ? "text-slate-300"
                          : "text-slate-500"
                      }`}
                    >
                      {wp.name}
                    </p>
                    {wp.isCurrent && (
                      <span className="text-[10px] text-gold-400 font-mono block mt-0.5">
                        Current Position / Proximity
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Canadian Rockies Alpine Conditions */}
          <div className="bg-[#0C1E18] rounded-2xl p-5 border border-forest-800/60 shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 uppercase tracking-wider">
                Destination Weather
              </span>
              <span className="text-emerald-400 font-semibold">Conditions Optimal</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-forest-950/60 border border-forest-800/40">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Lake Louise / Moraine</span>
                <span className="text-base font-bold text-white">14°C • Crystal Clear</span>
              </div>
              <div className="p-3 rounded-xl bg-forest-950/60 border border-forest-800/40">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Alpine Wildlife Activity</span>
                <span className="text-base font-bold text-gold-400">High • Elk / Bears</span>
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-forest-800/60 bg-[#050C0A] py-6 px-4 text-center text-xs text-slate-500">
        <p>© 2026 Vista Chase Canadian Rockies. All rights reserved. Parks Canada Commercial License #PC-BANFF-2026-VC.</p>
        <p className="mt-1">For urgent trip adjustments or flight delays, contact 24/7 Dispatch at +1 (825) 734-9456.</p>
      </footer>
    </div>
  );
}
