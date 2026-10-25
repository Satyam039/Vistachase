// Booking page for the Two-Day Rockies Explorer: both shared day tours, a date for each, one payment
// with 10% off (backend modules/bookings/package-booking.ts). Dates are each tour's live, bookable
// departures; pickup stops are the same list the single-tour checkout uses.

import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { getCheckoutData, getTourBySlug } from "@/lib/api/catalog";
import { PackageCheckout, type PackageDay } from "@/components/booking/PackageCheckout";
import { TWO_DAY_PACKAGE } from "@/lib/sharedTours";

export const metadata: Metadata = {
  // Checkout pages have no search value of their own.
  robots: { index: false, follow: true },
  title: "Book the Two-Day Rockies Explorer | Vista Chase",
  description: "Choose your two dates and book both small-group day tours in one secure payment, with 10% off.",
  alternates: { canonical: "/two-day-rockies-explorer/book" },
};

export default async function TwoDayBookPage() {
  const tours = await Promise.all(TWO_DAY_PACKAGE.days.map((d) => getTourBySlug(d.slug).catch(() => null)));
  const days: PackageDay[] = TWO_DAY_PACKAGE.days.map((d, i) => ({
    title: d.title,
    label: d.label,
    href: `/${d.slug}`,
    departures: (tours[i]?.departures ?? [])
      .filter((x) => x.status === "ACTIVE" && x.seatsAvailable > 0)
      .map((x) => ({ id: x.id, date: x.date, departureTime: x.departureTime, seatsAvailable: x.seatsAvailable, price: x.price, childPrice: x.childPrice, currency: x.currency })),
  }));
  const firstDeparture = days.find((d) => d.departures.length > 0)?.departures[0];
  const checkout = firstDeparture ? await getCheckoutData(firstDeparture.id).catch(() => null) : null;
  const stops = (checkout?.stops ?? []).map((s) => ({ id: s.id, name: s.name, town: s.town, address: s.address, instructions: s.instructions }));

  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      <div className="mx-auto max-w-7xl px-page pb-16 pt-[calc(var(--vc-nav-open-h,100px)+1.5rem)] sm:pb-20">
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
            <li>
              <Link href="/shared-tours" className="hover:text-obsidian-900 hover:underline">Small-group tours</Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li>
              <Link href={TWO_DAY_PACKAGE.href} className="hover:text-obsidian-900 hover:underline">{TWO_DAY_PACKAGE.title}</Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li aria-current="page" className="text-obsidian-900">Book</li>
          </ol>
        </nav>
        <h1 className="text-balance text-3xl font-light tracking-tight text-obsidian-900 sm:text-5xl">Book the {TWO_DAY_PACKAGE.title}</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-600 sm:text-lg">Both small-group tours, one booking, {Math.round(TWO_DAY_PACKAGE.discount * 100)}% off. Choose a date for each day and pay once.</p>
        <div className="mt-8">
          <PackageCheckout packageSlug={TWO_DAY_PACKAGE.slug} title={TWO_DAY_PACKAGE.title} discountPercent={Math.round(TWO_DAY_PACKAGE.discount * 100)} days={days} stops={stops} />
        </div>
      </div>
    </div>
  );
}
