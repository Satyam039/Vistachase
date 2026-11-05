"use client";

// Airport transfer add-on for private tours (owner, 2026-10-29): the guest ticks it under Guests,
// and checkout asks for their airport arrival and departure dates and times, then where the transfer
// is from and where it goes (owner, 2026-10-31), and where the guest stays (for the price).
// Price (doc, 2026-11-04; owner: covers both ways): Banff or Canmore CAD 364 up to 6 guests / 850 up
// to 12; Lake Louise 445 / 895. Charged with the tour when the guest arrives June 1 to October 10
// with up to 12 guests; otherwise the team confirms it. The server prices it again
// (backend modules/bookings/airport-transfer.ts).

import { Plane } from "lucide-react";

export interface AirportTransferValue {
  arrivalDate: string;
  arrivalTime: string;
  departureDate: string;
  departureTime: string;
  /** Where we pick the guest up, e.g. Calgary Airport (YYC). */
  from: string;
  /** Where we take them, e.g. their hotel. */
  to: string;
  /** Where the guest stays, for the price. */
  area: "" | AirportArea;
}

export type AirportArea = "BANFF" | "CANMORE" | "LAKE_LOUISE";

export const EMPTY_AIRPORT_TRANSFER: AirportTransferValue = { arrivalDate: "", arrivalTime: "", departureDate: "", departureTime: "", from: "", to: "", area: "" };

export const AIRPORT_TRANSFER_PRICE_NOTE = "Price confirmed by our team before your trip";

/** Private Calgary Airport (YYC) transfer prices, CAD, both ways, from the owner's doc (Pricing, 2026-11-04). */
export const AIRPORT_TRANSFER_PRICES = [
  { area: "Banff or Canmore", small: 364, large: 850 },
  { area: "Lake Louise", small: 445, large: 895 },
];

const AREAS: { id: AirportArea; label: string }[] = [
  { id: "BANFF", label: "Banff" },
  { id: "CANMORE", label: "Canmore" },
  { id: "LAKE_LOUISE", label: "Lake Louise" },
];

/** The transfer's price in dollars (both ways), or null when our team confirms it. Same rule as the server. Available only for 2+ guests. */
export function airportTransferPrice(t: Pick<AirportTransferValue, "area" | "arrivalDate">, guests: number): number | null {
  if (guests < 2) return null;
  if (!t.area || !t.arrivalDate) return null;
  const md = t.arrivalDate.slice(5, 10);
  if (md < "06-01" || md > "10-10") return null;
  const row = AIRPORT_TRANSFER_PRICES[t.area === "LAKE_LOUISE" ? 1 : 0];
  if (guests <= 6) return row.small;
  if (guests <= 12) return row.large;
  return null;
}

/** The price list, shown with the transfer details. */
export function AirportTransferPrices() {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-700 ring-1 ring-slate-200">
      <p className="font-medium text-obsidian-900">Calgary Airport transfer prices, both ways, June 1 to October 10</p>
      <ul className="mt-1.5 space-y-1">
        {AIRPORT_TRANSFER_PRICES.map((p) => (
          <li key={p.area}>
            To or from {p.area}: CAD ${p.small} up to 6 guests with 6 checked bags, or CAD ${p.large} up to 12 guests with 12 checked bags.
          </li>
        ))}
      </ul>
      <p className="mt-1.5">Added to your total and paid with the tour. In winter, or for more than 12 guests, the price varies: {AIRPORT_TRANSFER_PRICE_NOTE.toLowerCase()} and nothing is charged for it now.</p>
    </div>
  );
}

/** What's missing or wrong, if anything. */
export function airportTransferError(t: AirportTransferValue): string | null {
  if (!t.arrivalDate || !t.arrivalTime || !t.departureDate || !t.departureTime) {
    return "Enter your airport arrival and departure dates and times.";
  }
  if (`${t.departureDate} ${t.departureTime}` <= `${t.arrivalDate} ${t.arrivalTime}`) {
    return "Your departure must be after your arrival.";
  }
  if (t.from.trim().length < 2 || t.to.trim().length < 2) {
    return "Enter where we pick you up and where we take you.";
  }
  if (!t.area) return "Choose where you're staying.";
  return null;
}

/** The add-on tick box (tour page booking panel and checkout). */
export function AirportTransferToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
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
          Calgary Airport (YYC) pickup and drop-off, both ways. Summer from CAD ${AIRPORT_TRANSFER_PRICES[0].small} (Banff or Canmore, up to 6 guests), added to your total. We ask for your arrival and departure times.
        </span>
      </span>
    </label>
  );
}

const input =
  "mt-1 block h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-obsidian-900 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/30";

/** Arrival and departure date and time, shown once the add-on is ticked. */
export function AirportTransferDetails({
  value,
  onChange,
  error,
  minDate,
}: {
  value: AirportTransferValue;
  onChange: (value: AirportTransferValue) => void;
  error?: string;
  minDate?: string;
}) {
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
  const place = (id: "from" | "to", label: string, placeholder: string) => (
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
      <legend className="text-sm font-medium text-obsidian-900">Your flights</legend>
      <div className="grid grid-cols-2 gap-3">
        {field("arrivalDate", "Airport arrival date", "date", minDate)}
        {field("arrivalTime", "Arrival time", "time")}
        {field("departureDate", "Airport departure date", "date", value.arrivalDate || minDate)}
        {field("departureTime", "Departure time", "time")}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {place("from", "From", "e.g. Calgary Airport (YYC)")}
        {place("to", "Where to", "e.g. your hotel in Banff")}
      </div>
      <fieldset>
        <legend className="text-sm text-obsidian-900">Where you&apos;re staying</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {AREAS.map((a) => (
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
      <AirportTransferPrices />
      {error && (
        <p id="airport-transfer-error" role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}
