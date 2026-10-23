// Shared Tours page, laid out as the owner's "Update Vista Chase web" doc describes (2026-10-22):
//   hero (reviews line, title, kicker, lede, "Explore Our Three Tours" → the cards, four chips)
//   → "One Day or Two" intro with four stats → three fixed tour cards (no sort bar, no full grid)
//   → four benefits → guest reviews (when the tours have real ones) → "Before You Book" FAQ
//   → other ways to explore → closing call to action with phone and email.
// Copy lives in lib/sharedTours.ts; prices come from each tour's live departures.

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Compass,
  Info,
  Mail,
  MapPin,
  Phone,
  Star,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { CARD_EYEBROW, CARD_PANEL, MediaCard } from "@/components/cards/MediaCard";
import { SectionHeading } from "@/components/home/SectionHeading";
import { PriceTag } from "@/components/pricing/PriceTag";
import { FaqBrowser } from "@/components/faq/FaqBrowser";
import { ReviewSlider } from "@/components/reviews/ReviewSlider";
import { AmbientVideo } from "@/components/cinematic/AmbientVideo";
import { hasPrice, money } from "@/lib/pricing";
import { fromPrice } from "@/lib/tours";
import { serviceById } from "@/lib/services";
import type { CategoryReview } from "@/lib/api/catalog";
import type { TourWithAvailability } from "@/lib/api/types";
import {
  BANFF_YOHO,
  ICEFIELD,
  PICKUP_TIMES,
  SHARED_BENEFITS,
  SHARED_CLOSING,
  SHARED_FAQS,
  SHARED_HERO,
  SHARED_INTRO,
  TWO_DAY_PACKAGE,
  packagePrice,
  type DayTour,
} from "@/lib/sharedTours";

const BANFF_ELITE_URL = process.env.NEXT_PUBLIC_BANFF_ELITE_URL || "https://banffelite.com";
const CHIP_ICONS: LucideIcon[] = [Users, MapPin, BadgeCheck, Compass];
const BENEFIT_ICONS: LucideIcon[] = [Users, Compass, BadgeCheck, Tag];

export function SharedToursLanding({ tours, reviews }: { tours: TourWithAvailability[]; reviews: CategoryReview[] }) {
  const service = serviceById("shared");
  const price = (slug: string) => {
    const tour = tours.find((t) => t.slug === slug);
    return tour ? fromPrice(tour) : 0;
  };
  const day1 = price(BANFF_YOHO.slug);
  const day2 = price(ICEFIELD.slug);

  const others = [
    { key: "private", ...pick("private"), title: "Private Tours", description: "Your own vehicle and guide, with flexibility to shape the day around your interests.", cta: "Explore Private Tours" },
    { key: "shuttles", ...pick("shuttles"), title: "Lake Shuttles", description: "Convenient transportation to Moraine Lake and Lake Louise, with time to explore independently.", cta: "Explore Lake Shuttles" },
    ...(BANFF_ELITE_URL
      ? [{ key: "custom", href: BANFF_ELITE_URL, image: pick("multiday").image, title: "Custom Rockies Journeys", description: "A private itinerary shaped around your dates, pace and interests by our sister company, Banff Elite.", cta: "Plan with Banff Elite ↗" }]
      : []),
    { key: "tickets", ...pick("tickets"), title: "Attraction Tickets", description: "Add a gondola ride, lake cruise or another memorable experience to your Rockies visit.", cta: "Explore Attraction Tickets" },
  ];

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      {/* Hero */}
      <section data-nav-hero className="relative isolate flex min-h-[36rem] flex-col justify-end overflow-hidden bg-obsidian-950 text-white sm:min-h-[42rem] lg:min-h-[82vh]">
        {service && (
          <div className="absolute inset-0 -z-10">
            <Image src={service.image} alt="" fill priority sizes="100vw" className="object-cover" data-parallax="10" />
            {service.video && (
              <AmbientVideo src={service.video.src} srcHd={service.video.srcHd} poster={service.video.poster} className="absolute inset-0 h-full w-full object-cover" once />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ocean-950 via-ocean-950/50 to-ocean-950/15" />
            <div className="absolute inset-0 bg-gradient-to-r from-ocean-950/55 to-transparent" />
          </div>
        )}

        <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-page pt-[calc(var(--vc-nav-open-h,100px)+1.5rem)] text-center" data-scroll-fade>
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center justify-center gap-1.5 text-sm text-slate-200">
              <li>
                <Link href="/" className="hover:text-white hover:underline">Home</Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="text-white">Small-group tours</li>
            </ol>
          </nav>

          <p className="mb-4 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full bg-white/15 px-3.5 py-1.5 text-xs text-white ring-1 ring-white/20 backdrop-blur-md sm:text-sm motion-safe:animate-[fadeUp_700ms_ease-out]">
            <span className="flex items-center gap-0.5 text-summit-400" aria-label="Five stars">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              ))}
            </span>
            {SHARED_HERO.reviews}
          </p>

          <h1 className="mx-auto max-w-4xl text-balance text-[clamp(2.25rem,9vw,2.75rem)] font-light leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl motion-safe:animate-[fadeUp_900ms_ease-out]">
            {SHARED_HERO.title}
          </h1>
          <p className="mt-4 text-sm uppercase tracking-[0.3em] text-summit-300 sm:text-base motion-safe:animate-[fadeUp_1000ms_ease-out]">
            {SHARED_HERO.kicker}
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-base font-light leading-relaxed text-slate-100 sm:text-lg motion-safe:animate-[fadeUp_1100ms_ease-out]">
            {SHARED_HERO.lede}
          </p>
          <Link href="#tours" className="golden-summit-btn mt-7 inline-flex h-12 items-center gap-2 rounded-full px-7 text-base motion-safe:animate-[fadeUp_1300ms_ease-out]">
            {SHARED_HERO.cta}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-10 border-t border-white/10 bg-obsidian-950/35 backdrop-blur-md sm:mt-12">
          <ul
            aria-label="Why choose a small-group tour"
            tabIndex={0}
            className="vc-rail mx-auto flex max-w-7xl snap-x snap-mandatory gap-3 overflow-x-auto px-page py-4 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-summit-400 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:py-5"
          >
            {SHARED_HERO.chips.map((chip, i) => {
              const Icon = CHIP_ICONS[i] ?? Check;
              return (
                <li key={chip} className="flex shrink-0 snap-start items-center gap-3 rounded-full bg-white/10 py-2 pl-2 pr-4 ring-1 ring-white/15 lg:rounded-none lg:bg-transparent lg:p-0 lg:ring-0">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-summit-500/20 text-summit-400">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm leading-snug text-white lg:text-base">{chip}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* One day or two: intro and stats */}
      <section aria-labelledby="intro-heading" className="border-b border-obsidian-900/[0.06] bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-page py-12 sm:py-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
          <div data-reveal>
            <h2 id="intro-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-obsidian-900 sm:text-4xl">
              {SHARED_INTRO.title}
            </h2>
            <p className="mt-4 text-lg font-light leading-relaxed text-slate-700">{SHARED_INTRO.body}</p>
            <p className="mt-3 flex gap-2 text-sm text-slate-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
              {SHARED_INTRO.note}
            </p>
          </div>
          <dl className="grid grid-cols-2 justify-items-center gap-x-6 gap-y-8 sm:grid-cols-4 lg:grid-cols-2" data-stagger>
            {SHARED_INTRO.stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse items-center justify-end text-center">
                <dt className="mt-1 text-sm text-slate-600">{s.label}</dt>
                <dd className="text-3xl font-light tabular-nums text-obsidian-900">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Three ways to explore */}
      <section id="tours" aria-labelledby="tours-heading" className="scroll-mt-24 bg-obsidian-950 text-white">
        <div className="mx-auto max-w-7xl px-page py-16 sm:py-24">
          <SectionHeading
            id="tours-heading"
            eyebrow="Three ways to explore"
            title="Find Your Rockies Adventure"
            intro="Discover Banff and Yoho, experience the Icefields Parkway and Columbia Icefield, or enjoy both with one easy two-day booking."
            tone="dark"
          />
          <ul className="grid items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3" data-stagger>
            <li className="flex">
              <DayCard tour={BANFF_YOHO} price={day1} award />
            </li>
            <li className="flex">
              <DayCard tour={ICEFIELD} price={day2} />
            </li>
            <li className="flex md:col-span-2 lg:col-span-1">
              <PackageCard {...packagePrice(day1, day2)} />
            </li>
          </ul>
        </div>
      </section>

      {/* Benefits that apply to all three */}
      <section aria-label="Why travel with us" className="border-b border-obsidian-900/[0.06] bg-white">
        <ul className="mx-auto grid max-w-7xl gap-8 px-page py-14 sm:grid-cols-2 sm:py-16 lg:grid-cols-4" data-stagger>
          {SHARED_BENEFITS.map((b, i) => {
            const Icon = BENEFIT_ICONS[i] ?? Check;
            return (
              <li key={b.title} className="flex flex-col items-center text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-summit-200 text-obsidian-900">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg text-obsidian-900">{b.title}</h3>
                <p className="mt-2 max-w-xs text-base leading-relaxed text-slate-600">{b.body}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {reviews.length > 0 && (
        <section aria-labelledby="reviews-heading" className="overflow-hidden py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-page">
            <SectionHeading id="reviews-heading" eyebrow="Guest reviews" title="What guests say" />
            <ReviewSlider reviews={reviews} />
          </div>
        </section>
      )}

      {/* Before you book */}
      <section aria-labelledby="faq-heading" className="border-t border-obsidian-900/[0.06] bg-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-page lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
          <div data-reveal>
            <p className="mb-3 text-sm uppercase tracking-[0.22em] text-ocean-600">Good to know</p>
            <h2 id="faq-heading" className="text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl">
              Before You Book
            </h2>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-slate-600">
              Find answers about our small-group tours, pickup arrangements and two-day package. Need help choosing? Contact our team.
            </p>
            <Link href="/contact-us" className="mt-5 inline-flex h-11 items-center gap-2 rounded-full border border-obsidian-900/10 px-5 text-sm text-obsidian-900 hover:bg-obsidian-50">
              Contact Us <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <FaqBrowser compact topics={[]} items={SHARED_FAQS.map((f) => ({ ...f, topic: "" }))} />
        </div>
      </section>

      {/* Other ways to explore */}
      <section aria-labelledby="others-heading" className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-page">
          <SectionHeading id="others-heading" eyebrow="Keep exploring" title="Other Ways to Explore" />
          <ul className={`grid gap-5 sm:grid-cols-2 ${others.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`} data-stagger>
            {others.map((o) => (
              <li key={o.key} className="flex">
                <MediaCard
                  href={o.href}
                  image={o.image}
                  sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 22rem"
                  title={o.title}
                  description={o.description}
                  cta={o.cta}
                  clampDescription
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Closing call to action */}
      <section aria-labelledby="closing-heading" className="bg-obsidian-950 text-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-page py-16 text-center sm:py-24" data-reveal>
          <p className="mb-3 text-sm uppercase tracking-[0.22em] text-summit-300">{SHARED_CLOSING.eyebrow}</p>
          <h2 id="closing-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-white sm:text-5xl">
            {SHARED_CLOSING.title}
          </h2>
          <p className="mt-5 max-w-2xl text-lg font-light leading-relaxed text-white/80">{SHARED_CLOSING.body}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="#tours" className="golden-summit-btn inline-flex h-12 items-center gap-2 rounded-full px-7 text-base">
              Choose Your Tour <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/contact-us" className="inline-flex h-12 items-center gap-2 rounded-full px-7 text-base text-white ring-1 ring-white/30 hover:bg-white/10">
              Help Me Choose <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-8 flex flex-col items-center gap-3 text-base text-white/80 sm:flex-row sm:gap-8">
            <a href={SHARED_CLOSING.phone.href} className="inline-flex items-center gap-2 hover:text-white">
              <Phone className="h-4 w-4 text-summit-300" aria-hidden="true" />
              Call {SHARED_CLOSING.phone.label}
            </a>
            <a href={SHARED_CLOSING.email.href} className="inline-flex items-center gap-2 hover:text-white">
              <Mail className="h-4 w-4 text-summit-300" aria-hidden="true" />
              Email {SHARED_CLOSING.email.label}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function pick(id: Parameters<typeof serviceById>[0]) {
  const s = serviceById(id);
  return { href: s?.href ?? "/search", image: s?.image ?? "/media/photos/moraine-lake-classic.webp" };
}

/** Duration, group size and pickup: the same three facts on every card. */
function Facts({ duration }: { duration: string }) {
  return (
    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-white/75" aria-label="Key details">
      <li className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-summit-300" aria-hidden="true" />
        {duration}
      </li>
      <li className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-summit-300" aria-hidden="true" />
        Max 12 guests
      </li>
      <li className="flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 text-summit-300" aria-hidden="true" />
        Pickup in Banff &amp; Canmore
      </li>
    </ul>
  );
}

function Price({ price, unit = "CAD/guest" }: { price: number; unit?: string }) {
  return (
    <div className="min-w-0">
      {hasPrice(price) ? (
        <>
          <PriceTag price={price} currency="CAD" unit={unit} size="sm" tone="dark" layout="inline" />
          <p className="mt-0.5 text-xs text-white/55">Taxes and required fees included</p>
        </>
      ) : (
        <p className="text-sm text-white/70">Price on request</p>
      )}
    </div>
  );
}

/** Package price: struck through is what the two days cost booked separately, not a markup. */
export function PackagePrice({ price, separate, size = "sm" }: { price: number; separate: number; size?: "sm" | "lg" }) {
  if (!hasPrice(price)) return <p className="text-sm text-white/70">Price on request</p>;
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-baseline gap-x-1.5 whitespace-nowrap">
        <span className="text-xs text-white/55">From</span>
        <s className="text-sm text-slate-300">
          <span className="sr-only">Booked separately </span>
          {money(separate)}
        </s>
        <span className={`${size === "lg" ? "text-4xl" : "text-xl"} text-white`}>{money(price)}</span>
        <span className="text-sm text-slate-300">CAD/guest</span>
      </p>
      <p className="mt-0.5 text-xs text-white/55">Both tours, 10% off · Taxes and required fees included</p>
    </div>
  );
}

function CardButton({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="golden-summit-btn mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm uppercase tracking-[0.12em]">
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function Itinerary({ days }: { days: DayTour[] }) {
  return (
    <details className="group/plan mt-4 border-t border-white/[0.08] pt-2.5">
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 text-xs uppercase tracking-[0.16em] text-white/75 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-summit-300 [&::-webkit-details-marker]:hidden">
        Itinerary &amp; pickup
        <ChevronDown className="h-4 w-4 transition-transform duration-300 group-open/plan:rotate-180" aria-hidden="true" />
      </summary>
      {days.map((d, i) => (
        <div key={d.slug} className="mt-3">
          <h4 className="text-xs uppercase tracking-[0.2em] text-white/50">{days.length > 1 ? `Day ${i + 1}: ${d.title}` : "Planned stops"}</h4>
          <ul className="mt-2 space-y-1 text-sm text-white/85">
            {d.stops.map((s) => (
              <li key={s} className="flex gap-2">
                <MapPin className="mt-1 h-3.5 w-3.5 shrink-0 text-summit-300" aria-hidden="true" />
                {s}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-white/60">{d.lunch}</p>
          {days.length === 1 && (
            <>
              <h4 className="mt-4 text-xs uppercase tracking-[0.2em] text-white/50">Included</h4>
              <ul className="mt-2 space-y-1 text-sm text-white/70">
                {d.included.map((x) => (
                  <li key={x} className="flex gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-summit-300" aria-hidden="true" />
                    {x}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ))}
      <h4 className="mt-4 text-xs uppercase tracking-[0.2em] text-white/50">Pickup</h4>
      <p className="mt-1.5 text-sm text-white/70">
        {PICKUP_TIMES}{" "}
        <Link href="/pickup-finder" className="text-summit-200 underline decoration-summit-200/40 underline-offset-4 hover:decoration-summit-200">
          Find your pickup point
        </Link>
      </p>
      <p className="mt-2 text-xs text-white/50">Stops and their order may change with the season, weather and road conditions.</p>
    </details>
  );
}

function DayCard({ tour, price, award = false }: { tour: DayTour; price: number; award?: boolean }) {
  return (
    <article className="flex w-full flex-col">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-obsidian-900">
        <Image src={tour.image} alt={tour.imageAlt} fill sizes="(max-width: 768px) 92vw, (max-width: 1024px) 46vw, 400px" className="object-cover" />
        {award && (
          <a
            href="https://www.tripadvisor.ca/TravelersChoice-ThingsToDo-cTopExperiences-g153339#6"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute left-3 top-3 block w-40 rounded-md bg-white px-2.5 py-1.5 shadow-lg sm:w-44"
            aria-label="Tripadvisor Travellers' Choice Best of the Best 2026 (opens in a new tab)"
          >
            <Image src="/media/badges/tripadvisor-best-of-the-best-2026.png" alt="" width={1000} height={392} className="h-auto w-full" />
          </a>
        )}
      </div>
      <div className={CARD_PANEL}>
        <p className={CARD_EYEBROW}>{tour.label}</p>
        <h3 className="text-lg font-normal uppercase leading-snug tracking-[0.14em] text-white">{tour.title}</h3>
        <p className="mt-1 text-xs text-summit-300 tracking-wide font-light">{tour.highlight}</p>
        <p className="mt-2 text-sm leading-relaxed text-white/75">{tour.description}</p>
        <Facts duration={tour.duration} />
        <p className="mt-2 flex gap-1.5 text-sm text-summit-200">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {tour.keyNote}
        </p>
        <Itinerary days={[tour]} />
        <div className="mt-auto border-t border-white/[0.08] pt-4">
          <Price price={price} />
          <CardButton href={`/${tour.slug}`} label={tour.button} />
        </div>
      </div>
    </article>
  );
}

function PackageCard({ price, separate }: { price: number; separate: number }) {
  return (
    <article className="flex w-full flex-col">
      <div className="relative grid aspect-[4/3] w-full grid-cols-2 gap-0.5 overflow-hidden bg-obsidian-900 md:aspect-[8/3] lg:aspect-[4/3]">
        {TWO_DAY_PACKAGE.images.map((img) => (
          <div key={img.src} className="relative">
            <Image src={img.src} alt={img.alt} fill sizes="(max-width: 768px) 46vw, 200px" className="object-cover" />
          </div>
        ))}
        <span className="absolute left-3 top-3 bg-summit-200 px-2.5 py-1 text-[0.7rem] uppercase tracking-[0.12em] text-obsidian-900">{TWO_DAY_PACKAGE.saving}</span>
      </div>
      <div className={CARD_PANEL}>
        <p className={CARD_EYEBROW}>{TWO_DAY_PACKAGE.label}</p>
        <h3 className="text-lg font-normal uppercase leading-snug tracking-[0.14em] text-white">{TWO_DAY_PACKAGE.title}</h3>
        <p className="mt-1 text-xs text-summit-300 tracking-wide font-light">{TWO_DAY_PACKAGE.highlight}</p>
        <p className="mt-2 text-sm leading-relaxed text-white/75">{TWO_DAY_PACKAGE.description}</p>
        <Facts duration={TWO_DAY_PACKAGE.duration} />
        <p className="mt-2 flex gap-1.5 text-sm text-summit-200">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {TWO_DAY_PACKAGE.keyNote}
        </p>
        <Itinerary days={TWO_DAY_PACKAGE.days} />
        <div className="mt-auto border-t border-white/[0.08] pt-4">
          <PackagePrice price={price} separate={separate} />
          <CardButton href={TWO_DAY_PACKAGE.href} label={TWO_DAY_PACKAGE.button} />
        </div>
      </div>
    </article>
  );
}

