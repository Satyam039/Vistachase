"use client";

// Site footer: interactive and task-first, built from the booking sites studied for the
// redesign (GetYourGuide, Viator, Expedia, Civitatis, Project Expedition) and premium brand
// footers, in the Vista Chase brand (Ocean Teal night surface, Golden Summit accents):
//   1. closing banner  photo card (parallax): plan / ask the concierge, quick call & email chips
//   2. main            brand, live Canmore time, award, socials; link groups that are open
//                      columns on desktop and accordions on phones
//   3. trust row       booking promises + where travellers review us
//   4. wordmark        oversized "Vista Chase" revealed on scroll
//   5. bottom bar      copyright, legal links, back to top
// Not a <footer> landmark: AppShell renders it inside <main>, where contentinfo isn't allowed.
// Bottom padding keeps the last links clear of the floating concierge and phone booking bar.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { AwardMark } from "@/components/brand/AwardSeal";
import Link from "next/link";
import { ArrowRight, ArrowUp, ArrowUpRight, CalendarCheck, ChevronDown, Clock, Mail, MapPin, Phone, Search, ShieldCheck, Sparkles, Star } from "lucide-react";

type FooterLink = { label: string; href: string };

const GROUPS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: "Experiences",
    links: [
      { label: "Shared tours", href: "/shared-tours" },
      { label: "Private tours", href: "/private-tours" },
      { label: "Moraine Lake shuttles", href: "/shuttles" },
      { label: "Multi-day packages", href: "/multi-day-tour-package-for-banff" },
      { label: "Banff activity tickets", href: "/banff-activity-tickets" },
      { label: "All experiences", href: "/search" },
    ],
  },
  {
    heading: "Destinations",
    links: [
      { label: "Banff National Park", href: "/destinations/banff-national-park" },
      { label: "Lake Louise", href: "/destinations/lake-louise" },
      { label: "Moraine Lake", href: "/destinations/moraine-lake" },
      { label: "Yoho National Park", href: "/destinations/yoho-national-park" },
      { label: "Jasper National Park", href: "/destinations/jasper-national-park" },
    ],
  },
  {
    heading: "Plan your trip",
    links: [
      { label: "Hotel pickup finder", href: "/pickup-finder" },
      { label: "My trips & vouchers", href: "/account/trips" },
      { label: "FAQ & cancellation", href: "/faq" },
      { label: "AI concierge", href: "/concierge" },
      { label: "Photo gallery", href: "/gallery" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Vista Chase", href: "/about-us" },
      { label: "Partner program", href: "/partners" },
      { label: "Partner login", href: "/partners/login" },
      { label: "Contact us", href: "/contact-us" },
    ],
  },
];

const PROMISES = [
  { icon: CalendarCheck, text: "Free cancellation up to 72 hours before" },
  { icon: ShieldCheck, text: "Parks Canada licensed commercial operator" },
  { icon: MapPin, text: "Hotel pickup in Banff, Canmore & Lake Louise" },
];

// Heights balance the marks optically (the files have very different proportions and padding).
const LISTED_ON = [
  { name: "Tripadvisor", src: "/media/badges/tripadvisor-logo.png", h: "h-5", w: 800, hh: 122 },
  { name: "Google", src: "/media/badges/google-logo.png", h: "h-7", w: 1600, hh: 521 },
  { name: "Viator", src: "/media/badges/viator-logo.png", h: "h-6", w: 1600, hh: 402 },
  { name: "GetYourGuide", src: "/media/badges/get-your-guide-logo.png", h: "h-11", w: 400, hh: 140 },
  { name: "Expedia", src: "/media/badges/expedia-logo.png", h: "h-7", w: 1600, hh: 453 },
];

const LEGAL: FooterLink[] = [
  { label: "Terms", href: "/terms-and-conditions" },
  { label: "Privacy", href: "/privacy-policy" },
  { label: "Cancellation policy", href: "/cancellation-policy" },
  { label: "Affiliates & Bókun agents", href: "/affiliates" },
  { label: "Staff portal", href: "/admin" },
];

// Live-site profiles. Brand marks as 24×24 paths (lucide no longer ships them).
const SOCIALS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/vista_chase/",
    path: "M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zm0 4.6a5.2 5.2 0 1 0 0 10.4 5.2 5.2 0 0 0 0-10.4zm0 8.6a3.4 3.4 0 1 1 0-6.8 3.4 3.4 0 0 1 0 6.8zm5.4-9.9a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z",
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/vistachasetours/",
    path: "M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z",
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/vista-chase/",
    path: "M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6h.1c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zm1.8 13.1H3.5V9h3.6v11.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0z",
  },
];

/** Current time in Canmore (Mountain Time), so visitors abroad know when they're calling. */
function CanmoreTime() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", timeZone: "America/Edmonton" });
    setNow(fmt());
    const t = window.setInterval(() => setNow(fmt()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-white/85">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      {now ? `${now} in Canmore` : "Canmore, Alberta"}
    </p>
  );
}

function LinkGroup({ heading, links }: { heading: string; links: FooterLink[] }) {
  const [open, setOpen] = useState(false);
  const id = `footer-${heading.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className="border-b border-white/10 lg:border-0">
      {/* Phones: an accordion button. Desktop: a plain heading over an always-open list. */}
      <h2 className="lg:mb-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between py-4 text-left text-base text-white lg:hidden"
        >
          {heading}
          <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        <span className="hidden text-sm uppercase tracking-[0.18em] text-summit-300 lg:block">{heading}</span>
      </h2>
      <ul id={id} className={`space-y-1 pb-4 lg:block lg:space-y-1.5 lg:pb-0 ${open ? "block" : "hidden"}`}>
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="group inline-flex items-center gap-1.5 py-1 text-base font-light text-white/75 transition-colors hover:text-white"
            >
              {link.label}
              <ArrowRight
                className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Task pages (checkout, sign-in, account, staff) keep a quiet footer: no promo banner or
// wordmark pulling people away mid-task, as on the booking sites' checkout pages.
const TASK_PAGES = /^\/(book|login|register|account|admin|track\/|partners\/(login|dashboard)|booking\/)/;

export function SiteFooter() {
  const year = new Date().getFullYear();
  const pathname = usePathname() ?? "";
  const task = TASK_PAGES.test(pathname);
  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    document.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true });
  };

  return (
    <div className="bg-ocean-950 text-white">
      {/* 1. Closing banner */}
      {!task && (
      <div className="mx-auto max-w-7xl px-page pt-12 sm:pt-16">
        <section
          aria-labelledby="footer-plan-heading"
          className="relative isolate overflow-hidden rounded-[2rem] px-6 py-12 sm:px-12 sm:py-16"
          data-reveal="clip"
        >
          <Image
            src="/media/photos/bow-lake-dock-sunrise.webp"
            alt=""
            fill
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="-z-10 object-cover"
            data-parallax="10"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ocean-950/90 via-ocean-950/65 to-ocean-950/20" />
          <div className="max-w-xl">
            <p className="text-sm uppercase tracking-[0.22em] text-summit-300">Plan your Rockies day</p>
            <h2 id="footer-plan-heading" className="mt-3 text-balance text-3xl font-light leading-tight tracking-tight text-white sm:text-5xl">
              Lakes, glaciers and a local guide. Where shall we start?
            </h2>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/search" className="golden-summit-btn inline-flex h-12 items-center gap-2 rounded-full px-6 text-base">
                <Search className="h-4 w-4" aria-hidden="true" />
                Find a tour
              </Link>
              <Link
                href="/concierge"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 text-base text-white backdrop-blur-md transition-colors hover:bg-white/20"
              >
                <Sparkles className="h-4 w-4 text-summit-300" aria-hidden="true" />
                Ask AI concierge
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-2" aria-label="Contact Vista Chase">
              <li>
                <a href="tel:+18257349456" className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm text-white backdrop-blur-md hover:bg-white/20">
                  <Phone className="h-4 w-4 text-summit-300" aria-hidden="true" />
                  +1 (825) 734-9456
                </a>
              </li>
              <li>
                <a href="mailto:info@vistachase.com" className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm text-white backdrop-blur-md hover:bg-white/20">
                  <Mail className="h-4 w-4 text-summit-300" aria-hidden="true" />
                  info@vistachase.com
                </a>
              </li>
            </ul>
          </div>
        </section>
      </div>
      )}

      {/* 2. Main */}
      <div className="mx-auto grid max-w-7xl gap-10 px-page py-14 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,3fr)] lg:gap-14">
        <div className="max-w-md space-y-6">
          <Link href="/" aria-label="Vista Chase home" className="inline-block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-summit-500">
            <Image src="/media/brand/logo-white.png" alt="Vista Chase" width={160} height={72} className="h-16 w-auto" />
          </Link>
          <p className="text-base font-light leading-relaxed text-white/75">
            Small-group, private and shuttle tours of Banff and the Canadian Rockies, run from Canmore by local guides since 2018.
          </p>
          <CanmoreTime />
          {/* Award as a trust card: a light tile with the year (AwardMark) beside the ranking. */}
          <a
            href="https://www.tripadvisor.ca/Attraction_Review-g154911-d26518659-Reviews-Vista_Chase-Banff_Banff_National_Park_Alberta.html"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 pr-10 transition-colors hover:border-summit-500/60 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-summit-500"
          >
            <AwardMark />
            <span className="min-w-0">
              <span className="block whitespace-nowrap text-base text-white">#6 experience in Canada</span>
              <span className="block whitespace-nowrap text-xs text-white/70">TripAdvisor Best of the Best 2025</span>
              <span className="mt-1.5 flex items-center gap-1.5 whitespace-nowrap text-sm text-white/85">
                <span className="flex" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-summit-500 text-summit-500" />
                  ))}
                </span>
                5.0<span className="sr-only"> out of 5</span> · 1,000+ reviews
                <ArrowUpRight className="absolute right-3.5 top-3.5 h-4 w-4 text-white/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                <span className="sr-only">(opens TripAdvisor in a new tab)</span>
              </span>
            </span>
          </a>
          <ul className="flex gap-2" aria-label="Vista Chase on social media">
            {SOCIALS.map((s) => (
              <li key={s.name}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${s.name} (opens in a new tab)`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white/80 transition-all duration-300 hover:-translate-y-0.5 hover:border-summit-200 hover:bg-summit-200 hover:text-obsidian-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-summit-500"
                >
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current" aria-hidden="true">
                    <path d={s.path} />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <nav aria-label="Footer" className="grid border-t border-white/10 lg:grid-cols-4 lg:gap-8 lg:border-0">
          {GROUPS.map((g) => (
            <LinkGroup key={g.heading} heading={g.heading} links={g.links} />
          ))}
        </nav>
      </div>

      {/* 3. Trust: promises as three equal columns, then the review platforms in equal cells */}
      <div className="mx-auto max-w-7xl px-page">
        <ul className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3" aria-label="Booking with Vista Chase">
          {PROMISES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3.5 bg-ocean-950 px-5 py-5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-summit-500/15 text-summit-400">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-sm leading-snug text-white/85">{text}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-5 py-8 lg:flex-row lg:items-center lg:gap-10">
          <p className="shrink-0 text-sm uppercase tracking-[0.18em] text-white/65">Reviewed on</p>
          <ul className="grid flex-1 grid-cols-3 gap-3 sm:grid-cols-5">
            {LISTED_ON.map((l) => (
              <li key={l.name} className="flex h-16 items-center justify-center rounded-xl border border-white/[0.08] px-3">
                <Image
                  src={l.src}
                  alt={l.name}
                  width={l.w}
                  height={l.hh}
                  sizes="160px"
                  className={`${l.h} w-auto max-w-full object-contain opacity-75 brightness-0 invert transition-opacity hover:opacity-100`}
                />
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-white/10" />
      </div>

      {/* 4. Wordmark */}
      {!task && (
      <div className="overflow-hidden" aria-hidden="true">
        <p
          className="mx-auto max-w-7xl select-none whitespace-nowrap px-page pt-8 text-center text-[17vw] font-light leading-none tracking-tighter text-transparent [-webkit-background-clip:text] [background-clip:text] [background-image:linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.02))] lg:text-[13.5rem]"
          data-reveal
        >
          Vista Chase
        </p>
      </div>
      )}

      {/* 5. Bottom bar */}
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-page pb-[calc(6.5rem+var(--vc-bottom-bar-h,0px))] pt-6 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-white/65">
          © {year} Vista Chase Tours Ltd. · 121 Bow Meadows Crescent #110, Canmore, AB · Prices in CAD
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {LEGAL.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="text-white/65 hover:text-white hover:underline hover:underline-offset-4">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={toTop}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-sm text-white/85 transition-colors hover:border-white/40 hover:text-white"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
            Back to top
          </button>
        </div>
      </div>
    </div>
  );
}
