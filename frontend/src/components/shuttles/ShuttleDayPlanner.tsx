"use client";

// Shuttles page booking bar + departure cards (owner's doc, "Choose your lake day"): Date → Pickup
// location → Available departures, then one card per departure for that date (seven in June–July,
// five in August–September) so guests can compare time at each lake. A card books online when a
// live departure exists for that date and pickup time; otherwise it opens a prefilled request.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock, MapPin, Users } from "lucide-react";
import {
  SHUTTLE_PICKUPS,
  clock,
  clockRange,
  departuresFor,
  firstShuttleDate,
  inSeason,
  type ShuttleDeparture,
  type ShuttlePickup,
} from "@/lib/shuttleSchedule";

export interface LiveShuttleDeparture {
  id: string;
  date: string;
  /** 24h "HH:MM". */
  time: string;
  price: number;
  seatsAvailable: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const longDate = (d: string) => {
  const p = new Date(`${d}T00:00:00Z`);
  return Number.isNaN(p.getTime()) ? d : `${DAYS[p.getUTCDay()]}, ${MONTHS[p.getUTCMonth()]} ${p.getUTCDate()}`;
};

const fieldClass =
  "h-12 w-full rounded-xl border border-obsidian-900/15 bg-white px-3.5 text-base text-obsidian-900 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/25";

export function ShuttleDayPlanner({ today, live, fromPrice }: { today: string; live: LiveShuttleDeparture[]; fromPrice: number | null }) {
  const [date, setDate] = useState(() => firstShuttleDate(today));
  const [pickup, setPickup] = useState<ShuttlePickup>("banff");
  const [chosen, setChosen] = useState<number | null>(null);

  const departures = useMemo(() => departuresFor(date), [date]);
  const pickupLabel = SHUTTLE_PICKUPS.find((p) => p.id === pickup)!.short;

  const liveFor = (d: ShuttleDeparture) => {
    const times = [d.pickup.canmore, d.pickup.banff].filter(Boolean);
    return live.find((l) => l.date === date && times.includes(l.time) && l.seatsAvailable > 0);
  };

  const choose = (n: string) => {
    const num = Number(n) || null;
    setChosen(num);
    if (num) document.getElementById(`shuttle-departure-${num}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div>
      {/* Booking bar */}
      <form
        onSubmit={(e) => e.preventDefault()}
        aria-label="Find a shuttle departure"
        className="mx-auto grid max-w-5xl gap-3 rounded-[1.5rem] bg-white p-4 shadow-[0_24px_60px_-40px_rgba(12,31,33,0.55)] ring-1 ring-obsidian-900/[0.07] sm:grid-cols-3 sm:p-5"
      >
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-sm text-slate-600">
            <CalendarDays className="h-4 w-4 text-ocean-600" aria-hidden="true" />
            1. Date
          </span>
          <input type="date" value={date} min={today} onChange={(e) => e.target.value && (setDate(e.target.value), setChosen(null))} className={fieldClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-sm text-slate-600">
            <MapPin className="h-4 w-4 text-ocean-600" aria-hidden="true" />
            2. Pickup location
          </span>
          <select value={pickup} onChange={(e) => setPickup(e.target.value as ShuttlePickup)} className={fieldClass}>
            {SHUTTLE_PICKUPS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-sm text-slate-600">
            <Clock className="h-4 w-4 text-ocean-600" aria-hidden="true" />
            3. Available departures
          </span>
          <select value={chosen ?? ""} onChange={(e) => choose(e.target.value)} disabled={departures.length === 0} className={`${fieldClass} disabled:bg-obsidian-50 disabled:text-slate-500`}>
            <option value="">{departures.length ? `${departures.length} departures` : "No departures"}</option>
            {departures.map((d) => (
              <option key={d.number} value={d.number}>
                {d.number} · {d.name}
                {d.pickup[pickup] ? ` · ${clock(d.pickup[pickup]!)}` : ""}
              </option>
            ))}
          </select>
        </label>
      </form>

      <div className="mx-auto mt-14 max-w-3xl text-center">
        <h3 className="text-balance text-2xl font-light tracking-tight text-obsidian-900 sm:text-3xl">Find Your Ideal Departure</h3>
        <p className="mt-3 text-base text-slate-600">
          Compare pickup times, time at each lake and your estimated return. Every departure includes both lakes and round-trip transportation.
        </p>
        <p className="mt-4 text-sm text-obsidian-900" aria-live="polite">
          {departures.length > 0 ? `${departures.length} departures on ${longDate(date)} from ${pickupLabel}` : `${longDate(date)}: the shuttle runs June to September.`}
        </p>
      </div>

      {departures.length === 0 ? (
        <div className="mx-auto mt-8 max-w-xl rounded-[1.5rem] bg-white p-6 text-center ring-1 ring-obsidian-900/[0.07]">
          <p className="text-base text-slate-700">Shuttles operate June to September. Pick a date in season to see departures.</p>
          {!inSeason(today) && (
            <button type="button" onClick={() => setDate(firstShuttleDate(today))} className="mt-4 text-base text-ocean-700 underline underline-offset-4">
              Show {longDate(firstShuttleDate(today))}
            </button>
          )}
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {departures.map((d) => {
            const match = liveFor(d);
            const price = match?.price ?? fromPrice;
            const href = match
              ? `/book?departureId=${match.id}`
              : `/contact-us?shuttle=${d.number}&date=${date}&pickup=${pickup}`;
            const rows: [string, string][] = [
              ["Canmore pickup", clock(d.pickup.canmore!)],
              ["Banff pickup", clock(d.pickup.banff!)],
              ["Samson Mall pickup", d.pickup.samson ? clock(d.pickup.samson) : "Time to be confirmed"],
              ["Moraine Lake visit", clockRange(d.moraine)],
              ["Lake Louise visit", clockRange(d.louise)],
              ["Estimated Banff return", clock(d.returnBanff)],
              ["Estimated Canmore return", clock(d.returnCanmore)],
            ];
            const highlight = { canmore: "Canmore pickup", banff: "Banff pickup", samson: "Samson Mall pickup" }[pickup];
            return (
              <li
                key={d.number}
                id={`shuttle-departure-${d.number}`}
                className={`flex scroll-mt-32 flex-col rounded-[1.5rem] bg-white p-5 ring-1 transition-shadow sm:p-6 ${chosen === d.number ? "shadow-[0_20px_44px_-28px_rgba(12,31,33,0.6)] ring-2 ring-ocean-600" : "ring-obsidian-900/[0.08]"}`}
              >
                <p className="text-sm uppercase tracking-[0.18em] text-ocean-600">Departure {d.number}</p>
                <h4 className="mt-1 text-xl font-light text-obsidian-900">{d.name}</h4>
                <p className="mt-1 text-sm text-slate-600">
                  {d.pickup[pickup] ? `${clock(d.pickup[pickup]!)} from ${pickupLabel}` : `${pickupLabel} time to be confirmed`}
                </p>
                <dl className="mt-4 divide-y divide-obsidian-900/[0.07] text-sm">
                  {rows.map(([k, v]) => (
                    <div key={k} className={`flex items-baseline justify-between gap-3 py-2 ${k === highlight ? "text-obsidian-900" : "text-slate-600"}`}>
                      <dt>{k}</dt>
                      <dd className={`text-right ${k === highlight ? "font-medium" : ""}`}>{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-600">
                  <Users className="h-4 w-4 text-ocean-600" aria-hidden="true" />
                  Small-group transportation
                </p>
                <div className="mt-auto pt-5">
                  {price != null && (
                    <p className="text-base text-obsidian-900">
                      {match ? "" : "From "}CAD ${price} per person
                      <span className="block text-xs text-slate-600">Taxes and required fees included</span>
                    </p>
                  )}
                  <Link
                    href={href}
                    aria-label={`Book departure ${d.number}, ${d.name}, ${longDate(date)}`}
                    className="golden-summit-btn mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-base"
                  >
                    Book This Departure
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  {!match && <p className="mt-2 text-center text-xs text-slate-600">We confirm your seats by email</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-slate-600">
        All times are local Alberta time. Return times are approximate and may vary with traffic and road conditions.
      </p>
    </div>
  );
}
