"use client";

// Site frame scaffolded from the Astryx `shell-top-nav` template, laid out like Bentley's:
//   left    "Menu" button opening the full-height site menu (SiteMenu), at every width
//   center  the Vista Chase mark and name, linking home
//   right   My trips (1024px+) and Book tours; the AI concierge is the floating button on every page
//   all widths: footer columns reflow through Grid minWidth; page margin from px-page

import { useEffect } from "react";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import Link from "next/link";
import * as stylex from "@stylexjs/stylex";
import { TopNav } from "@astryxdesign/core/TopNav";
import { Calendar, User } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { GlobalVoiceAssistantDrawer } from "@/components/voice/GlobalVoiceAssistantDrawer";
import { MotionRuntime } from "@/components/motion/MotionRuntime";

const BOOK_HREF = "/banff-highlights-tour";

// The logo is centred over the whole bar (Bentley style), so the bar is its positioning context.
// Side padding: 16px on phones and tablets, 36px from 1024px (desktop). The bar's contents stop
// at 1600px and stay centred on wider screens, so Menu and Book tours never drift to the far edges
// (the header background still spans the window).
const styles = stylex.create({
  nav: {
    position: "relative",
    width: "100%",
    maxWidth: 1600,
    marginInline: "auto",
    paddingInline: {
      default: 16,
      "@media (min-width: 1024px)": 36,
    },
  },
});

export function SiteFrame({ children }: { children: React.ReactNode }) {
  // The header is sticky, so anything scrolled into view under it would be hidden. Reserve its
  // height as scroll padding: focused elements and #anchors then land below the header
  // (WCAG 2.4.11 Focus Not Obscured). Tracks the header as it wraps or resizes.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(
      ".astryx-app-shell-header",
    );
    if (!header) return;
    const root = document.documentElement;
    const update = () => {
      const height = Math.ceil(header.getBoundingClientRect().height);
      root.style.scrollPaddingTop = `${height + 92}px`; // header + 16px gap + a sticky in-page bar
      root.style.setProperty("--vc-header-h", `${height}px`); // offset for sticky in-page bars
    };
    update();
    // Lift the header with a shadow once the page has scrolled (globals.css: [data-scrolled]).
    const onScroll = () =>
      root.toggleAttribute("data-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      root.style.scrollPaddingTop = "";
    };
  }, []);

  return (
    <>
      {/* Above the sticky header, so it scrolls away instead of staying pinned (AnnouncementBar). */}
      <AnnouncementBar />
      <AppShell
        height="auto"
        variant="section"
        contentPadding={0}
        topNav={
          <TopNav
            label="Vista Chase main navigation"
            xstyle={styles.nav}
            heading={
              <>
                <SiteMenu />
                {/* Centred brand. Not in TopNav's centerContent: Astryx hides that slot on narrow
                  screens; phones show just the mark so it never meets the Menu button. */}
                <Link
                  href="/"
                  className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ocean-600"
                >
                  <BrandMark size={34} />
                  <span className="hidden flex-col leading-tight sm:flex">
                    <span className="text-lg text-obsidian-900">
                      Vista Chase
                    </span>
                    <span className="text-xs text-slate-600">
                      Canadian Rockies · Banff
                    </span>
                  </span>
                  <span className="sr-only sm:hidden">Vista Chase home</span>
                </Link>
              </>
            }
            endContent={
              <>
                {/* Phones and tablets: My trips as an icon on the right, where it is easy to reach. */}
              <Link
                href="/account/trips"
                aria-label="My trips"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-obsidian-900 hover:bg-obsidian-900/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600 lg:hidden"
              >
                <User className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Button
                  label="My trips"
                  variant="ghost"
                  href="/account/trips"
                  icon={<Icon icon={User} size="sm" />}
                  className="max-lg:hidden"
                />
                <Button
                  label="Book tours"
                  variant="primary"
                  href={BOOK_HREF}
                  icon={<Icon icon={Calendar} size="sm" />}
                  className="max-sm:hidden"
                />
              </>
            }
          />
        }
      >
        {/* Reading progress (CSS scroll timeline; hidden where unsupported) */}
        <span
          className="vc-scroll-progress pointer-events-none fixed inset-x-0 top-0 z-[60] hidden h-0.5 origin-left bg-summit-500"
          aria-hidden="true"
        />
        <MotionRuntime />
        {children}
        <SiteFooter />
        <GlobalVoiceAssistantDrawer />
      </AppShell>
    </>
  );
}
