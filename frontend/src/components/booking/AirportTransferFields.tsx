"use client";

// Airport transfer add-on for private tours (owner, 2026-10-29): the guest ticks it under Guests,
// and checkout asks for their flight times, then where the transfer is from and where it goes
// (owner, 2026-10-31), and where the guest stays.
//
// Owner, 2026-11-17: the guest chooses Arrival only (airport -> hotel), Departure only (hotel ->
// airport) or Round trip (airport -> hotel -> airport); a round trip is two transfers. The price is
// per transfer, one way, by where the guest stays and the group size (owner's table, 2026-11-18):
// up to 6 guests CAD 364 Banff/Canmore, CAD 445 Lake Louise; 7 to 12 guests CAD 850 / CAD 895 (Banff/Canmore up to 14 from 2026-11-24). The prices come from the server (GET /api/bookings/airport-transfer), which prices
// the booking again with the same table (backend modules/bookings/airport-transfer.ts).

import { useEffect, useState } from "react";
import { Plane } from "lucide-react";

export type AirportArea = "BANFF" | "CANMORE" | "LAKE_LOUISE";
export type AirportTransferType = "ARRIVAL" | "DEPARTURE" | "ROUND_TRIP";

export interface AirportTransferValue {
  /** Arrival only, departure only or round trip; "" until the guest chooses. */
  type: "" | AirportTransferType;
  arrivalDate: string;
  arrivalTime: string;
  departureDate: string;
  departureTime: string;
  /** Arrival: where we pick the guest up, e.g. Calgary Airport (YYC). */
  from: string;
  /** Arrival: where we take them, e.g. their hotel. */
  to: string;
  /** Departure: where we pick the guest up, e.g. their hotel (owner, 2026-11-19: independent of the arrival). */
  departureFrom: string;
  /** Departure: where we take them, e.g. Calgary Airport (YYC). */
  departureTo: string;
  /** Where the guest stays: sets the price. */
  area: "" | AirportArea;
  /** Airline and flight number(s), optional (owner, 2026-11-25: flight details to confirm each service). */
  flightNumbers?: string;
}

export const EMPTY_AIRPORT_TRANSFER: AirportTransferValue = {
  type: "",
  arrivalDate: "",
  arrivalTime: "",
  departureDate: "",
  departureTime: "",
  from: "",
  to: "",
  departureFrom: "",
  departureTo: "",
  area: "",
};

export const AIRPORT_TRANSFER_PRICE_NOTE = "Price confirmed by our team before your trip";

/** The server's price table (dollars). */
export interface AirportTransferPrices {
  currency: string;
  minGuests: number;
  maxGuests: number;
  smallGroupMax: number;
  /** maxGuests: the area's largest priced group (Banff/Canmore 14, Lake Louise 12; owner 2026-11-24). */
  areas: { area: AirportArea; label: string; perTransfer: number; perTransferSmallGroup: number | null; maxGuests?: number }[];
}

const TYPES: { id: AirportTransferType; label: string; route: string }[] = [
  { id: "ARRIVAL", label: "Arrival transfer only", route: "Airport → hotel / accommodation" },
  { id: "DEPARTURE", label: "Departure transfer only", route: "Hotel / accommodation → airport" },
  { id: "ROUND_TRIP", label: "Round-trip transfer", route: "Airport → hotel → airport" },
];

const AREAS: { id: AirportArea; label: string }[] = [
  { id: "BANFF", label: "Banff" },
  { id: "CANMORE", label: "Canmore" },
  { id: "LAKE_LOUISE", label: "Lake Louise" },
];

const needsArrival = (type: AirportTransferValue["type"]) => type === "ARRIVAL" || type === "ROUND_TRIP";
const needsDeparture = (type: AirportTransferValue["type"]) => type === "DEPARTURE" || type === "ROUND_TRIP";

let pricesRequest: Promise<AirportTransferPrices | null> | null = null;
function loadPrices(): Promise<AirportTransferPrices | null> {
  pricesRequest ??= fetch("/api/bookings/airport-transfer")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.success ? (d.prices as AirportTransferPrices) : null))
    .catch(() => null)
    .then((p) => {
      if (!p) pricesRequest = null; // try again next time
      return p;
    });
  return pricesRequest;
}

/** The server's airport transfer prices (null while loading or if they couldn't be read). */
export function useAirportTransferPrices(): AirportTransferPrices | null {
  const [prices, setPrices] = useState<AirportTransferPrices | null>(null);
  useEffect(() => {
    let live = true;
    void loadPrices().then((p) => live && setPrices(p));
    return () => {
      live = false;
    };
  }, []);
  return prices;
}

const cad = (n: number) => `CAD $${n.toLocaleString("en-CA", { maximumFractionDigits: 2 })}`;

export interface AirportTransferQuote {
  transfers: number;
  /** One transfer, one way, in dollars. */
  unit: number;
  /** All transfers, in dollars. */
  total: number;
}

/** Same rule as the server: per transfer by area; a round trip is two; 2 to 12 guests. */
export function airportTransferQuote(t: Pick<AirportTransferValue, "type" | "area">, guests: number, prices: AirportTransferPrices | null): AirportTransferQuote | null {
  if (!prices || !t.type || !t.area || guests < prices.minGuests || guests > prices.maxGuests) return null;
  const row = prices.areas.find((a) => a.area === t.area);
  if (!row || guests > (row.maxGuests ?? prices.maxGuests)) return null;
  const unit = (guests <= prices.smallGroupMax ? row.perTransferSmallGroup : null) ?? row.perTransfer;
  const transfers = t.type === "ROUND_TRIP" ? 2 : 1;
  return { transfers, unit, total: unit * transfers };
}

/** The transfer's total in dollars (null: no price yet). */
export function airportTransferPrice(t: Pick<AirportTransferValue, "type" | "area">, guests: number, prices: AirportTransferPrices | null): number | null {
  return airportTransferQuote(t, guests, prices)?.total ?? null;
}

/** "Round trip (2 × CAD $850)" for the order summary. */
export function airportTransferSummaryLabel(t: Pick<AirportTransferValue, "type">, quote: AirportTransferQuote | null): string {
  const kind = t.type === "ROUND_TRIP" ? "round trip" : t.type === "DEPARTURE" ? "departure only" : t.type === "ARRIVAL" ? "arrival only" : "";
  if (!quote) return `Airport transfer${kind ? `, ${kind}` : ""}`;
  return `Airport transfer, ${kind} (${quote.transfers} × ${cad(quote.unit)})`;
}

/**
 * What the booking API takes: only the times and places the chosen transfer needs. The server's
 * from/to is the first leg (the departure's own places for a departure only); a round trip also
 * sends its departure places.
 */
export function airportTransferPayload(t: AirportTransferValue) {
  const departingOnly = t.type === "DEPARTURE";
  return {
    type: t.type || undefined,
    ...(needsArrival(t.type) ? { arrivalDate: t.arrivalDate, arrivalTime: t.arrivalTime } : {}),
    ...(needsDeparture(t.type) ? { departureDate: t.departureDate, departureTime: t.departureTime } : {}),
    from: (departingOnly ? t.departureFrom : t.from).trim(),
    to: (departingOnly ? t.departureTo : t.to).trim(),
    ...(t.type === "ROUND_TRIP" ? { departureFrom: t.departureFrom.trim(), departureTo: t.departureTo.trim() } : {}),
    area: t.area || undefined,
    ...(t.flightNumbers?.trim() ? { flightNumbers: t.flightNumbers.trim().slice(0, 80) } : {}),
  };
}

/** What's missing or wrong, if anything. */
export function airportTransferError(t: AirportTransferValue): string | null {
  if (!t.type) return "Choose arrival only, departure only or a round trip.";
  if (needsArrival(t.type) && (!t.arrivalDate || !t.arrivalTime)) return "Enter your airport arrival date and time.";
  if (needsDeparture(t.type) && (!t.departureDate || !t.departureTime)) return "Enter your airport departure date and time.";
  if (t.type === "ROUND_TRIP" && `${t.departureDate} ${t.departureTime}` <= `${t.arrivalDate} ${t.arrivalTime}`) {
    return "Your departure must be after your arrival.";
  }
  if (needsArrival(t.type) && (t.from.trim().length < 2 || t.to.trim().length < 2)) return "Enter where your arrival transfer is from and where it goes.";
  if (needsDeparture(t.type) && (t.departureFrom.trim().length < 2 || t.departureTo.trim().length < 2)) return "Enter where your departure transfer is from and where it goes.";
  if (!t.area) return "Choose where you're staying: it sets the transfer price.";
  return null;
}

/** "from CAD $364 per transfer" from the server's prices. */
function fromPriceText(prices: AirportTransferPrices | null): string {
  if (!prices || prices.areas.length === 0) return "priced per transfer";
  const lowest = Math.min(...prices.areas.map((a) => a.perTransferSmallGroup ?? a.perTransfer));
  return `from ${cad(lowest)} per transfer (one way)`;
}

/** The add-on tick box (tour page booking panel and checkout). */
export function AirportTransferToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const prices = useAirportTransferPrices();
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-4 text-sm ${checked ? "border-ocean-500 ring-1 ring-ocean-500" : "border-slate-200"}`}
    >
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-ocean-700" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-medium text-obsidian-900">
          <Plane className="h-4 w-4 text-ocean-700" aria-hidden="true" />
          Add airport transfer
        </span>
        <span className="mt-0.5 block text-xs text-slate-600">
          Calgary Airport (YYC): arrival, departure or round trip, {fromPriceText(prices)}, added to your total.
        </span>
      </span>
    </label>
  );
}

/** The price breakdown shown under the transfer details. */
export function AirportTransferBreakdown({
  value,
  guests,
  prices,
  areas,
}: {
  value: AirportTransferValue;
  guests: number;
  prices: AirportTransferPrices | null;
  /** Only these areas are offered (Three-Day: Banff and Canmore). */
  areas?: readonly AirportArea[];
}) {
  const shown = prices ? prices.areas.filter((a) => !areas || areas.includes(a.area)) : [];
  const quote = airportTransferQuote(value, guests, prices);
  const area = AREAS.find((a) => a.id === value.area)?.label;
  const type = TYPES.find((t) => t.id === value.type);
  let body: React.ReactNode;
  if (!prices) body = <p>Loading transfer prices…</p>;
  else if (guests > prices.maxGuests) body = <p>{AIRPORT_TRANSFER_PRICE_NOTE} (groups over {prices.maxGuests}).</p>;
  else if (!value.type || !value.area)
    body = (
      <ul className="space-y-0.5">
        {shown.map((a) => (
          <li key={a.area}>
            Calgary Airport ↔ {a.label}:{" "}
            {a.perTransferSmallGroup != null
              ? `${cad(a.perTransferSmallGroup)} up to ${prices.smallGroupMax} guests, ${cad(a.perTransfer)} for ${prices.smallGroupMax + 1} to ${a.maxGuests ?? prices.maxGuests} guests`
              : cad(a.perTransfer)}{" "}
            per transfer, one way
          </li>
        ))}
        <li className="pt-1 text-slate-600">Choose your transfer and where you&apos;re staying to see your price. A round trip is two transfers.</li>
      </ul>
    );
  else if (quote)
    body = (
      <dl className="space-y-1">
        <div className="flex justify-between gap-4">
          <dt>
            {type?.label} · Calgary Airport ↔ {area} · {guests <= prices.smallGroupMax ? `up to ${prices.smallGroupMax}` : `${prices.smallGroupMax + 1} to ${prices.areas.find((a) => a.area === value.area)?.maxGuests ?? prices.maxGuests}`} guests
          </dt>
          <dd className="tabular-nums">
            {quote.transfers} × {cad(quote.unit)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-slate-200 pt-1 font-medium text-obsidian-900">
          <dt>Airport transfer total</dt>
          <dd className="tabular-nums">{cad(quote.total)}</dd>
        </div>
      </dl>
    );
  else body = <p>{AIRPORT_TRANSFER_PRICE_NOTE}</p>;
  return (
    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200" aria-live="polite">
      <p className="mb-1.5 font-medium text-obsidian-900">Airport transfer price</p>
      {body}
      <p className="mt-1.5 text-xs text-slate-600">Private vehicle for your group, added to your total and paid with your tour.</p>
    </div>
  );
}

const input =
  "mt-1 block h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-obsidian-900 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/30";

/** Transfer type, the flight fields it needs, where from/to, where the guest stays and the price. */
export function AirportTransferDetails({
  value,
  onChange,
  error,
  minDate,
  guests,
  areas,
  areaNote,
}: {
  value: AirportTransferValue;
  onChange: (value: AirportTransferValue) => void;
  error?: string;
  minDate?: string;
  /** Party size, for the price. */
  guests: number;
  /** Only these "Where you're staying" areas (Three-Day, owner 2026-11-24: Banff and Canmore). */
  areas?: readonly AirportArea[];
  /** Under the areas, e.g. how to ask for a Lake Louise transfer. */
  areaNote?: string;
}) {
  const prices = useAirportTransferPrices();
  const set = (key: keyof AirportTransferValue) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [key]: e.target.value });
  const field = (id: keyof AirportTransferValue, label: string, type: "date" | "time", min?: string) => (
    <label className="block text-sm text-obsidian-900" htmlFor={`airport-${id}`}>
      {label}
      <input
        id={`airport-${id}`}
        type={type}
        required
        min={min}
        value={value[id]}
        onChange={set(id)}
        aria-invalid={Boolean(error && !value[id])}
        aria-describedby={error ? "airport-transfer-error" : undefined}
        className={input}
      />
    </label>
  );
  const place = (id: "from" | "to" | "departureFrom" | "departureTo", label: string, placeholder: string) => (
    <label className="block text-sm text-obsidian-900" htmlFor={`airport-${id}`}>
      {label}
      <input
        id={`airport-${id}`}
        type="text"
        required
        maxLength={160}
        autoComplete="off"
        placeholder={placeholder}
        value={value[id]}
        onChange={set(id)}
        aria-invalid={Boolean(error && value[id].trim().length < 2)}
        aria-describedby={error ? "airport-transfer-error" : undefined}
        className={input}
      />
    </label>
  );
  return (
    <fieldset className="space-y-3">
      <fieldset>
        <legend className="text-sm font-medium text-obsidian-900">Which transfer do you need?</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-3">
          {TYPES.map((t) => (
            <label
              key={t.id}
              className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${value.type === t.id ? "border-ocean-500 ring-1 ring-ocean-500" : "border-slate-300"}`}
            >
              <input
                type="radio"
                name="airport-type"
                className="mt-0.5 h-4 w-4 shrink-0 accent-ocean-700"
                checked={value.type === t.id}
                onChange={() => onChange({ ...value, type: t.id })}
              />
              <span>
                <span className="block text-obsidian-900">{t.label}</span>
                <span className="block text-xs text-slate-600">
                  {t.route}
                  {t.id === "ROUND_TRIP" ? " (2 transfers)" : ""}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {value.type && (
        <>
          {/* Owner, 2026-11-19: each flight's date and time, then its own From / Where fields right below. */}
          {needsArrival(value.type) && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-obsidian-900">Airport arrival</legend>
              <div className="grid grid-cols-2 gap-3">
                {field("arrivalDate", "Airport arrival date", "date", minDate)}
                {field("arrivalTime", "Arrival time", "time")}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {place("from", "From", "e.g. Calgary Airport (YYC)")}
                {place("to", "Where", "e.g. your hotel in Banff")}
              </div>
            </fieldset>
          )}
          {needsDeparture(value.type) && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-obsidian-900">Airport departure</legend>
              <div className="grid grid-cols-2 gap-3">
                {field("departureDate", "Airport departure date", "date", (needsArrival(value.type) && value.arrivalDate) || minDate)}
                {field("departureTime", "Departure time", "time")}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {place("departureFrom", "From", "e.g. your hotel in Banff")}
                {place("departureTo", "Where to", "e.g. Calgary Airport (YYC)")}
              </div>
            </fieldset>
          )}
        </>
      )}
      {value.type && (
        <label className="block text-sm text-obsidian-900" htmlFor="airport-flightNumbers">
          Flight number(s) <span className="text-slate-600">(optional)</span>
          <input
            id="airport-flightNumbers"
            type="text"
            maxLength={80}
            autoComplete="off"
            placeholder={value.type === "ROUND_TRIP" ? "e.g. AC 123 arriving, WS 456 departing" : "e.g. AC 123"}
            value={value.flightNumbers ?? ""}
            onChange={(e) => onChange({ ...value, flightNumbers: e.target.value })}
            className={input}
          />
        </label>
      )}
      <fieldset>
        <legend className="text-sm text-obsidian-900">Where you&apos;re staying</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {AREAS.filter((a) => !areas || areas.includes(a.id)).map((a) => (
            <label
              key={a.id}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${value.area === a.id ? "border-ocean-500 ring-1 ring-ocean-500" : "border-slate-300"}`}
            >
              <input
                type="radio"
                name="airport-area"
                className="h-4 w-4 accent-ocean-700"
                checked={value.area === a.id}
                onChange={() => onChange({ ...value, area: a.id })}
              />
              {a.label}
            </label>
          ))}
        </div>
      </fieldset>
      {areaNote && <p className="text-xs text-slate-600">{areaNote}</p>}
      <AirportTransferBreakdown value={value} guests={guests} prices={prices} areas={areas} />
      {error && (
        <p id="airport-transfer-error" role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}
