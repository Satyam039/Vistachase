"use client";

// Product page body laid out like Viator: a sticky "On this page" bar (Overview, What's included,
// What to expect, Meeting & pickup, Additional info, Cancellation policy, FAQ, Reviews) over
// stacked sections, so everything can be scanned and linked. Content comes from the catalog
// imported from the live product pages (tour.tabs, inclusions, faqs).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Car, Check, CheckCircle2, Clock, MapPin, Plus, Star, X } from "lucide-react";
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


// Imported live-site copy packs several lines into one paragraph ("Doorstep Pickup – we collect
// you…"). Split it into real paragraphs; runs of "Label – text" lines become a list.
const LABELLED = /^([^–—:\n]{2,48})\s[–—-]\s(.+)$/;
function Prose({ text, className = "text-base leading-relaxed text-slate-700" }: { text: string; className?: string }) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const blocks: (string | [string, string][])[] = [];
  for (const line of lines) {
    const m = line.match(LABELLED);
    const last = blocks[blocks.length - 1];
    if (m) {
      if (Array.isArray(last)) last.push([m[1], m[2]]);
      else blocks.push([[m[1], m[2]]]);
    } else blocks.push(line);
  }
  return (
    <>
      {blocks.map((b, i) =>
        typeof b === "string" ? (
          <p key={i} className={className}>
            {b}
          </p>
        ) : (
          <ul key={i} className="space-y-3">
            {b.map(([label, body]) => (
              <li key={label} className="flex items-start gap-3 text-base leading-relaxed text-slate-700">
                <Check className="mt-1 h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
                <span>
                  <span className="text-obsidian-900">{label}</span> · {body}
                </span>
              </li>
            ))}
          </ul>
        ),
      )}
    </>
  );
}

const tab = (tour: TourWithAvailability, labels: RegExp) => tour.tabs.find((t) => labels.test(t.label));

function SectionBlock({ section, level = 3 }: { section: TourSection; level?: 3 | 4 }) {
  const Heading = level === 3 ? "h3" : "h4";
  return (
    <div className="space-y-4">
      {section.heading && <Heading className="text-xl font-light text-obsidian-900">{section.heading}</Heading>}
      {section.body.map((paragraph) => (
        <Prose key={paragraph} text={paragraph} />
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


  return (
    <div className="space-y-14">

      <section id="overview" aria-labelledby="overview-heading" className="space-y-6">
        <SectionHeading id="overview">Overview</SectionHeading>
        {tour.description && (
          <div className="space-y-4">
            <Prose text={tour.description} className="text-lg font-light leading-relaxed text-slate-700" />
          </div>
        )}
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
        {isTicket ? (
          <div className="space-y-3 rounded-[1.75rem] bg-white p-6 text-base text-slate-700 ring-1 ring-obsidian-900/[0.07]">
            <p>Tickets are run by the attraction operator and follow their own cancellation rules, which we confirm with your request.</p>
            <Link href="/cancellation-policy" className="inline-flex min-h-11 items-center text-ocean-700 underline underline-offset-4">
              Read our cancellation policy
            </Link>
          </div>
        ) : (
          <div className="space-y-3 rounded-[1.75rem] bg-emerald-50 p-6 text-base text-emerald-950 ring-1 ring-emerald-200">
            <p className="flex items-start gap-2.5 text-lg">
              <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
              <span>
                {tour.category === "MULTIDAY"
                  ? "Cancel at least 72 hours before your trip for a refund of everything except the 20% non-refundable deposit."
                  : "Cancel at least 72 hours before your tour for a full refund (groups of 1–6)."}
              </span>
            </p>
            <ul className="list-disc space-y-1.5 pl-6">
              {tour.category !== "MULTIDAY" && <li>Groups of 7 or more: the 20% deposit is non-refundable; the rest is refunded.</li>}
              <li>Within 72 hours of the start time, cancellations aren&rsquo;t refunded.</li>
              <li>Arriving 10 or more minutes late, or not showing up, is fully charged.</li>
              <li>Approved refunds reach your original payment method within 5–10 business days.</li>
            </ul>
            <Link href="/cancellation-policy" className="inline-flex min-h-11 items-center underline underline-offset-4">
              Read the full cancellation policy
            </Link>
          </div>
        )}
      </section>

      {tour.faqs.length > 0 && (
        <section id="faq" aria-labelledby="faq-heading" className="space-y-6">
          <SectionHeading id="faq">Frequently asked questions</SectionHeading>
          {/* Accordion: answers open with a height transition (grid rows 0fr → 1fr); a closed
              answer is inert, so it is skipped by keyboard and screen readers. */}
          <div className="space-y-3">
            {tour.faqs.map((faq, idx) => {
              const open = openFaq === idx;
              return (
                <div
                  key={faq.question}
                  className={`rounded-2xl border bg-white transition-[border-color,box-shadow] duration-300 ${
                    open ? "border-ocean-600/40 shadow-[0_18px_40px_-28px_rgba(12,31,33,0.45)]" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : idx)}
                      aria-expanded={open}
                      aria-controls={`faq-answer-${idx}`}
                      className="group flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left text-base text-slate-900 sm:px-6 sm:py-5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ocean-600"
                    >
                      <span className={open ? "text-obsidian-900" : "group-hover:text-ocean-700"}>{faq.question}</span>
                      <span
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-300 ${
                          open ? "rotate-45 bg-obsidian-900 text-white" : "bg-obsidian-900/[0.05] text-obsidian-900 group-hover:bg-obsidian-900/10"
                        }`}
                        aria-hidden="true"
                      >
                        <Plus className="h-4 w-4" />
                      </span>
                    </button>
                  </h3>
                  <div
                    id={`faq-answer-${idx}`}
                    role="region"
                    aria-label={faq.question}
                    inert={!open}
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                  >
                    <div className="overflow-hidden">
                      <p className="whitespace-pre-line px-5 pb-5 text-base leading-relaxed text-slate-700 sm:px-6 sm:pb-6">{faq.answer}</p>
                    </div>
                  </div>
                </div>
              );
            })}
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
                <p className="flex items-center gap-1" role="img" aria-label={`${r.rating} out of 5`}>
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

/**
 * Sticky "On this page" bar for the product sections (Viator / Expedia tab bar). Rendered by
 * TourDetailView across the full content width, so all sections fit and the pills share the
 * width edge to edge; on narrow screens it scrolls sideways and keeps the active pill in view.
 */
export function TourSectionNav() {
  const [active, setActive] = useState<string>("overview");

  // Highlight the section in view in the sticky bar: the last section whose top has passed
  // 40% of the viewport (scroll-based, so instant jumps and fast scrolling are caught too).
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = window.innerHeight * 0.4;
      let current: string = SECTIONS[0].id;
      for (const { id } of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Keep the active pill visible inside the horizontally scrolling bar (it can sit off to the side).
  const navList = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = navList.current;
    const pill = list?.querySelector<HTMLElement>(`a[href="#${active}"]`);
    if (!list || !pill) return;
    const target = pill.offsetLeft - (list.clientWidth - pill.offsetWidth) / 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({ left: Math.max(0, target), behavior: reduce ? "auto" : "smooth" });
  }, [active]);

  return (
      <nav
        aria-label="On this page"
        // Solid surface + shadow so content scrolling underneath never shows at its edges.
        className="sticky z-30 -mx-page mb-10 border-b border-obsidian-900/[0.08] bg-obsidian-50 px-page shadow-[0_12px_24px_-20px_rgba(12,31,33,0.45)] sm:mx-0 sm:rounded-full sm:border sm:bg-white sm:px-1.5"
        style={{ top: "calc(var(--vc-header-h, 0px) + 16px)" }} // 16px below the navbar
      >
        <ul
          ref={navList}
          className="vc-rail flex w-full gap-1 overflow-x-auto py-1.5 [mask-image:linear-gradient(90deg,transparent,#000_1.5rem,#000_calc(100%-1.5rem),transparent)] sm:[mask-image:none]"
        >
          {SECTIONS.map((s) => (
            <li key={s.id} className="flex-1 shrink-0">
              <a
                href={`#${s.id}`}
                onClick={() => setActive(s.id)}
                aria-current={active === s.id ? "location" : undefined}
                className={`flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-full px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ocean-600 ${
                  active === s.id ? "bg-obsidian-900 text-white" : "text-slate-700 hover:bg-obsidian-900/[0.06] hover:text-obsidian-900"
                }`}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
  );
}
