import { ArrowUpRight, Award, Star } from "lucide-react";
import { ReviewSlider, type SliderReview } from "@/components/reviews/ReviewSlider";

const TRIPADVISOR_URL =
  "https://www.tripadvisor.ca/Attraction_Review-g154911-d26518659-Reviews-Vista_Chase-Banff_Banff_National_Park_Alberta.html";

// Review wall (TripAdvisor / Civitatis pattern): the score summary on the left (Vista Chase's
// rating and review count across TripAdvisor and Google, as published on the live site), and
// beside it a slider of real reviews guests left against a Vista Chase booking. Until there are
// some, that slot points to the reviews on TripAdvisor instead. No quotes are written for guests.
export function GuestTestimonials({ reviews }: { reviews: SliderReview[] }) {
  return (
    <section aria-labelledby="reviews-heading" className="overflow-hidden bg-obsidian-950 py-20 text-white sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-page lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-16">
        <div data-reveal>
          <p className="mb-3 text-sm uppercase tracking-[0.22em] text-summit-300">Guest reviews</p>
          <h2 id="reviews-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-white sm:text-4xl">
            Stories from the Rockies
          </h2>
          <div className="mt-8 flex items-end gap-4">
            <span className="text-7xl font-light leading-none tabular-nums">5.0</span>
            <span className="pb-1.5">
              <span className="flex gap-0.5" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-4 w-4 fill-summit-500 text-summit-500" />
                ))}
              </span>
              <span className="mt-1 block text-sm text-slate-300">
                <span className="sr-only">out of 5, </span>from 1,000+ reviews
              </span>
            </span>
          </div>
          <p className="mt-6 inline-flex items-center gap-2 text-sm text-slate-300">
            <Award className="h-4 w-4 text-summit-400" aria-hidden="true" />
            Travellers&rsquo; Choice Best of the Best 2025
          </p>
          <a
            href={TRIPADVISOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 flex w-fit items-center gap-2 border-b border-summit-500 pb-1 text-base"
          >
            Read all reviews on TripAdvisor
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>

        <div className="min-w-0 self-center">
          {reviews.length > 0 ? (
            <ReviewSlider reviews={reviews} tone="dark" />
          ) : (
            <a
              href={TRIPADVISOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-4 rounded-[1.75rem] bg-white/[0.05] p-8 ring-1 ring-white/10 transition-colors hover:bg-white/[0.08] sm:p-10"
            >
              <span className="flex gap-0.5" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-5 w-5 fill-summit-500 text-summit-500" />
                ))}
              </span>
              <span className="text-2xl font-light leading-snug text-white sm:text-3xl">
                Read what 1,000+ guests say about their day with Vista Chase
              </span>
              <span className="inline-flex items-center gap-2 text-base text-summit-200">
                Reviews on TripAdvisor
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
