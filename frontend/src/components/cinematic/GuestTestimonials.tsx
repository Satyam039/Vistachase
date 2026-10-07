import { Award, Quote, Star } from "lucide-react";
import { Rail } from "@/components/motion/Rail";

interface Testimonial {
  author: string;
  tripType: string;
  source: string;
  rating: number;
  body: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    author: "Emily & Jason",
    tripType: "Luxury Private SUV Tour",
    source: "TripAdvisor Best of the Best",
    rating: 5,
    body: "Excellent tour experience. Our guide was professional, knowledgeable, and the full-size SUV was remarkably comfortable for our full-day journey through Banff and Lake Louise.",
  },
  {
    author: "Jessica M.",
    tripType: "Shared Small-Group Tour",
    source: "Google 5-Star Review",
    rating: 5,
    body: "I booked a shared tour and it was easily the best day of my trip. Our guide was incredibly patient, took incredible family photos for us, and got us right to the lakeshore before any crowds arrived.",
  },
  {
    author: "Rohit S.",
    tripType: "Family Private Rockies Tour",
    source: "TripAdvisor Verified Guest",
    rating: 5,
    body: "We did a private day tour for our family of five, and it exceeded our highest expectations. Pacing was tailored for our kids and the local stories made it completely unforgettable.",
  },
  {
    author: "Daniel P.",
    tripType: "Moraine Lake Sunrise Shuttle",
    source: "Google 5-Star Review",
    rating: 5,
    body: "We joined the sunrise shuttle for Moraine Lake and were blown away. Total peace of mind knowing our access was guaranteed. Seeing the Ten Peaks reflect in calm water was the highlight of our year.",
  },
  {
    author: "Carlos R.",
    tripType: "Icefields Parkway Private Expedition",
    source: "TripAdvisor Best of the Best",
    rating: 5,
    body: "Unforgettable experience in the Canadian Rockies. The glacial landscape was majestic and the logistics were completely seamless from morning pickup to evening drop-off.",
  },
];

const TRIPADVISOR_URL =
  "https://www.tripadvisor.ca/Attraction_Review-g154911-d26518659-Reviews-Vista_Chase-Banff_Banff_National_Park_Alberta.html";

// Review wall (TripAdvisor / Civitatis pattern): the score summary on the left, guest reviews in
// a swipeable rail beside it, each with trip, source and rating.
export function GuestTestimonials() {
  return (
    <section aria-labelledby="reviews-heading" className="overflow-hidden bg-ocean-950 py-20 text-white sm:py-28">
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
            className="mt-8 inline-flex items-center gap-2 border-b border-summit-500 pb-1 text-base"
          >
            Read all reviews on TripAdvisor
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>

        <Rail label="Guest reviews" tone="dark" itemClassName="w-[85%] sm:w-[60%] lg:w-[48%]">
          {TESTIMONIALS.map((t) => (
            <figure key={t.author} className="flex h-full flex-col rounded-[1.75rem] border border-white/10 bg-white/[0.05] p-7 sm:p-8">
              <div className="flex items-center justify-between">
                <span className="flex gap-0.5" role="img" aria-label={`${t.rating} out of 5 stars`}>
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-summit-500 text-summit-500" aria-hidden="true" />
                  ))}
                </span>
                <Quote className="h-8 w-8 text-white/15" aria-hidden="true" />
              </div>
              <blockquote className="mt-5 flex-1 text-lg font-light leading-relaxed text-slate-100">
                <p className="text-slate-100">&ldquo;{t.body}&rdquo;</p>
              </blockquote>
              <figcaption className="mt-6 border-t border-white/10 pt-5">
                <span className="block text-base text-white">{t.author}</span>
                <span className="mt-0.5 block text-sm text-slate-300">
                  {t.tripType} · {t.source}
                </span>
              </figcaption>
            </figure>
          ))}
        </Rail>
      </div>
    </section>
  );
}
