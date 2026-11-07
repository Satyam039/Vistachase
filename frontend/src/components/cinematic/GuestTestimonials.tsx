"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowUpRight, Award, Star } from "lucide-react";
import { ReviewSlider, type SliderReview } from "@/components/reviews/ReviewSlider";
import { REVIEW_EXCERPTS, TRIPADVISOR_REVIEWS } from "@/lib/reviews/tripadvisorReviews";

const TRIPADVISOR_URL =
  "https://www.tripadvisor.ca/Attraction_Review-g154911-d26518659-Reviews-Vista_Chase-Banff_Banff_National_Park_Alberta.html";

// Where guests can read the reviews themselves. GetYourGuide shows once its page address is known.
const REVIEW_PLATFORMS = [
  { label: "Tripadvisor Reviews", href: TRIPADVISOR_URL },
  { label: "Google Reviews", href: "https://www.google.com/maps/search/?api=1&query=Vista+Chase+Canmore+AB" },
  { label: "GetYourGuide Reviews", href: process.env.NEXT_PUBLIC_GETYOURGUIDE_REVIEWS_URL ?? "" },
].filter((p) => p.href);

// Review wall (TripAdvisor / Civitatis pattern): the summary on the left (review and guest
// counts from the owner's "Update Vista Chase web" doc, links to each review platform), beside it
// four short excerpts (guides, small groups, easy travel, pace) with the reviewer's name, platform,
// date and tour, and below a slider of full reviews: any guests left against a Vista Chase booking,
// then the Tripadvisor reviews the owner picked (lib/reviews, word for word, each linked to its source).
export function GuestTestimonials({ reviews }: { reviews: SliderReview[] }) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const [activeDot, setActiveDot] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    if (!card) return;
    const cardWidth = card.offsetWidth + 16; // 16px is gap-4
    const index = Math.round(el.scrollLeft / cardWidth);
    setActiveDot(Math.min(Math.max(0, index), REVIEW_EXCERPTS.length - 1));
  }, []);

  const scrollToCard = (index: number) => {
    const el = scrollRef.current;
    if (!el || !el.children[index]) return;
    const child = el.children[index] as HTMLElement;
    const paddingLeft = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    el.scrollTo({
      left: child.offsetLeft - paddingLeft,
      behavior: "smooth",
    });
  };

  return (
    <section aria-labelledby="reviews-heading" className="overflow-hidden bg-obsidian-950 py-20 text-white sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-page lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-16">
        <div data-reveal>
          <p className="mb-3 text-sm uppercase tracking-[0.22em] text-summit-300">Guest reviews</p>
          <h2 id="reviews-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-white sm:text-4xl">
            Stories from the Rockies
          </h2>
          <span className="mt-6 flex gap-0.5" role="img" aria-label="5 stars">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="h-5 w-5 fill-summit-500 text-summit-500" aria-hidden="true" />
            ))}
          </span>
          <p className="mt-3 text-2xl font-light text-white">1,700+ Reviews. 15,000+ Guests.</p>
          <p className="mt-4 text-base font-light leading-relaxed text-slate-300">
            Memorable places, passionate guides and experiences worth sharing. Read what guests say about their journey with Vista Chase.
          </p>
          <p className="mt-6 inline-flex items-center gap-2 text-sm text-slate-300">
            <Award className="h-4 w-4 text-summit-400" aria-hidden="true" />
            Travellers&rsquo; Choice Best of the Best 2026
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {REVIEW_PLATFORMS.map((p) => (
              <li key={p.label}>
                <a
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 border-b border-summit-500 pb-1 text-base text-white"
                >
                  {p.label}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div data-reveal className="min-w-0 self-center">
          <ul
            ref={scrollRef}
            onScroll={handleScroll}
            className="vc-rail -mx-page flex snap-x snap-mandatory gap-4 overflow-x-auto px-page pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0"
            aria-label="What guests say"
          >
            {REVIEW_EXCERPTS.map((x) => {
              const review = TRIPADVISOR_REVIEWS.find((r) => r.id === x.reviewId);
              if (!review) return null;
              return (
                <li
                  key={x.reviewId}
                  className="flex w-[82vw] max-w-[340px] shrink-0 snap-start flex-col rounded-none bg-white/[0.04] p-6 ring-1 ring-white/10 sm:w-auto sm:max-w-none sm:shrink"
                >
                  <p className="text-xs uppercase tracking-[0.22em] text-summit-300">{x.theme}</p>
                  <blockquote className="mt-3 flex-1 text-lg font-light leading-relaxed text-white">&ldquo;{x.excerpt}&rdquo;</blockquote>
                  <p className="mt-5 text-sm text-slate-300">
                    <span className="text-white">{review.authorName}</span> · {review.source?.label} · {review.date}
                  </p>
                  <p className="text-sm text-slate-400">{review.tourTitle}</p>
                  {review.source?.url && (
                    <a
                      href={review.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 self-start text-sm text-summit-200 underline underline-offset-4"
                    >
                      Read the full review
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Mobile swipe indicator dots */}
          <div className="mt-4 flex items-center justify-center gap-2 sm:hidden" aria-hidden="true">
            {REVIEW_EXCERPTS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollToCard(i)}
                aria-label={`Go to review ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 focus:outline-none ${
                  activeDot === i ? "w-6 bg-summit-400" : "w-1.5 bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-7xl px-page">
        <h3 className="mb-6 text-sm uppercase tracking-[0.22em] text-summit-300">More guest stories</h3>
        <ReviewSlider reviews={[...reviews, ...TRIPADVISOR_REVIEWS]} tone="dark" />
      </div>
    </section>
  );
}
