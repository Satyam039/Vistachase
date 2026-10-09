"use client";

// Premium site menu: the "Menu" button opens a near-black full-height panel from the left over
// the page, which stays visible behind a dark tint and a light blur. Large, light section names on
// the left; the links of the section you point at (or focus) appear beside them. On phones the
// sections expand in place. Native <dialog>: focus stays inside, Escape or a click on the page
// closes it, focus returns to the Menu button. Opening and closing animate (globals.css .vc-menu);
// with reduced motion it simply appears.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown, Menu, Phone, Sparkles, X } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";

type MenuLink = { title: string; description?: string; href: string };
type MenuSection = { id: string; title: string; links: MenuLink[] };

export const MENU_SECTIONS: MenuSection[] = [
  {
    id: "experiences",
    title: "Experiences",
    links: [
      { title: "Shared tours", description: "Small groups of up to 12, our best-sellers", href: "/shared-tours" },
      { title: "Private tours", description: "Your own vehicle and guide, your pace", href: "/private-tours" },
      { title: "Shuttles", description: "Guaranteed Moraine Lake & Lake Louise access", href: "/shuttles" },
      { title: "Multi-day packages", description: "2–7 days across the Rockies, airport transfers", href: "/multi-day-tour-package-for-banff" },
      { title: "Banff activity tickets", description: "Gondola, Icefield, lake cruises, hot springs", href: "/banff-activity-tickets" },
    ],
  },
  {
    id: "destinations",
    title: "Destinations",
    links: [
      { title: "Banff National Park", href: "/destinations/banff-national-park" },
      { title: "Lake Louise", href: "/destinations/lake-louise" },
      { title: "Moraine Lake", href: "/destinations/moraine-lake" },
      { title: "Yoho National Park", href: "/destinations/yoho-national-park" },
      { title: "Jasper National Park", href: "/destinations/jasper-national-park" },
      { title: "All destinations", href: "/destinations" },
    ],
  },
  {
    id: "plan",
    title: "Plan your trip",
    links: [
      { title: "Search tours & dates", description: "Filter by date, guests and destination", href: "/search" },
      { title: "Hotel pickup finder", description: "Your pickup point and time", href: "/pickup-finder" },
      { title: "AI concierge", description: "Ask anything, plan your days", href: "/concierge" },
      { title: "My trips", description: "Bookings and boarding passes", href: "/account/trips" },
    ],
  },
  {
    id: "about",
    title: "About Vista Chase",
    links: [
      { title: "Our story", href: "/about-us" },
      { title: "Gallery", href: "/gallery" },
      { title: "FAQ & cancellation", href: "/faq" },
      { title: "Contact us", href: "/contact-us" },
    ],
  },
  {
    id: "partners",
    title: "Partners",
    links: [
      { title: "Partner program", description: "Hotels, agents and creators earn on every booking", href: "/partners" },
      { title: "Partner sign in", description: "Your links, referred bookings and earnings", href: "/partners/login" },
    ],
  },
];

// Open/close timing, shared with the CSS in globals.css (.vc-menu).
const CLOSE_MS = 320;

export function SiteMenu() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [active, setActive] = useState(MENU_SECTIONS[0].id);
  const [expanded, setExpanded] = useState<string | null>(null);

  const open = () => {
    const el = dialog.current;
    if (!el || el.open) return;
    setClosing(false);
    setIsOpen(true);
    el.showModal();
    document.documentElement.style.overflow = "hidden"; // the page behind doesn't scroll
  };

  // Close with the exit animation, then really close (focus returns to the Menu button).
  const close = useCallback(() => {
    const el = dialog.current;
    if (!el || !el.open) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setClosing(true);
    window.setTimeout(() => {
      el.close();
      setClosing(false);
    }, reduce ? 0 : CLOSE_MS);
  }, []);

  // Links route client-side, so close the menu once the new page shows.
  useEffect(() => {
    close();
  }, [pathname, close]);

  const section = MENU_SECTIONS.find((s) => s.id === active) ?? MENU_SECTIONS[0];

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="inline-flex h-11 items-center gap-2.5 rounded-full px-3 text-sm uppercase tracking-[0.18em] text-obsidian-900 hover:bg-obsidian-900/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
        {/* Icon-only on phones so the centred brand name has room; still announced as "Menu". */}
        <span className="max-sm:sr-only">Menu</span>
      </button>

      {/* Native modal dialog: focus is contained, Escape closes, the page behind is inert. Like
          Rolls-Royce's menu it is an overlay, not a black screen: the ::backdrop blurs and dims the
          page, and the panel is a translucent gradient that only deepens behind the text
          (globals.css .vc-menu). */}
      <dialog
        ref={dialog}
        aria-label="Site menu"
        data-closing={closing || undefined}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClose={() => {
          setIsOpen(false);
          document.documentElement.style.overflow = "";
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close(); // a click on the blurred page closes the menu
        }}
        className="vc-menu"
      >
        <nav aria-label="Site menu" className="vc-menu-panel flex h-[100dvh] w-[min(880px,calc(100vw-3.5rem))] flex-col text-white">
          {/* Top row: close + brand, like the header it replaces */}
          <div className="flex items-center justify-between px-5 py-4 sm:px-10 sm:py-6">
            <button
              type="button"
              onClick={close}
              className="inline-flex h-11 items-center gap-2.5 rounded-full px-3 text-sm uppercase tracking-[0.18em] text-white/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-summit-300"
            >
              <X className="h-5 w-5" aria-hidden="true" />
              <span>Close</span>
            </button>
            <Link href="/" className="inline-flex items-center gap-2.5 rounded-md text-lg text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-summit-300">
              <BrandMark size={26} variant="white" />
              <span>Vista Chase</span>
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Desktop and tablet: sections on the left, the hovered/focused section's links on the right */}
            <div className="hidden min-h-full md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              <ul className="space-y-2 px-10 py-12">
                {MENU_SECTIONS.map((s, i) => (
                  <li key={s.id} className="vc-menu-item" style={{ "--i": i } as React.CSSProperties}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(s.id)}
                      onFocus={() => setActive(s.id)}
                      onClick={() => setActive(s.id)}
                      aria-current={active === s.id ? "true" : undefined}
                      className={`group flex w-full items-center justify-between py-2.5 text-left text-4xl font-light tracking-tight transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-summit-300 ${
                        active === s.id ? "text-white" : "text-white/45 hover:text-white/80"
                      }`}
                    >
                      <span>{s.title}</span>
                      <ArrowRight
                        className={`h-5 w-5 text-summit-300 transition-[transform,opacity] duration-300 ${active === s.id ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"}`}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-l border-white/[0.08] px-10 py-12" aria-live="polite">
                <p className="mb-6 text-xs uppercase tracking-[0.24em] text-white/50">{section.title}</p>
                <ul key={section.id} className="vc-menu-links space-y-1">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="group block py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-summit-300"
                      >
                        <span className="text-xl font-light text-white/90 underline decoration-transparent underline-offset-[6px] transition-colors group-hover:text-white group-hover:decoration-summit-300/60">
                          {link.title}
                        </span>
                        {link.description && <span className="mt-1 block text-sm text-white/50">{link.description}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Phones: each section expands in place */}
            <ul className="divide-y divide-white/[0.08] px-5 md:hidden">
              {MENU_SECTIONS.map((s, i) => {
                const isExpanded = expanded === s.id;
                return (
                  <li key={s.id} className="vc-menu-item" style={{ "--i": i } as React.CSSProperties}>
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : s.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`menu-section-${s.id}`}
                      className="flex w-full items-center justify-between py-5 text-left text-2xl font-light text-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-summit-300"
                    >
                      <span>{s.title}</span>
                      <ChevronDown className={`h-5 w-5 text-white/60 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                    <ul id={`menu-section-${s.id}`} hidden={!isExpanded} className="pb-4">
                      {s.links.map((link) => (
                        <li key={link.href}>
                          <Link href={link.href} className="block py-3 pl-3 text-lg font-light text-white/75 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-summit-300">
                            {link.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Bottom row: book, call, concierge */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/[0.08] px-5 py-5 sm:px-10 sm:py-6">
            <Link href="/banff-highlights-tour" className="golden-summit-btn inline-flex h-11 items-center rounded-full px-6 text-sm">
              Book a tour
            </Link>
            <a href="tel:+18257349456" className="inline-flex h-11 items-center gap-2 text-sm text-white/75 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-summit-300">
              <Phone className="h-4 w-4" aria-hidden="true" />
              +1 (825) 734-9456
            </a>
            <Link href="/concierge" className="inline-flex h-11 items-center gap-2 text-sm text-white/75 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-summit-300">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Ask the AI concierge
            </Link>
          </div>
        </nav>
      </dialog>
    </>
  );
}
