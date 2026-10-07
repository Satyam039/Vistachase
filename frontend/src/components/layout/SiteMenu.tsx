"use client";

// Bentley-style site menu: a "Menu" button at the left of the header opens a full-height
// panel from the left. Large, light section names on the left; the links of the section you
// point at (or focus) appear beside them. On phones the sections expand in place instead.
// Built on Astryx Dialog, so focus is trapped inside, Escape closes it, and focus returns to
// the Menu button.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "@astryxdesign/core/Dialog";
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
      { title: "Banff activity tickets", description: "Gondola, lake cruise, Skywalk, hot springs", href: "/banff-activity-tickets" },
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

export function SiteMenu() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [active, setActive] = useState(MENU_SECTIONS[0].id);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Links route client-side, so close the menu once the new page shows.
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const section = MENU_SECTIONS.find((s) => s.id === active) ?? MENU_SECTIONS[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="inline-flex h-11 items-center gap-2.5 rounded-full px-3 text-sm uppercase tracking-[0.18em] text-obsidian-900 hover:bg-obsidian-900/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
        <span>Menu</span>
      </button>

      <Dialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        position={{ top: 0, bottom: 0, start: 0 }}
        width="min(880px, 100vw)"
        maxHeight="100dvh"
        padding={0}
      >
        <nav aria-label="Site menu" className="flex h-[100dvh] flex-col bg-obsidian-50 text-obsidian-900">
          {/* Top row: close + brand, like the header it replaces */}
          <div className="flex items-center justify-between border-b border-obsidian-900/10 px-5 py-4 sm:px-8">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-11 items-center gap-2.5 rounded-full px-3 text-sm uppercase tracking-[0.18em] hover:bg-obsidian-900/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600"
            >
              <X className="h-5 w-5" aria-hidden="true" />
              <span>Close</span>
            </button>
            <Link href="/" className="inline-flex items-center gap-2 rounded-md text-lg">
              <BrandMark size={28} />
              <span>Vista Chase</span>
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Desktop and tablet: sections on the left, the hovered/focused section's links on the right */}
            <div className="hidden min-h-full md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <ul className="space-y-1 border-r border-obsidian-900/10 px-8 py-10">
                {MENU_SECTIONS.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(s.id)}
                      onFocus={() => setActive(s.id)}
                      onClick={() => setActive(s.id)}
                      aria-current={active === s.id ? "true" : undefined}
                      className={`group flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-3xl font-light transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean-600 ${
                        active === s.id ? "text-obsidian-900" : "text-slate-600 hover:text-obsidian-900"
                      }`}
                    >
                      <span>{s.title}</span>
                      <ArrowRight
                        className={`h-5 w-5 transition-transform ${active === s.id ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"}`}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="px-8 py-10" aria-live="polite">
                <p className="mb-6 text-xs uppercase tracking-[0.2em] text-slate-600">{section.title}</p>
                <ul className="space-y-1">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="block rounded-lg px-3 py-3 hover:bg-obsidian-900/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean-600"
                      >
                        <span className="block text-xl font-light">{link.title}</span>
                        {link.description && <span className="mt-0.5 block text-sm text-slate-600">{link.description}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Phones: each section expands in place */}
            <ul className="divide-y divide-obsidian-900/10 md:hidden">
              {MENU_SECTIONS.map((s) => {
                const open = expanded === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : s.id)}
                      aria-expanded={open}
                      aria-controls={`menu-section-${s.id}`}
                      className="flex w-full items-center justify-between px-5 py-5 text-left text-2xl font-light focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ocean-600"
                    >
                      <span>{s.title}</span>
                      <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                    <ul id={`menu-section-${s.id}`} hidden={!open} className="pb-4">
                      {s.links.map((link) => (
                        <li key={link.href}>
                          <Link href={link.href} className="block px-8 py-3 text-lg font-light text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ocean-600">
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
          <div className="flex flex-wrap items-center gap-3 border-t border-obsidian-900/10 px-5 py-5 sm:px-8">
            <Link href="/banff-highlights-tour" className="golden-summit-btn inline-flex h-11 items-center rounded-md px-6 text-sm uppercase tracking-[0.14em]">
              Book a tour
            </Link>
            <a
              href="tel:+18257349456"
              className="inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm text-obsidian-900 hover:bg-obsidian-900/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean-600"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              +1 (825) 734-9456
            </a>
            <Link
              href="/concierge"
              className="inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm text-obsidian-900 hover:bg-obsidian-900/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean-600"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Ask the AI concierge
            </Link>
          </div>
        </nav>
      </Dialog>
    </>
  );
}
