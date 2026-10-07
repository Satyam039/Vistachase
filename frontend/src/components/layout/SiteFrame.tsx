"use client";

// Site frame scaffolded from the Astryx `shell-top-nav` template, laid out like Bentley's:
//   left    "Menu" button opening the full-height site menu (SiteMenu), at every width
//   center  the Vista Chase mark and name, linking home
//   right   AI concierge (icon-only below 1024px), My trips (1024px+) and Book tours
//   all widths: footer columns reflow through Grid minWidth; page margin from px-page

import { useEffect } from "react";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import Link from "next/link";
import * as stylex from "@stylexjs/stylex";
import { TopNav } from "@astryxdesign/core/TopNav";
import { Calendar, Sparkles, User } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { GlobalVoiceAssistantDrawer } from "@/components/voice/GlobalVoiceAssistantDrawer";
import { MotionRuntime } from "@/components/motion/MotionRuntime";

const BOOK_HREF = "/banff-highlights-tour";

// The logo is centred over the whole bar (Bentley style), so the bar is its positioning context.
const styles = stylex.create({
  nav: { position: "relative" },
});

export function SiteFrame({ children }: { children: React.ReactNode }) {
  // The header is sticky, so anything scrolled into view under it would be hidden. Reserve its
  // height as scroll padding: focused elements and #anchors then land below the header
  // (WCAG 2.4.11 Focus Not Obscured). Tracks the header as the banner is dismissed or it wraps.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".astryx-app-shell-header");
    if (!header) return;
    const root = document.documentElement;
    const update = () => {
      const height = Math.ceil(header.getBoundingClientRect().height);
      root.style.scrollPaddingTop = `${height + 72}px`; // header + a sticky in-page bar (product pages)
      root.style.setProperty("--vc-header-h", `${height}px`); // offset for sticky in-page bars
    };
    update();
    // Lift the header with a shadow once the page has scrolled (globals.css: [data-scrolled]).
    const onScroll = () => root.toggleAttribute("data-scrolled", window.scrollY > 8);
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
    <AppShell
      height="auto"
      variant="section"
      contentPadding={0}
      banner={
        <Banner
          status="info"
          container="section"
          title="Moraine Lake Road is closed to private vehicles"
          description="Vista Chase shuttles and tours have guaranteed access."
          endContent={<Button label="Find your hotel pickup" size="sm" href="/pickup-finder" />}
          isDismissable
        />
      }
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
                  <span className="text-lg text-obsidian-900">Vista Chase</span>
                  <span className="text-xs text-slate-600">Canadian Rockies · Banff</span>
                </span>
                <span className="sr-only sm:hidden">Vista Chase home</span>
              </Link>
            </>
          }
          endContent={
            <>
              <Button
                label="AI Concierge"
                variant="ghost"
                href="/concierge"
                icon={<Icon icon={Sparkles} size="sm" />}
                className="max-lg:hidden"
              />
              <Button
                label="My trips"
                variant="ghost"
                href="/account/trips"
                icon={<Icon icon={User} size="sm" />}
                className="max-lg:hidden"
              />
              {/* Below 1024px the concierge stays one tap away as an icon; the rest is in the menu. */}
              <Button
                label="AI Concierge"
                tooltip="AI Concierge"
                variant="ghost"
                href="/concierge"
                icon={<Icon icon={Sparkles} size="sm" />}
                isIconOnly
                className="lg:hidden"
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
  );
}
