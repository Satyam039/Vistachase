// The booking form for a package, on the package's own page (owner 2026-11-06: the multi-day pages
// book directly, like a private tour, instead of sending a request). Reads each day's tour and its
// bookable departures, and the pickup hotels, then hands them to PackageCheckout. The days and
// prices must match backend/src/modules/bookings/package-booking.ts (PACKAGES).

import { getCheckoutData, getTourBySlug } from "@/lib/api/catalog";
import { PackageCheckout, type PackageDay } from "@/components/booking/PackageCheckout";
import { cancellationSentence, DEPOSIT_PERCENT } from "@/lib/policy";
import type { PackageConfig } from "@/lib/privateTours";

const inSummer = (date: string) => {
  const md = date.slice(5, 10);
  return md >= "06-01" && md <= "10-10";
};

export async function PackageBookingSection({ config, heading = "Book your dates" }: { config: PackageConfig; heading?: string }) {
  const slugs = Array.from(new Set(config.days.map((d) => d.slug)));
  const tours = new Map(await Promise.all(slugs.map(async (slug) => [slug, await getTourBySlug(slug).catch(() => null)] as const)));
  const days: PackageDay[] = config.days.map((d) => ({
    title: d.title,
    label: d.label,
    href: `/${d.slug}`,
    departures: (tours.get(d.slug)?.departures ?? [])
      .filter((x) => x.status === "ACTIVE" && x.seatsAvailable > 0 && (x as any).bookable !== false)
      .filter((x) => new Date(x.date).getTime() >= new Date(new Date().toDateString()).getTime())
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
  const firstDeparture = days.find((d) => d.departures.length > 0)?.departures[0];
  const checkout = firstDeparture ? await getCheckoutData(firstDeparture.id).catch(() => null) : null;
  const stops = (checkout?.stops ?? []).map((s) => ({ id: s.id, name: s.name, town: s.town, address: s.address, instructions: s.instructions }));

  return (
    <section id="book" aria-labelledby="book-heading" className="scroll-mt-[calc(var(--vc-header-h,80px)+16px)] border-t border-obsidian-900/[0.08] bg-obsidian-50">
      <div className="mx-auto max-w-7xl px-page py-12 sm:py-16">
        <h2 id="book-heading" className="text-balance text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl">
          {heading}
        </h2>
        <p className="mt-3 max-w-2xl text-base text-slate-600">
          {config.vehicle ? "One private vehicle and guide for your group each day. " : ""}
          Choose the date you want for each day, then pay once for the whole {config.title}
          {config.vehicle ? `, in full or with a ${DEPOSIT_PERCENT}% deposit now` : ""}.
        </p>
        <div className="mt-8">
          <PackageCheckout
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
        </div>
      </div>
    </section>
  );
}
