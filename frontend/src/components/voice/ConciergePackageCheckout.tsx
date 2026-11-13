"use client";

// A multi-day package booked inside the AI concierge (owner, 13 November 2026: no redirect to
// another page). Loads each day's live departures and the pickup hotels the same way the package
// page does (components/booking/PackageBookingSection.tsx) and shows the same PackageCheckout in its
// narrow layout: a date for each day, guests, pickup, summary with the package price, one Stripe
// payment (POST /api/bookings/package, which also sends the days to Bókun).

import { useEffect, useState } from "react";
import { PackageCheckout, type PackageDay, type PackageStop } from "@/components/booking/PackageCheckout";
import { PRIVATE_PACKAGES, type PackageConfig } from "@/lib/privateTours";
import { TWO_DAY_PACKAGE } from "@/lib/sharedTours";
import { cancellationSentence } from "@/lib/policy";

const SHARED_TWO_DAY: PackageConfig = {
  slug: TWO_DAY_PACKAGE.slug,
  title: TWO_DAY_PACKAGE.title,
  days: TWO_DAY_PACKAGE.days.map((d) => ({ slug: d.slug, title: d.title, label: d.label })),
  discountPercent: Math.round(TWO_DAY_PACKAGE.discount * 100),
};

/** The packages the concierge can book, by the slug its tour cards use. */
export const CHAT_PACKAGES: Record<string, PackageConfig> = Object.fromEntries(
  [SHARED_TWO_DAY, PRIVATE_PACKAGES.two, PRIVATE_PACKAGES.three, PRIVATE_PACKAGES.four].map((p) => [p.slug, p]),
);

const inSummer = (date: string) => {
  const md = date.slice(5, 10);
  return md >= "06-01" && md <= "10-10";
};

interface TourDeparture {
  id: string;
  date: string;
  departureTime: string;
  seatsAvailable: number;
  capacityTotal: number;
  price: number;
  childPrice?: number | null;
  infantPrice?: number | null;
  currency: string;
  status: string;
  bookable?: boolean;
}

export function ConciergePackageCheckout({ slug }: { slug: string }) {
  const config = CHAT_PACKAGES[slug];
  const [days, setDays] = useState<PackageDay[] | null>(null);
  const [stops, setStops] = useState<PackageStop[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!config) return;
    let live = true;
    (async () => {
      const slugs = Array.from(new Set(config.days.map((d) => d.slug)));
      const tours = new Map(
        await Promise.all(
          slugs.map(async (s) => {
            const res = await fetch(`/api/tours/${encodeURIComponent(s)}`).catch(() => null);
            const data = res?.ok ? await res.json().catch(() => null) : null;
            return [s, (data?.tour?.departures ?? []) as TourDeparture[]] as const;
          }),
        ),
      );
      const today = new Date().toISOString().slice(0, 10);
      const loaded: PackageDay[] = config.days.map((d) => ({
        title: d.title,
        label: d.label,
        href: `/${d.slug}`,
        departures: (tours.get(d.slug) ?? [])
          .filter((x) => x.status === "ACTIVE" && x.seatsAvailable > 0 && x.bookable !== false)
          .filter((x) => x.date.slice(0, 10) >= today)
          // A private day needs the whole vehicle free.
          .filter((x) => !config.vehicle || x.seatsAvailable >= x.capacityTotal)
          .filter((x) => !config.summerOnly || inSummer(x.date))
          .map((x) => ({
            id: x.id,
            date: x.date,
            departureTime: x.departureTime,
            seatsAvailable: x.seatsAvailable,
            capacityTotal: x.capacityTotal,
            price: x.price,
            childPrice: x.childPrice,
            infantPrice: x.infantPrice,
            currency: x.currency,
          })),
      }));
      const first = loaded.find((d) => d.departures.length > 0)?.departures[0];
      let pickup: PackageStop[] = [];
      if (first) {
        const res = await fetch(`/api/departures/checkout?departureId=${encodeURIComponent(first.id)}`).catch(() => null);
        const data = res?.ok ? await res.json().catch(() => null) : null;
        pickup = (data?.stops ?? []).map((s: PackageStop) => ({ id: s.id, name: s.name, town: s.town, address: s.address, instructions: s.instructions }));
      }
      if (!live) return;
      if (!loaded.some((d) => d.departures.length > 0)) setError("There are no dates on sale for this package right now. Ask me about other dates, or contact our team.");
      setStops(pickup);
      setDays(loaded);
    })().catch(() => live && setError("The dates couldn't be loaded. Please try again."));
    return () => {
      live = false;
    };
  }, [config]);

  if (!config) return null;
  if (error) {
    return (
      <p role="alert" className="border border-obsidian-900/10 bg-white p-3 text-sm text-slate-700">
        {error}
      </p>
    );
  }
  if (!days) {
    return (
      <p className="border border-obsidian-900/10 bg-white p-3 text-sm text-slate-600" aria-live="polite">
        Loading dates for {config.title}…
      </p>
    );
  }
  return (
    <section aria-label={`Book ${config.title}`} className="bg-obsidian-50 p-2">
      <PackageCheckout
        compact
        packageSlug={config.slug}
        title={config.title}
        discountPercent={config.discountPercent}
        winterDiscountPercent={config.winterDiscountPercent}
        days={days}
        stops={stops}
        vehicle={config.vehicle}
        depositAllowed={config.vehicle}
        maxGuests={config.maxGuests}
        requestHref={`/contact-us?package=${config.slug}`}
        cancellationNote={cancellationSentence(config.vehicle ? "MULTIDAY" : "SHARED")}
      />
    </section>
  );
}
