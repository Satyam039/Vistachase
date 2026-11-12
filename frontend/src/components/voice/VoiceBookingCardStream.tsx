"use client";

// Rich cards the concierge attaches to a reply (departures, pickups, a seat hold, a confirmed
// booking, live tracking), styled like the attachments in ChatGPT / Claude / Gemini: light,
// quiet cards inside the conversation, with real buttons for choices. Only data the API sent
// is shown (no placeholder drivers or vehicles).

import { useState } from "react";
import Link from "next/link";
import { moneyExact } from "@/lib/pricing";
import { ArrowRight, Calendar, Car, CheckCircle2, Clock, MapPin, ShieldCheck, Ticket } from "lucide-react";
import { ConciergeSeatMap, type SeatInfo } from "./ConciergeSeatMap";
import { ConciergeCheckout } from "./ConciergeCheckout";
import { ConciergeTourCards, ConciergeTourDetail, type TourCardData, type TourDetailData } from "./ConciergeTourCards";

export interface VoiceCardData {
  type?: "availability" | "pickups" | "hold" | "confirmed" | "tracking" | "tour" | "tours" | "choices" | "seat_map";
  /** "tours": recommended tours as cards. */
  tours?: TourCardData[];
  /** "tour": one tour opened from the knowledgebase. */
  tourDetail?: TourDetailData;
  /** "choices": quick answers to the concierge's question. */
  options?: string[];
  vehicleType?: "sprinter_12" | "suv_7";
  vehicleName?: string;
  capacity?: number;
  legroom?: string;
  amenities?: string[];
  seats?: SeatInfo[];
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
  onSelectSeats?: (seats: string[]) => void;
  /** A booking made in the chat was confirmed. */
  onBooked?: (bookingReference: string) => void;
  /** Sends a message as the guest (a tap on a tour card or a quick answer). */
  onAsk?: (text: string) => void;
}

/** The in-chat checkout's starting point from a concierge hold's checkout link (/book?…). */
function holdFromCheckoutUrl(url?: string) {
  if (!url) return null;
  try {
    const q = new URL(url, "https://chat.local").searchParams;
    const departureId = q.get("departureId");
    if (!departureId) return null;
    return { departureId, holdToken: q.get("holdToken") ?? undefined, pickupStopId: q.get("pickupStopId") ?? undefined, guests: Number(q.get("guests")) || undefined };
  } catch {
    return null;
  }
}

const CARD = "rounded-none border border-obsidian-900/10 bg-white p-4";
const CARD_TITLE = "mb-3 flex items-center gap-2 text-sm text-slate-700";
const CHOICE =
  "flex w-full items-center justify-between gap-3 rounded-xl border border-obsidian-900/10 px-3.5 py-3 text-left transition-colors hover:border-ocean-600/50 hover:bg-ocean-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ocean-600";

const shortDate = (d?: string) => {
  if (!d) return "";
  const parsed = new Date(`${d}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
};

export function VoiceBookingCardStream({ data, checkoutUrl, hasSafetyRefusal, onSelectPickup, onSelectSeats, onBooked, onAsk }: VoiceBookingCardStreamProps) {
  // "Choose" on a departure opens the checkout right here in the chat (owner, 2026-11-11: no /book page).
  const [chosen, setChosen] = useState<NonNullable<VoiceCardData["departures"]>[number] | null>(null);
  const held = holdFromCheckoutUrl(checkoutUrl);
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
        </div>
      )}

      {data?.type === "choices" && data.options && data.options.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick answers">
          {data.options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => onAsk?.(o)}
              className="inline-flex h-10 items-center rounded-full border border-obsidian-900/15 bg-white px-4 text-sm text-obsidian-900 hover:border-ocean-600/50 hover:bg-ocean-50"
            >
              {o}
            </button>
          ))}
        </div>
      )}

      {data?.type === "tours" && data.tours && data.tours.length > 0 && (
        <ConciergeTourCards tours={data.tours} onOpen={(t) => onAsk?.(`Show me the tour: ${t.name}`)} />
      )}

      {data?.type === "tour" && data.tourDetail && (
        <ConciergeTourDetail
          tour={data.tourDetail}
          onAsk={(text) => onAsk?.(text)}
          onBook={(d) =>
            setChosen({ id: d.id, title: data.tourDetail!.name, date: d.date, departureTime: d.time, price: d.price, currency: "CAD", availableSeats: d.seats })
          }
        />
      )}

      {data?.type === "availability" && data.departures && data.departures.length > 0 && (
        <div className={CARD}>
          <p className={CARD_TITLE}>
            <Calendar className="h-4 w-4 text-ocean-600" aria-hidden="true" />
            Available departures
          </p>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
            {data.departures.map((dep) => (
              <li key={dep.id}>
                <button type="button" onClick={() => setChosen(dep)} className={CHOICE} aria-pressed={chosen?.id === dep.id}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-obsidian-900">{dep.title || "Departure"}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {shortDate(dep.date)} · {dep.departureTime}
                      <span className="text-emerald-700">{dep.availableSeats > 0 ? "Available" : "Sold out"}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm text-obsidian-900">
                      {moneyExact(dep.price)}
                    </span>
                    <span className="text-xs text-ocean-700">{chosen?.id === dep.id ? "Selected" : "Book"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {chosen && !held && (
        <ConciergeCheckout key={chosen.id} departureId={chosen.id} title={chosen.title} onConfirmed={onBooked} />
      )}

      {data?.type === "pickups" && data.stops && data.stops.length > 0 && (
        <div className={CARD}>
          <p className={CARD_TITLE}>
            <MapPin className="h-4 w-4 text-ocean-600" aria-hidden="true" />
            Pickup stops near you
          </p>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
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

      {held && !hasSafetyRefusal && (
        <ConciergeCheckout
          departureId={held.departureId}
          holdToken={held.holdToken}
          pickupStopId={held.pickupStopId}
          guests={held.guests}
          title={data?.departure?.title}
          onConfirmed={onBooked}
        />
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
            <Link href="/pickup-finder" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-obsidian-900/10 px-4 text-sm text-obsidian-900 hover:bg-obsidian-50">
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

      {data?.type === "seat_map" && (
        <div className="mt-2 w-full">
          <ConciergeSeatMap
            vehicleType={data.vehicleType}
            vehicleName={data.vehicleName}
            capacity={data.capacity}
            legroom={data.legroom}
            amenities={data.amenities}
            seats={data.seats}
            onSelectSeats={onSelectSeats}
          />
        </div>
      )}
    </div>
  );
}
