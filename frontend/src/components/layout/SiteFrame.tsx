"use client";

// Site frame scaffolded from the Astryx `shell-top-nav` template.
// Responsive contract:
//   >= 1024 (lg)  TopNav with the Experiences mega menu, nav items and actions inline
//   <  1024       TopNav collapses to brand + icon-only AI Concierge + menu toggle. Every
//                 destination and action (Book tours, My trips, …) moves into the MobileNav
//                 drawer (mobileNav breakpoint "lg"). Desktop-only actions hide via CSS
//                 (max-lg:hidden / lg:hidden) so first paint is right without a media-query hook.
//   all widths    footer columns reflow through Grid minWidth; page margin from px-page

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Grid } from "@astryxdesign/core/Grid";
import { Icon } from "@astryxdesign/core/Icon";
import { MobileNav } from "@astryxdesign/core/MobileNav";
import { SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import type { IconType } from "@astryxdesign/core/Icon";
import { Stack } from "@astryxdesign/core/Stack";
import {
  TopNav,
  TopNavHeading,
  TopNavItem,
  TopNavMegaMenu,
  TopNavMegaMenuFeaturedCard,
  TopNavMegaMenuItem,
  TopNavMenu,
} from "@astryxdesign/core/TopNav";
import { Bus, Calendar, CalendarDays, CarFront, Compass, MapPin, Sparkles, User, Users } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { GlobalVoiceAssistantDrawer } from "@/components/voice/GlobalVoiceAssistantDrawer";

type MegaItem = { title: string; description: string; href: string; icon: IconType };

const EXPERIENCES: MegaItem[] = [
  {
    title: "Shuttles",
    description: "Guaranteed Moraine Lake & Lake Louise seats",
    href: "/shuttles",
    icon: Bus,
  },
  {
    title: "Shared Tours",
    description: "Award-winning small groups, max 12",
    href: "/shared-tours",
    icon: Users,
  },
  {
    title: "Private SUV Tours",
    description: "Luxury GMC Yukon XL on your own route",
    href: "/private-tours",
    icon: CarFront,
  },
  {
    title: "Multi-Day Packages",
    description: "Airport transfers plus 3–5 days of guiding",
    href: "/multi-day-tour-package-for-banff",
    icon: CalendarDays,
  },
];

const ABOUT_ITEMS = [
  { title: "About Vista Chase", href: "/about-us" },
  { title: "Gallery", href: "/gallery" },
  { title: "FAQ & cancellation", href: "/faq" },
  { title: "Contact", href: "/contact-us" },
];

// Trip tools: inline TopNav actions on desktop, drawer items on mobile.
const CONCIERGE = { title: "AI Concierge", href: "/concierge", icon: Sparkles };
const BOOK_HREF = "/banff-highlights-tour";

const TRIP_ITEMS = [
  CONCIERGE,
  { title: "My trips", href: "/account/trips", icon: User },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SiteMobileNav({ pathname }: { pathname: string }) {
  return (
    <MobileNav header="Vista Chase" side="end">
      <Stack padding={3}>
        <Button
          label="Book tours"
          variant="primary"
          href={BOOK_HREF}
          width="100%"
          icon={<Icon icon={Calendar} size="sm" />}
        />
      </Stack>
      <SideNavSection title="Experiences">
        {EXPERIENCES.map((item) => (
          <SideNavItem
            key={item.href}
            label={item.title}
            href={item.href}
            icon={item.icon}
            isSelected={isActivePath(pathname, item.href)}
          />
        ))}
      </SideNavSection>
      <SideNavSection title="Explore">
        <SideNavItem label="Destinations" href="/destinations" icon={Compass} isSelected={isActivePath(pathname, "/destinations")} />
        <SideNavItem label="Pickup Finder" href="/pickup-finder" icon={MapPin} isSelected={isActivePath(pathname, "/pickup-finder")} />
      </SideNavSection>
      <SideNavSection title="Your trip">
        {TRIP_ITEMS.map((item) => (
          <SideNavItem
            key={item.href}
            label={item.title}
            href={item.href}
            icon={item.icon}
            isSelected={isActivePath(pathname, item.href)}
          />
        ))}
      </SideNavSection>
      <SideNavSection title="About">
        {ABOUT_ITEMS.map((item) => (
          <SideNavItem key={item.href} label={item.title} href={item.href} isSelected={isActivePath(pathname, item.href)} />
        ))}
      </SideNavSection>
    </MobileNav>
  );
}

function ExperiencesMegaMenu() {
  return (
    <TopNavMegaMenu
      label="Experiences"
      items={
        // Fixed item width keeps the panel the same size every time it opens.
        <Stack width={520}>
          <Grid columns={2} gap={2}>
            {EXPERIENCES.map((item) => (
              <TopNavMegaMenuItem
                key={item.href}
                title={item.title}
                description={item.description}
                href={item.href}
                icon={<Icon icon={item.icon} size="md" color="secondary" />}
              />
            ))}
          </Grid>
        </Stack>
      }
      featured={
        <Stack width={240}>
          <TopNavMegaMenuFeaturedCard
            title="Banff Highlights Tour"
            description="Ranked the #6 experience in Canada by TripAdvisor travelers."
            image="/media/photos/moraine-lake-perfect-reflection.webp"
            imageAlt="Moraine Lake and the Valley of the Ten Peaks"
            linkLabel="See the tour"
            linkHref="/banff-highlights-tour"
          />
        </Stack>
      }
    />
  );
}

export function SiteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const isActive = (href: string) => isActivePath(pathname, href);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Links route client-side, so close the drawer once the new page is showing.
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  // The header is sticky, so anything scrolled into view under it would be hidden. Reserve its
  // height as scroll padding: focused elements and #anchors then land below the header
  // (WCAG 2.4.11 Focus Not Obscured). Tracks the header as the banner is dismissed or it wraps.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".astryx-app-shell-header");
    if (!header) return;
    const root = document.documentElement;
    const update = () => {
      root.style.scrollPaddingTop = `${Math.ceil(header.getBoundingClientRect().height) + 8}px`;
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => {
      observer.disconnect();
      root.style.scrollPaddingTop = "";
    };
  }, []);

  return (
    <AppShell
      height="auto"
      variant="section"
      contentPadding={0}
      mobileNav={{
        breakpoint: "lg",
        isOpen: isMobileNavOpen,
        onOpenChange: setIsMobileNavOpen,
        content: <SiteMobileNav pathname={pathname} />,
      }}
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
          heading={
            <TopNavHeading
              heading="Vista Chase"
              subheading="Canadian Rockies · Banff"
              headingHref="/"
              logo={<BrandMark />}
            />
          }
          centerContent={
            <>
              <ExperiencesMegaMenu />
              <TopNavItem label="Destinations" href="/destinations" isSelected={isActive("/destinations")} />
              <TopNavItem label="Pickup Finder" href="/pickup-finder" isSelected={isActive("/pickup-finder")} />
              <TopNavMenu label="About" items={ABOUT_ITEMS} />
            </>
          }
          endContent={
            <>
              {TRIP_ITEMS.map((item) => (
                <Button
                  key={item.href}
                  label={item.title}
                  variant="ghost"
                  href={item.href}
                  icon={<Icon icon={item.icon} size="sm" />}
                  className="max-lg:hidden"
                />
              ))}
              <Button
                label="Book tours"
                variant="primary"
                href={BOOK_HREF}
                icon={<Icon icon={Calendar} size="sm" />}
                className="max-lg:hidden"
              />
              {/* Mobile bar: the concierge stays one tap away as an icon; everything else is in the menu. */}
              <Button
                label={CONCIERGE.title}
                tooltip={CONCIERGE.title}
                variant="ghost"
                href={CONCIERGE.href}
                icon={<Icon icon={CONCIERGE.icon} size="sm" />}
                isIconOnly
                className="lg:hidden"
              />
            </>
          }
        />
      }
    >
      {children}
      <SiteFooter />
      <GlobalVoiceAssistantDrawer />
    </AppShell>
  );
}
