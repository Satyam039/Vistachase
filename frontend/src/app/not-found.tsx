import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bus, Compass, MapPin, Search, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Page not found | Vista Chase",
  robots: { index: false, follow: false },
};

// 404 (GetYourGuide / Expedia pattern): a photo, a plain apology, search first, then the most-used
// ways back into the site.
const LINKS = [
  { icon: Users, label: "Shared tours", body: "Small-group day tours from Banff and Canmore", href: "/shared-tours" },
  { icon: Compass, label: "Private tours", body: "Your own vehicle, guide and pace", href: "/private-tours" },
  { icon: Bus, label: "Moraine Lake shuttles", body: "Guaranteed access, sunrise departures", href: "/shuttles" },
  { icon: MapPin, label: "Destinations", body: "Lakes, towns and parkways to explore", href: "/destinations" },
];

export default function NotFound() {
  return (
    <div className="bg-obsidian-50">
      <section className="relative isolate overflow-hidden bg-ocean-950">
        <Image src="/media/photos/moraine-lake-classic.webp" alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-60" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ocean-950 via-ocean-950/40 to-ocean-950/20" aria-hidden="true" />
        <div className="mx-auto flex max-w-5xl flex-col items-center px-page pb-14 pt-20 text-center sm:pb-20 sm:pt-28">
          <p className="inline-flex rounded-full bg-white/15 px-3 py-1 text-sm text-white backdrop-blur">Error 404</p>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-light tracking-tight text-white sm:text-5xl">This trail doesn&apos;t lead anywhere</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg font-light leading-relaxed text-white/85">
            The link may be out of date, or the page has moved. Search our tours or pick up one of the paths below.
          </p>
          <form action="/search" method="get" role="search" className="mx-auto mt-8 flex w-full max-w-xl items-center gap-2 rounded-full bg-white p-1.5 pl-5 text-left shadow-lg">
            <Search className="h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
            <label htmlFor="nf-q" className="sr-only">
              Search tours
            </label>
            <input id="nf-q" name="q" type="search" placeholder="Moraine Lake, Banff, sunrise…" className="h-11 min-w-0 flex-1 bg-transparent text-base text-obsidian-900 placeholder:text-slate-500 focus:outline-none" />
            <button type="submit" className="inline-flex h-11 shrink-0 items-center rounded-full bg-ocean-600 px-5 text-sm text-white hover:bg-ocean-700">
              Search
            </button>
          </form>
        </div>
      </section>

      <section aria-labelledby="nf-links" className="mx-auto max-w-5xl px-page py-12 sm:py-16">
        <h2 id="nf-links" className="text-center text-2xl font-light text-obsidian-900">
          Popular with travellers
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2" data-stagger>
          {LINKS.map(({ icon: Icon, label, body, href }) => (
            <li key={href}>
              <Link href={href} className="group flex h-full items-center gap-4 rounded-[1.5rem] bg-white p-5 ring-1 ring-obsidian-900/[0.07] transition-shadow hover:shadow-md">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ocean-50 text-ocean-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base text-obsidian-900">{label}</span>
                  <span className="mt-0.5 block text-sm text-slate-600">{body}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-slate-600">
          Still stuck?{" "}
          <Link href="/contact-us" className="text-ocean-600 underline underline-offset-4">
            Contact us
          </Link>{" "}
          or go to the{" "}
          <Link href="/" className="text-ocean-600 underline underline-offset-4">
            home page
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
