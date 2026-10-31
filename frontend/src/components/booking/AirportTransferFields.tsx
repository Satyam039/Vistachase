"use client";

// Airport transfer add-on for private tours (owner, 2026-10-29): the guest ticks it under Guests,
// and checkout asks for their airport arrival and departure dates and times, then where the transfer
// is from and where it goes (owner, 2026-10-31). No transfer price is
// set yet, so nothing is charged online; the team confirms the transfer and its price
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
}

export const EMPTY_AIRPORT_TRANSFER: AirportTransferValue = { arrivalDate: "", arrivalTime: "", departureDate: "", departureTime: "", from: "", to: "" };

export const AIRPORT_TRANSFER_PRICE_NOTE = "Price confirmed by our team before your trip";

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
          Calgary Airport (YYC) pickup and drop-off. We ask for your arrival and departure times. {AIRPORT_TRANSFER_PRICE_NOTE}.
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
      {error && (
        <p id="airport-transfer-error" role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}
