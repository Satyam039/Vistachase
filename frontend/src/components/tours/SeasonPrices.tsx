// Summer and winter prices for a tour page's booking panel (owner, 2026-11-23, Columbia Icefield
// Adventure: "Display the seasonal prices"). Read from the tour's own departures, so the figures are
// always what checkout charges; a season with no departures on sale is left out.

import Link from "next/link";
import type { DepartureAvailability } from "@/lib/api/types";
import { money } from "@/lib/pricing";
import { inSummerSeason } from "@/lib/itineraries";
import { TWO_DAY_PACKAGE } from "@/lib/sharedTours";

interface Fares {
  adult: number;
  youth: number;
  infant: number | null;
}

function faresFor(departures: DepartureAvailability[]): Fares | null {
  const priced = departures.filter((d) => d.price > 0);
  if (priced.length === 0) return null;
  const min = (xs: number[]) => Math.min(...xs);
  const infants = priced.map((d) => d.infantPrice).filter((p): p is number => p != null && p > 0);
  return {
    adult: min(priced.map((d) => d.price)),
    youth: min(priced.map((d) => (d.childPrice != null && d.childPrice > 0 ? d.childPrice : d.price))),
    infant: infants.length > 0 ? min(infants) : null,
  };
}

export function SeasonPrices({
  departures,
  currency,
  isVehicle = false,
  unitLabel = "per van",
}: {
  departures: DepartureAvailability[];
  currency: string;
  isVehicle?: boolean;
  unitLabel?: string;
}) {
  const seasons = [
    { label: "Summer", dates: "June 1 – October 10", fares: faresFor(departures.filter((d) => inSummerSeason(d.date))) },
    { label: "Winter", dates: "October 11 – May 31", fares: faresFor(departures.filter((d) => !inSummerSeason(d.date))) },
  ].filter((s): s is typeof s & { fares: Fares } => s.fares != null);
  if (seasons.length === 0) return null;
  return (
    <dl className="mt-3 space-y-2 text-sm text-slate-700" aria-label={`Seasonal prices ${unitLabel}`}>
      {seasons.map((s) => (
        <div key={s.label} className="rounded-none bg-obsidian-50 px-3 py-2">
          <dt className="text-obsidian-900">
            {s.label} <span className="text-slate-600">· {s.dates}</span>
          </dt>
          <dd>
            {isVehicle
              ? `${money(s.fares.adult, currency)} ${unitLabel}`
              : `Adult (16–99) ${money(s.fares.adult, currency)} · Youth (6–15) ${money(s.fares.youth, currency)}${s.fares.infant != null ? ` · Infant (0–5) ${money(s.fares.infant, currency)}` : " · Infants (0–5) free on a lap"}`}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The Two-Day Rockies Explorer offer: both shared tours, 10% off. */
export function ComboOffer() {
  return (
    <p className="text-sm text-slate-700">
      Combine with Banff &amp; Yoho Discovery and save 10%:{" "}
      <Link href={TWO_DAY_PACKAGE.href} className="text-ocean-700 underline underline-offset-4">
        {TWO_DAY_PACKAGE.title}
      </Link>
    </p>
  );
}
