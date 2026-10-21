"use client";

// Site frame scaffolded from the Astryx `shell-top-nav` template, laid out like Bentley's:
//   left    "Menu" button opening the full-height site menu (SiteMenu), at every width
//   center  the Vista Chase mark and name, linking home
//   right   My trips (1024px+) and Book tours; the AI concierge is the floating button on every page
//   all widths: footer columns reflow through Grid minWidth; page margin from px-page

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import Link from "next/link";
import * as stylex from "@stylexjs/stylex";
import { TopNav } from "@astryxdesign/core/TopNav";
import { Calendar, User } from "lucide-react";
import { BrandMark, BrandWordmark } from "@/components/brand/BrandMark";
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
  const pathname = usePathname();
  const isHeroPage =
    pathname === "/" ||
    pathname === "/shared-tours" ||
    pathname === "/private-tours" ||
    pathname === "/shuttles";

  useEffect(() => {
    const root = document.documentElement;
    if (isHeroPage) {
      root.setAttribute("data-hero-page", "true");
    } else {
      root.removeAttribute("data-hero-page");
    }
  }, [isHeroPage]);

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
    // Lift the header with a shadow once the page has scrolled (globals.css: [data-scrolled]), and
    // fold the "Vista Chase" name away further down so only the emblem stays centred
    // ([data-nav-compact]). The fold uses two thresholds so it can't flicker at one scroll position,
    // and reads scrollY at most once per frame.
    let frame = 0;
    const sync = () => {
      frame = 0;
      const y = window.scrollY;
      root.toggleAttribute("data-scrolled", y > 8);
      // The bar keeps its height as it folds (globals.css .vc-nav-spacer), so the page can't
      // move under the thresholds and unfold it again.
      if (y > 160) root.setAttribute("data-nav-compact", "");
      else if (y < 40) root.removeAttribute("data-nav-compact");
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(sync);
    };
    sync();
    window.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      root.removeAttribute("data-nav-compact");
      root.style.scrollPaddingTop = "";
    };
  }, []);

  // The SEO portal (/seo, /seo/*) is a staff workspace with its own frame: no public header,
  // footer, announcement or concierge there. Every other route renders exactly as before.
  if (pathname === "/seo" || pathname?.startsWith("/seo/")) return <>{children}</>;

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
                {/* Holds the bar open to the full logo's height at the top of the page; collapses
                  with it on scroll (globals.css: .vc-nav-spacer). */}
                <span className="vc-nav-spacer" aria-hidden="true" />
                {/* Centred brand: the official "VISTA CHASE" lettering alone at the top of the page. Not in
                  TopNav's centerContent: Astryx hides that slot on narrow screens. Once the page
                  scrolls it cross-fades to the horse alone (globals.css: [data-nav-compact]); the
                  link keeps its "Vista Chase home" name either way. */}
                <Link
                  href="/"
                  aria-label="Vista Chase home"
                  className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ocean-600"
                >
                  <span className="vc-nav-lockup">
                    <span className="vc-brandmark-dark inline-flex items-center">
                      <BrandWordmark size={26} variant="ink" />
                    </span>
                    <span className="vc-brandmark-white hidden items-center">
                      <BrandWordmark size={26} variant="white" />
                    </span>
                  </span>
                  <span className="vc-nav-emblem">
                    <span className="vc-brandmark-dark inline-flex items-center">
                      <BrandMark size={56} variant="dark" />
                    </span>
                    <span className="vc-brandmark-white hidden items-center">
                      <BrandMark size={56} variant="white" />
                    </span>
                  </span>
                </Link>
              </>
            }
            endContent={
              <>
                {/* Phones and tablets: My trips as an icon on the right, where it is easy to reach. */}
              <Link
                href="/account/trips"
                aria-label="MY TRIPS"
                className="vc-trips-mobile inline-flex h-11 w-11 items-center justify-center rounded-full text-obsidian-900 hover:bg-obsidian-900/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600 lg:hidden"
              >
                <User className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Button
                  label="MY TRIPS"
                  variant="ghost"
                  href="/account/trips"
                  icon={<Icon icon={User} size="sm" />}
                  className="vc-trips-desktop max-lg:hidden"
                />
                <Button
                  label="BOOK TOURS"
                  variant="ghost"
                  href={BOOK_HREF}
                  icon={<Icon icon={Calendar} size="sm" />}
                  className="vc-book-desktop max-sm:hidden"
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
