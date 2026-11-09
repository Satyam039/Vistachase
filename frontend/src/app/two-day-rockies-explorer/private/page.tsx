// Booking page for the private Two-Day Rockies Explorer (owner 2026-11-06: book it like a private
// tour instead of requesting it): both private day tours, a date the guest picks for each, one
// vehicle per day, one payment (backend modules/bookings/package-booking.ts).

import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { PackageBookingSection } from "@/components/booking/PackageBookingSection";
import { PACKAGE_DAY_PRICE, PRIVATE_MAX_GUESTS, PRIVATE_PACKAGES } from "@/lib/privateTours";

export const metadata: Metadata = {
  // Technical audit spreadsheet (9 Nov 2026, Directives: Noindex): index, follow.
  robots: { index: true, follow: true },
  title: "Book the Private Two-Day Rockies Explorer | Vista Chase",
  description: "Both private day tours with your own vehicle and guide: choose a date for each day and book in one secure payment.",
  alternates: { canonical: "/two-day-rockies-explorer/private" },
};

const cad = (n: number) => `CAD $${n.toLocaleString("en-CA")}`;

export default function PrivateTwoDayBookPage() {
  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      <div className="mx-auto max-w-7xl px-page pt-[calc(var(--vc-nav-open-h,100px)+1.5rem)]">
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
            <li>
              <Link href="/private-tours" className="hover:text-obsidian-900 hover:underline">
                Private tours
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li aria-current="page" className="text-obsidian-900">
              Private Two-Day Rockies Explorer
            </li>
          </ol>
        </nav>
        <h1 className="text-balance text-3xl font-light tracking-tight text-obsidian-900 sm:text-5xl">Private Two-Day Rockies Explorer</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-600 sm:text-lg">
          Banff &amp; Yoho Discovery and the Columbia Icefield Adventure, each with your own vehicle and guide. Private, up to {PRIVATE_MAX_GUESTS} guests.
        </p>
        <p className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-obsidian-900/10">Summer (Jun 1–Oct 10): {cad(PACKAGE_DAY_PRICE.summer)} per day per vehicle</span>
          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-obsidian-900/10">Winter (Oct 11–May 31): {cad(PACKAGE_DAY_PRICE.winter)} per day per vehicle</span>
        </p>
      </div>
      <PackageBookingSection config={PRIVATE_PACKAGES.two} heading="Choose your dates" />
    </div>
  );
}
