"use client";

// Product page body laid out like Viator: a sticky "On this page" bar (Overview, What's included,
// What to expect, Meeting & pickup, Additional info, Cancellation policy, FAQ, Reviews) over
// stacked sections, so everything can be scanned and linked. Content comes from the catalog
// imported from the live product pages (tour.tabs, inclusions, faqs).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Car, Check, CheckCircle2, ChevronDown, Clock, MapPin, Star, X } from "lucide-react";
import type { TourSection, TourWithAvailability } from "@/lib/api/types";

interface Review {
  id: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  date: string;
}

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "whats-included", label: "What's included" },
  { id: "what-to-expect", label: "What to expect" },
  { id: "meeting-pickup", label: "Meeting & pickup" },
  { id: "additional-info", label: "Additional info" },
  { id: "cancellation-policy", label: "Cancellation policy" },
  { id: "faq", label: "FAQ" },
  { id: "reviews", label: "Reviews" },
] as const;

const tab = (tour: TourWithAvailability, labels: RegExp) => tour.tabs.find((t) => labels.test(t.label));

function SectionBlock({ section, level = 3 }: { section: TourSection; level?: 3 | 4 }) {
  const Heading = level === 3 ? "h3" : "h4";
  return (
    <div className="space-y-4">
      {section.heading && <Heading className="text-xl font-light text-obsidian-900">{section.heading}</Heading>}
      {section.body.map((paragraph) => (
        <p key={paragraph} className="whitespace-pre-line text-base leading-relaxed text-slate-700">
          {paragraph}
        </p>
      ))}
      {section.items.length > 0 && (
        <ul className="space-y-2 text-base text-slate-700">
          {section.items.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <Check className="mt-1 h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {section.stops.length > 0 && (
        <ol className="space-y-3">
          {section.stops.map((stop, i) => (
            <li key={stop.name} className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ocean-600 text-sm text-white" aria-hidden="true">
                {i + 1}
              </span>
              <span className="space-y-1">
                <span className="flex items-center gap-1.5 text-lg font-light text-obsidian-900">
                  <MapPin className="h-4 w-4 text-ocean-600" aria-hidden="true" />
                  {stop.name}
                </span>
                <span className="block text-base leading-relaxed text-slate-600">{stop.text}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {section.steps.length > 0 && (
        <ol className="relative ml-2 space-y-5 border-l-2 border-ocean-500/30">
          {section.steps.map((step) => (
            <li key={`${step.time}-${step.text}`} className="relative pl-6">
              <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-ocean-600" aria-hidden="true" />
              <span className="block text-sm uppercase tracking-widest text-ocean-600">{step.time || "Then"}</span>
              <p className="whitespace-pre-line text-base text-slate-700">{step.text}</p>
            </li>
          ))}
        </ol>
      )}
      {section.note && <p className="text-sm italic text-slate-600">Note: {section.note}</p>}
    </div>
  );
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={`${id}-heading`} className="text-3xl font-light text-obsidian-900">
      {children}
    </h2>
  );
}

export function TourSections({ tour }: { tour: TourWithAvailability }) {
  const [active, setActive] = useState<string>("overview");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [reviews, setReviews] = useState<Review[] | null>(null);

  const isTicket = tour.category === "TICKET";
  const isPrivate = tour.category === "PRIVATE" || tour.category === "MULTIDAY";

  const overview = tab(tour, /^overview$/i);
  const seeTab = tab(tour, /^(inclusions|selection)$/i);
  const itinerary = tab(tour, /^(itinerary|process)$/i);
  const seasonal = tab(tour, /^seasonal$/i);
  const overviewSections = (overview?.sections ?? []).filter((s) => !/price (in|ex)cludes/i.test(s.heading));
  const pickupStep = itinerary?.sections.flatMap((s) => s.steps).find((s) => /pick ?up/i.test(s.text));

  // Highlight the section in view in the sticky bar.
  useEffect(() => {
    const targets = SECTIONS.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => !!el);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-35% 0px -55% 0px" }
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);

  // Reviews left by guests who booked this tour (backend /api/reviews).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reviews?tourId=${encodeURIComponent(tour.id)}`)
      .then((r) => (r.ok ? r.json() : { reviews: [] }))
      .then((d) => !cancelled && setReviews(d.reviews ?? []))
      .catch(() => !cancelled && setReviews([]));
    return () => {
      cancelled = true;
    };
  }, [tour.id]);

  const nav = useMemo(
    () => (
      <nav
        aria-label="On this page"
        className="sticky z-30 -mx-4 border-y border-slate-200 bg-obsidian-50/95 px-4 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border"
        style={{ top: "var(--vc-header-h, 0px)" }}
      >
        <ul className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none]">
          {SECTIONS.map((s) => (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                aria-current={active === s.id ? "location" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean-600 ${
                  active === s.id ? "bg-obsidian-900 text-white" : "text-slate-700 hover:bg-obsidian-900/5"
                }`}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    ),
    [active]
  );

  return (
    <div className="space-y-14">
      {nav}

      <section id="overview" aria-labelledby="overview-heading" className="space-y-6">
        <SectionHeading id="overview">Overview</SectionHeading>
        {tour.description && <p className="whitespace-pre-line text-lg font-light leading-relaxed text-slate-700">{tour.description}</p>}
        {tour.highlights.length > 0 && (
          <ul className="grid gap-3 rounded-3xl border border-slate-200/80 bg-white p-6 sm:grid-cols-2" aria-label="Highlights">
            {tour.highlights.map((h) => (
              <li key={h} className="flex items-start gap-3 text-base text-slate-800">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ocean-600" aria-hidden="true" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        )}
        {overviewSections.slice(1).map((s, i) => (
          <SectionBlock key={`${s.heading}-${i}`} section={s} />
        ))}
      </section>

      <section id="whats-included" aria-labelledby="whats-included-heading" className="space-y-6">
        <SectionHeading id="whats-included">What&apos;s included</SectionHeading>
        <div className="grid gap-6 sm:grid-cols-2">
          <ul className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-6" aria-label="Included">
            {tour.inclusions.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-base text-slate-800">
                <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {tour.exclusions.length > 0 && (
            <ul className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-6" aria-label="Not included">
              {tour.exclusions.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-base text-slate-600">
                  <X className="mt-1 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section id="what-to-expect" aria-labelledby="what-to-expect-heading" className="space-y-8">
        <SectionHeading id="what-to-expect">What to expect</SectionHeading>
        {seeTab?.sections.map((s, i) => <SectionBlock key={`see-${i}`} section={s} />)}
        {itinerary?.sections.map((s, i) => <SectionBlock key={`itin-${i}`} section={s} />)}
        {!seeTab && !itinerary && <p className="text-base text-slate-700">Your guide shares the plan for the day at pickup.</p>}
      </section>

      <section id="meeting-pickup" aria-labelledby="meeting-pickup-heading" className="space-y-4">
        <SectionHeading id="meeting-pickup">Meeting &amp; pickup</SectionHeading>
        <div className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-6 text-base text-slate-700">
          {isTicket ? (
            <p>
              Meet at the attraction on your date, or add transport by booking a Vista Chase tour on the same day. We send the
              details with your confirmation.
            </p>
          ) : (
            <>
              <p className="flex items-start gap-2.5">
                <MapPin className="mt-1 h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
                <span>{pickupStep?.text ?? "Pickup from hotels in Banff and Canmore."}</span>
              </p>
              {pickupStep?.time && (
                <p className="flex items-start gap-2.5">
                  <Clock className="mt-1 h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
                  <span>Pickup window: {pickupStep.time}. Your exact time is confirmed the day before.</span>
                </p>
              )}
            </>
          )}
          <Link href="/pickup-finder" className="inline-flex min-h-11 items-center gap-1.5 text-ocean-600 underline underline-offset-4">
            Find your hotel&apos;s pickup point
          </Link>
        </div>
      </section>

      <section id="additional-info" aria-labelledby="additional-info-heading" className="space-y-6">
        <SectionHeading id="additional-info">Additional info</SectionHeading>
        {tour.facts.length > 0 && (
          <dl className="grid gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 sm:grid-cols-2">
            {tour.facts.map((f) => (
              <div key={f.label}>
                <dt className="text-sm uppercase tracking-widest text-slate-600">{f.label}</dt>
                <dd className="text-lg font-light text-obsidian-900">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {isPrivate && tour.vehicleOptions.length > 0 && (
          <p className="flex items-start gap-2.5 text-base text-slate-700">
            <Car className="mt-1 h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
            <span>Your private vehicle: {tour.vehicleOptions.map((v) => `${v.label} for up to ${v.seats}`).join(" or ")}.</span>
          </p>
        )}
        {seasonal?.sections.map((s, i) => <SectionBlock key={`season-${i}`} section={s} />)}
      </section>

      <section id="cancellation-policy" aria-labelledby="cancellation-policy-heading" className="space-y-4">
        <SectionHeading id="cancellation-policy">Cancellation policy</SectionHeading>
        <div className="space-y-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-base text-emerald-900">
          <p className="flex items-start gap-2.5 text-lg">
            <CheckCircle2 className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Free cancellation up to 24 hours before your experience, with a full refund.</span>
          </p>
          <p>Cancellations made less than 24 hours before the start time are not refundable.</p>
          <Link href="/privacy-policy-vista-chase" className="inline-flex min-h-11 items-center underline underline-offset-4">
            Read the full cancellation policy
          </Link>
        </div>
      </section>

      {tour.faqs.length > 0 && (
        <section id="faq" aria-labelledby="faq-heading" className="space-y-6">
          <SectionHeading id="faq">Frequently asked questions</SectionHeading>
          <div className="space-y-3">
            {tour.faqs.map((faq, idx) => (
              <div key={faq.question} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    aria-expanded={openFaq === idx}
                    aria-controls={`faq-answer-${idx}`}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left text-base text-slate-900 hover:text-ocean-600 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ocean-600"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${openFaq === idx ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                </h3>
                <div id={`faq-answer-${idx}`} hidden={openFaq !== idx} className="whitespace-pre-line border-t border-slate-100 px-5 pb-5 pt-3 text-base leading-relaxed text-slate-700">
                  {faq.answer}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="reviews" aria-labelledby="reviews-heading" className="space-y-6">
        <SectionHeading id="reviews">Reviews</SectionHeading>
        {tour.reviewCount > 0 && (
          <p className="flex items-center gap-2 text-lg font-light text-obsidian-900">
            <Star className="h-5 w-5 fill-summit-500 text-summit-500" aria-hidden="true" />
            {tour.rating.toFixed(1)}
            <span className="sr-only"> out of 5</span>
            <span className="text-slate-600">
              · {tour.reviewCount >= 1000 ? `${tour.reviewCount.toLocaleString("en-CA")}+ reviews across TripAdvisor and Google` : `${tour.reviewCount} ${tour.reviewCount === 1 ? "review" : "reviews"}`}
            </span>
          </p>
        )}
        {reviews && reviews.length > 0 ? (
          <ul className="space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="space-y-2 rounded-3xl border border-slate-200 bg-white p-6">
                <p className="flex items-center gap-1" aria-label={`${r.rating} out of 5`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-summit-500 text-summit-500" : "text-slate-300"}`} aria-hidden="true" />
                  ))}
                </p>
                <h3 className="text-lg font-light text-obsidian-900">{r.title}</h3>
                <p className="text-base leading-relaxed text-slate-700">{r.body}</p>
                <p className="text-sm text-slate-600">
                  {r.authorName} · {r.date}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          reviews && (
            <p className="text-base text-slate-700">
              {tour.reviewCount > 0 ? "Guest reviews for this tour will appear here after their trips." : "This is new on Vista Chase. Be one of the first to review it."}
            </p>
          )
        )}
      </section>
    </div>
  );
}
