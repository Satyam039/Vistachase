"use client";

// Airport transfer add-on for private tours (owner, 2026-10-29): the guest ticks it under Guests,
// and checkout asks for their airport arrival and departure dates and times, the town, and where the
// transfer is from and where it goes (owner, 2026-10-31). Prices from the owner's doc pricing table
// (2026-11-04), per one-way trip: Banff or Canmore CAD 364 up to 6 guests, 850 up to 12; Lake Louise
// 445 / 895. The booking covers both trips. Same numbers as backend modules/bookings/airport-transfer.ts,
// which prices it again at checkout.

import { Plane } from "lucide-react";
import { Dropdown } from "@/components/forms/Dropdown";

export type AirportTown = "BANFF" | "CANMORE" | "LAKE_LOUISE";
const TOWNS: { value: AirportTown; label: string }[] = [
  { value: "BANFF", label: "Banff" },
  { value: "CANMORE", label: "Canmore" },
  { value: "LAKE_LOUISE", label: "Lake Louise" },
];
const LEG_PRICE: Record<AirportTown, [number, number]> = { BANFF: [364, 850], CANMORE: [364, 850], LAKE_LOUISE: [445, 895] };

/** Both transfers (arrival and departure) in dollars, or null above 12 guests (the team quotes). */
export function airportTransferPrice(town: AirportTown, guests: number): number | null {
  if (guests > 12) return null;
  return LEG_PRICE[town][guests <= 6 ? 0 : 1] * 2;
}

export interface AirportTransferValue {
  /** Town at the mountain end; sets the price. */
  town: AirportTown;
  arrivalDate: string;
  arrivalTime: string;
  departureDate: string;
  departureTime: string;
  /** Where we pick the guest up, e.g. Calgary Airport (YYC). */
  from: string;
  /** Where we take them, e.g. their hotel. */
  to: string;
}

export const EMPTY_AIRPORT_TRANSFER: AirportTransferValue = { town: "BANFF", arrivalDate: "", arrivalTime: "", departureDate: "", departureTime: "", from: "", to: "" };

export const AIRPORT_TRANSFER_PRICE_NOTE = "From CAD $728 for both trips (Banff or Canmore, up to 6 guests)";

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
          Private Calgary Airport (YYC) transfer on arrival and departure. Per trip: Banff or Canmore CAD $364 up to 6
          guests, $850 up to 12; Lake Louise $445 / $895. Checked bags: one per guest.
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
      <Dropdown
        id="airport-town"
        label="Transfer between Calgary Airport and"
        options={TOWNS}
        value={value.town}
        onChange={(town) => onChange({ ...value, town: town as AirportTown })}
      />
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
      {error && (
        <p id="airport-transfer-error" role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}
