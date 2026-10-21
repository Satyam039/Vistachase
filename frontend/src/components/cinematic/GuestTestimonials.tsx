import { ArrowUpRight, Award, Star } from "lucide-react";
import { ReviewSlider, type SliderReview } from "@/components/reviews/ReviewSlider";

const TRIPADVISOR_URL =
  "https://www.tripadvisor.ca/Attraction_Review-g154911-d26518659-Reviews-Vista_Chase-Banff_Banff_National_Park_Alberta.html";

// Where guests can read the reviews themselves. GetYourGuide shows once its page address is known.
const REVIEW_PLATFORMS = [
  { label: "Tripadvisor Reviews", href: TRIPADVISOR_URL },
  { label: "Google Reviews", href: "https://www.google.com/maps/search/?api=1&query=Vista+Chase+Canmore+AB" },
  { label: "GetYourGuide Reviews", href: process.env.NEXT_PUBLIC_GETYOURGUIDE_REVIEWS_URL ?? "" },
].filter((p) => p.href);

// Review wall (TripAdvisor / Civitatis pattern): the summary on the left (review and guest
// counts from the owner's "Update Vista Chase web" doc, links to each review platform), and
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
                Read what guests say about their day with Vista Chase
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
