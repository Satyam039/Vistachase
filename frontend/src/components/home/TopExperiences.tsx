"use client";

// "Experiences Travellers Love" rail, with category chips that filter it in place (Viator /
// GetYourGuide home rails). Chips are toggle buttons; the result count is announced.
//
// Each tab shows the same cards as its own page (owner's doc, 2026-10-28): Small-Group Tours =
// the Shared Tours page's three options, Private Tours = the Private Tours page's first three,
// Multi-Day Journeys = its last three, Lake Shuttles = the seven departures from the shuttle
// timetable. Prices are live: each product's departures, the shared two-day package both days less
// 10%. The private packages show the doc's per-day price (lib/privateTours.ts).

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Clock, MapPin, Users, type LucideIcon } from "lucide-react";
import { Rail } from "@/components/motion/Rail";
import { TOUR_CARD_RAIL_ITEM, TourCard } from "@/components/tours/TourCard";
import { CARD_BADGE, CARD_EYEBROW, CARD_PANEL, CARD_TITLE } from "@/components/cards/MediaCard";
import { SectionHeading } from "@/components/home/SectionHeading";
import { PriceTag } from "@/components/pricing/PriceTag";
import { hasPrice } from "@/lib/pricing";
import { fromPrice } from "@/lib/tours";
import { BANFF_YOHO, ICEFIELD, TWO_DAY_PACKAGE, packagePrice } from "@/lib/sharedTours";
import { PRIVATE_OPTIONS, type PrivateTourOption } from "@/lib/privateTours";
import { LATE_SEASON_DEPARTURES, SHUTTLE_DEPARTURES, clock, clockRange } from "@/lib/shuttleSchedule";
import type { TourWithAvailability } from "@/lib/api/types";

const FILTERS = [
  { id: "ALL", label: "All experiences" },
  { id: "SHARED", label: "Small-Group Tours" },
  { id: "PRIVATE", label: "Private Tours" },
  { id: "SHUTTLE", label: "Lake Shuttles" },
  { id: "MULTIDAY", label: "Multi-Day Journeys" },
  { id: "TICKET", label: "Attraction Tickets" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

/** Shuttle products the timetable's departures are sold under (seed-departures.ts). */
const SUNRISE_SHUTTLE = "sunrise-shuttle-to-moraine-lake-and-lake-louise";
const DAY_SHUTTLE = "full-day-at-lake-louise-and-moraine-lake";
const SHUTTLE_PHOTOS = [
  "/media/photos/moraine-lake-reflection-morning.webp",
  "/media/photos/lake-louise-sunrise.webp",
  "/media/photos/moraine-lake-ten-peaks.webp",
  "/media/photos/lake-louise-red-canoes.webp",
  "/media/photos/moraine-lake-perfect-reflection.webp",
  "/media/photos/lake-louise-shoreline.webp",
  "/media/photos/moraine-lake-canoes.webp",
];

interface LinkCard {
  key: string;
  href: string;
  external?: boolean;
  image: string;
  badge: string;
  eyebrow: string;
  title: string;
  facts: { icon: LucideIcon; text: string }[];
  note?: string;
  price: number;
  /** "CAD/guest", "CAD/vehicle"... */
  unit: string;
  /** Shown instead of a price when there is none. */
  noPrice: string;
}

type Card = { kind: "tour"; key: string; tour: TourWithAvailability; title?: string; image?: string } | ({ kind: "link" } & LinkCard);

export function TopExperiences({ tours }: { tours: TourWithAvailability[] }) {
  const [filter, setFilter] = useState<FilterId>("ALL");

  const tabs = useMemo(() => {
    const bySlug = (slug?: string) => (slug ? tours.find((t) => t.slug === slug) : undefined);
    const price = (slug: string) => {
      const tour = bySlug(slug);
      return tour ? fromPrice(tour) : 0;
    };
    const tourCard = (slug: string | undefined, title: string, image: string): Card[] => {
      const tour = bySlug(slug);
      return tour ? [{ kind: "tour", key: tour.slug, tour, title, image }] : [];
    };

    const sharedPackage = packagePrice(price(BANFF_YOHO.slug), price(ICEFIELD.slug));
    const shared: Card[] = [
      ...tourCard(BANFF_YOHO.slug, BANFF_YOHO.title, BANFF_YOHO.image),
      ...tourCard(ICEFIELD.slug, ICEFIELD.title, ICEFIELD.image),
      {
        kind: "link",
        key: "two-day-shared",
        href: TWO_DAY_PACKAGE.href,
        image: TWO_DAY_PACKAGE.images[0].src,
        badge: TWO_DAY_PACKAGE.saving,
        eyebrow: "Banff, Yoho & Icefields Parkway",
        title: TWO_DAY_PACKAGE.title,
        facts: [
          { icon: Clock, text: TWO_DAY_PACKAGE.duration },
          { icon: Users, text: "Max 12 guests" },
        ],
        note: "Accommodation not included",
        price: sharedPackage.price,
        unit: "CAD/guest",
        noPrice: "Price on request",
      },
    ];

    const privateCard = (opt: PrivateTourOption): Card => {
      if (opt.slug && bySlug(opt.slug)) return tourCard(opt.slug, opt.title, opt.image)[0];
      return {
        kind: "link",
        key: opt.id,
        href: opt.buttonHref,
        external: opt.isCustomPartner,
        image: opt.image,
        badge: opt.isCustomPartner ? "By Banff Elite" : "Private tour",
        eyebrow: opt.suggestedStay,
        title: opt.title,
        facts: [
          { icon: Clock, text: opt.duration },
          { icon: Users, text: opt.transport },
        ],
        note: opt.isCustomPartner ? opt.activities : opt.pickup,
        price: opt.priceFrom,
        unit: "CAD/vehicle",
        noPrice: opt.isCustomPartner ? "Personalised quote" : "Price on request",
      };
    };
    const privateTours = PRIVATE_OPTIONS.slice(0, 3).map(privateCard);
    const multiDay = PRIVATE_OPTIONS.slice(-3).map(privateCard);

    const shuttles: Card[] = SHUTTLE_DEPARTURES.map((d, i) => ({
      kind: "link",
      key: `shuttle-${d.number}`,
      href: "/shuttles#departures",
      image: SHUTTLE_PHOTOS[i % SHUTTLE_PHOTOS.length],
      badge: d.number <= 2 ? "Sunrise shuttle" : "Day shuttle",
      eyebrow: "Moraine Lake & Lake Louise",
      title: `Departure ${d.number} · ${d.name}`,
      facts: [
        { icon: Clock, text: `Banff ${clock(d.pickup.banff!)} · Canmore ${clock(d.pickup.canmore!)}` },
        { icon: CalendarDays, text: LATE_SEASON_DEPARTURES.includes(d.number) ? "June–September" : "June–July" },
      ],
      note: `Moraine Lake ${clockRange(d.moraine)} · Lake Louise ${clockRange(d.louise)}`,
      price: price(d.number <= 2 ? SUNRISE_SHUTTLE : DAY_SHUTTLE),
      unit: "CAD/guest",
      noPrice: "Price on request",
    }));

    const tickets: Card[] = tours
      .filter((t) => t.category === "TICKET")
      .map((tour) => ({ kind: "tour", key: tour.slug, tour }));

    const shuttleProducts: Card[] = [SUNRISE_SHUTTLE, DAY_SHUTTLE].flatMap((slug) => {
      const tour = bySlug(slug);
      return tour ? [{ kind: "tour" as const, key: tour.slug, tour }] : [];
    });

    return {
      ALL: [...shared, ...privateTours, ...multiDay, ...shuttleProducts],
      SHARED: shared,
      PRIVATE: privateTours,
      SHUTTLE: shuttles,
      MULTIDAY: multiDay,
      TICKET: tickets,
    } satisfies Record<FilterId, Card[]>;
  }, [tours]);

  const shown = tabs[filter];

  return (
    <section
      aria-labelledby="top-experiences"
      className="relative isolate overflow-hidden bg-gradient-to-b from-[#0e1317] via-[#090d10] to-[#06080a] py-20 sm:py-28 border-y border-white/[0.08]"
    >
      {/* Rolls-Royce atmospheric smoke / spotlight ambient lighting */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(55,70,85,0.35),transparent_75%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(22,30,38,0.4),transparent_80%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-30 bg-[radial-gradient(ellipse_at_bottom,rgba(40,55,70,0.3),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-page">
        <SectionHeading
          id="top-experiences"
          eyebrow="Find your Rockies experience"
          title="Experiences Travellers Love"
          intro="Explore with a small group, plan a private tour or book your ride to Moraine Lake and Lake Louise. Find the experience that fits your journey."
          link={{ label: "View All Experiences", href: "/search" }}
          tone="dark"
        />

        <div
          role="group"
          aria-label="Filter experiences"
          className="vc-rail -mx-page mb-8 flex gap-2.5 overflow-x-auto px-page [&>*:first-child]:ml-auto [&>*:last-child]:mr-auto"
          data-reveal="fade"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-11 shrink-0 rounded-full border px-5 text-sm font-normal tracking-wide transition-all duration-300 ${
                filter === f.id
                  ? "border-white bg-white text-obsidian-950 font-medium shadow-[0_0_24px_rgba(255,255,255,0.22)]"
                  : "border-white/10 bg-white/[0.06] text-white/80 backdrop-blur-md hover:border-white/25 hover:bg-white/[0.12] hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          {shown.length} experiences shown
        </p>

        <Rail key={filter} label="Top experiences" itemClassName={TOUR_CARD_RAIL_ITEM} tone="dark">
          {shown.map((card) =>
            card.kind === "tour" ? (
              <TourCard key={card.key} tour={card.tour} title={card.title} image={card.image} />
            ) : (
              <ExperienceCard key={card.key} card={card} />
            ),
          )}
        </Rail>
      </div>
    </section>
  );
}

/** Same layout as TourCard, for options that are not a single catalog product (packages,
 *  multi-day journeys, shuttle departures). The whole card is one link. */
function ExperienceCard({ card }: { card: LinkCard }) {
  const { href, external, image, badge, eyebrow, title, facts, note, price, unit, noPrice } = card;
  return (
    <article className="group relative flex h-full flex-col text-white transition-transform duration-500 ease-out hover:-translate-y-1">
      <div className="relative aspect-[5/4] w-full overflow-hidden bg-obsidian-900">
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 46vw, (max-width: 1280px) 31vw, 400px"
          className="object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-[1.04]"
        />
        <div className="absolute inset-x-0 top-0 flex flex-wrap gap-1.5 p-3">
          <span className={CARD_BADGE}>{badge}</span>
        </div>
      </div>

      <div className={CARD_PANEL}>
        <p className={CARD_EYEBROW}>
          <MapPin className="h-3 w-3 shrink-0 text-summit-300" aria-hidden="true" />
          <span className="truncate">{eyebrow}</span>
        </p>
        <h3 className={CARD_TITLE}>
          <Link
            href={href}
            className="focus-visible:outline-none"
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            <span className="absolute inset-0 z-10 group-has-[:focus-visible]:outline group-has-[:focus-visible]:outline-2 group-has-[:focus-visible]:outline-offset-2 group-has-[:focus-visible]:outline-summit-300" />
            {title}
            {external && <span className="sr-only"> (opens Banff Elite in a new tab)</span>}
          </Link>
        </h3>

        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/75" aria-label="Key details">
          {facts.map(({ icon: Icon, text }) => (
            <li key={text} className="flex min-w-0 items-center gap-1">
              <Icon className="h-3 w-3 shrink-0 text-summit-300" aria-hidden="true" />
              <span className="truncate">{text}</span>
            </li>
          ))}
        </ul>

        {note && (
          <p className="mb-4 mt-1.5 flex items-start gap-1 text-xs text-white/55">
            <CheckCircle2 className="mt-px h-3 w-3 shrink-0 text-summit-300" aria-hidden="true" />
            {note}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-white/[0.1] pt-3">
          <div className="min-w-0">
            {hasPrice(price) ? (
              <>
                <div className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
                  <span className="text-xs text-white/55">From</span>
                  <PriceTag price={price} currency="CAD" unit={unit} size="sm" tone="dark" layout="inline" />
                </div>
                <p className="mt-0.5 text-xs text-white/55">Taxes and required fees included</p>
              </>
            ) : (
              <p className="text-sm text-white/80">{noPrice}</p>
            )}
          </div>
          <span className="mb-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center ring-1 ring-summit-200/40 text-summit-200 transition-colors duration-300 group-hover:bg-summit-200 group-hover:text-obsidian-900" aria-hidden="true">
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
