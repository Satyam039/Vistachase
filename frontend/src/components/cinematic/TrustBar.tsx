// Where travellers review and book Vista Chase, as a slow continuous marquee. It pauses on
// hover or focus, and with reduced motion it becomes a static wrapped row (globals.css). The
// second copy of the logos is only there to make the loop seamless, so it is hidden from
// assistive technology.

import Image from "next/image";

const PARTNER_LOGOS = [
  { name: "Google Reviews", src: "/media/badges/google-logo.png" },
  { name: "TripAdvisor", src: "/media/badges/tripadvisor-logo.png" },
  { name: "Viator", src: "/media/badges/viator-logo.png" },
  { name: "GetYourGuide", src: "/media/badges/get-your-guide-logo.png" },
  { name: "Expedia", src: "/media/badges/expedia-logo.png" },
];

export function TrustBar() {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-16 pr-16 sm:gap-24 sm:pr-24" aria-hidden={hidden || undefined}>
      {[...PARTNER_LOGOS, ...PARTNER_LOGOS].map((logo, i) => (
        <li key={`${logo.name}-${i}`} className="relative flex h-10 w-32 items-center justify-center sm:w-40">
          <Image src={logo.src} alt={hidden || i >= PARTNER_LOGOS.length ? "" : logo.name} width={160} height={40} className="max-h-9 object-contain opacity-70 grayscale" />
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-labelledby="trust-heading" className="border-y border-obsidian-900/[0.06] bg-white py-12">
      <h2 id="trust-heading" className="mb-8 px-page text-center text-sm uppercase tracking-[0.22em] text-slate-600">
        Reviewed and booked by travellers on
      </h2>
      <div className="vc-marquee relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
        <div className="vc-marquee-track flex w-max">
          {row(false)}
          {row(true)}
        </div>
      </div>
    </section>
  );
}
