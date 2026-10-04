import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getBookingByReference } from "@/lib/api/catalog";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  ShieldCheck,
  Printer,
  Compass,
  Phone,
  QrCode,
  CheckCircle2,
  Navigation,
  ArrowUpRight,
} from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata({
  params: paramsPromise,
}: {
  params: Promise<{ ref: string }>;
}): Promise<Metadata> {
  const params = await paramsPromise;
  return {
    title: `Digital Boarding Voucher #${params.ref} | Vista Chase`,
    description: "Official Vista Chase electronic boarding pass and confirmed ticket.",
  };
}

export default async function VoucherPage({
  params: paramsPromise,
}: {
  params: Promise<{ ref: string }>;
}) {
  const params = await paramsPromise;
  const booking = await getBookingByReference(params.ref);
  if (!booking) notFound();

  const departure = booking.tourDeparture;
  const tourTitle = departure.tour?.title || departure.shuttleRoute?.name || "Canadian Rockies Tour";

  return (
    <div className="min-h-screen bg-slate-100 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      {/* Action Bar */}
      <div className="max-w-2xl w-full mb-6 flex justify-between items-center text-xs">
        <Link href="/" className="font-semibold text-slate-600 hover:text-forest-950">
          ← Return to Vista Chase
        </Link>
        <div className="flex gap-3">
          <Link
            href="/pickup-finder"
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Pickup Directions
          </Link>
          <a
            href="tel:+18257349456"
            className="px-3 py-1.5 rounded-lg bg-forest-900 text-white font-semibold hover:bg-forest-800"
          >
            Emergency Dispatch Line
          </a>
        </div>
      </div>

      {/* Main Boarding Pass Card */}
      <div className="max-w-2xl w-full bg-white rounded-3xl border-2 border-forest-900/10 shadow-2xl overflow-hidden">
        {/* Pass Header */}
        <div className="bg-forest-950 text-white p-6 sm:p-8 flex items-center justify-between border-b border-gold-400/30">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-forest-900 text-gold-300 text-[11px] font-bold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-gold-400" />
              <span>Official Commercial Boarding Pass</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-white">{tourTitle}</h1>
            <p className="text-xs text-slate-300 mt-1">Parks Canada Commercial Permit Authorized</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">STATUS</span>
            <p className="text-sm font-bold text-emerald-400 flex items-center gap-1 justify-end">
              <CheckCircle2 className="w-4 h-4" />
              <span>CONFIRMED</span>
            </p>
          </div>
        </div>

        {/* Voucher Barcode & References */}
        <div className="bg-forest-900/10 p-6 flex flex-col sm:flex-row items-center justify-between gap-6 border-b border-slate-200">
          <div className="space-y-1 text-center sm:text-left">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Booking Reference</span>
            <p className="text-2xl font-bold font-mono text-forest-950">{booking.bookingReference}</p>
            <p className="text-xs text-slate-600">Voucher Code: <strong className="font-mono text-gold-600">{booking.voucherCode}</strong></p>
          </div>

          {booking.qrCodeUrl && (
            <div className="p-3 bg-white border border-slate-300 rounded-2xl shadow-sm text-center">
              <Image
                src={booking.qrCodeUrl}
                alt="Boarding Pass QR Code"
                width={120}
                height={120}
                className="rounded-lg mx-auto"
              />
              <span className="text-[10px] font-mono text-slate-500 mt-1 block">Scan at Vehicle</span>
            </div>
          )}
        </div>

        {/* Passenger & Schedule Details */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Live Shuttle Tracking CTA */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-forest-950 to-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-gold-400/40 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-500/20 border border-gold-400/40 flex items-center justify-center text-gold-400 shrink-0">
                <Navigation className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-widest font-bold text-gold-400">Live GPS Tracking</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Track your assigned shuttle vehicle, driver GPS location, and real-time ETA.
                </p>
              </div>
            </div>
            <Link
              href={`/track/${booking.trackingToken || booking.bookingReference}`}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-forest-950 font-bold text-xs transition-colors flex items-center gap-2 shadow-glow"
            >
              <span>Track Shuttle Live</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block uppercase font-medium">Lead Guest</span>
              <p className="font-bold text-forest-950 mt-0.5">{booking.customerName}</p>
            </div>
            <div>
              <span className="text-slate-500 block uppercase font-medium">Party Size</span>
              <p className="font-bold text-forest-950 mt-0.5">{booking.totalSeats} Passengers</p>
            </div>
            <div>
              <span className="text-slate-500 block uppercase font-medium">Date</span>
              <p className="font-bold text-forest-950 mt-0.5">{departure.date}</p>
            </div>
            <div>
              <span className="text-slate-500 block uppercase font-medium">Departure Time</span>
              <p className="font-bold text-emerald-800 text-sm mt-0.5">{departure.departureTime}</p>
            </div>
          </div>

          {/* Pickup Instructions Box */}
          <div className="p-5 rounded-2xl bg-forest-50 border border-gold-400/40 space-y-2">
            <span className="text-xs uppercase font-bold text-forest-950 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-700" />
              <span>Your Designated Pickup Location</span>
            </span>
            <p className="text-sm font-bold text-forest-900">
              {booking.pickupStop?.name || booking.pickupCustomText || "Banff Central Train Station"} ({booking.pickupStop?.town || "Banff"})
            </p>
            {booking.pickupStop?.instructions && (
              <p className="text-xs text-slate-700 leading-relaxed">
                <strong>Meeting Point:</strong> {booking.pickupStop.instructions}
              </p>
            )}
            <p className="text-[11px] text-amber-800 pt-1">
              ⚠️ Please arrive at the meeting point <strong>10 minutes prior</strong> ({departure.departureTime}). Vehicles depart promptly to meet Parks Canada checkpoint schedules.
            </p>
          </div>

          {/* Inclusions & Addons */}
          {booking.items.length > 0 && (
            <div className="space-y-2 text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider">Booked Add-Ons</span>
              <ul className="space-y-1 text-slate-600">
                {booking.items.map((item) => (
                  <li key={item.id} className="flex justify-between border-b border-slate-100 py-1">
                    <span>{item.name} (Qty: {item.quantity})</span>
                    <span className="font-semibold">${(item.price * item.quantity).toFixed(2)} CAD</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Emergency Contact */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-700" />
              <span>24/7 Rockies Dispatch: +1 (825) 734-9456</span>
            </div>
            <p>121 Bow Meadows Crescent #110, Canmore, AB</p>
          </div>
        </div>
      </div>
    </div>
  );
}
