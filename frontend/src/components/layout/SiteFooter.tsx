"use client";

// Site footer built from Astryx primitives and tokens (Astryx has no page-footer
// component; its footers are in-layout action bars). Columns reflow through
// Grid minWidth: 4 across on wide screens, 2 on tablets, 1 on phones.

import { Badge } from "@astryxdesign/core/Badge";
import { Divider } from "@astryxdesign/core/Divider";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { Section } from "@astryxdesign/core/Section";
import { HStack, Stack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Award, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandMark";

type FooterLink = { label: string; href: string };

const EXPERIENCE_LINKS: FooterLink[] = [
  { label: "Moraine Lake shuttles", href: "/shuttles" },
  { label: "Banff Highlights Tour", href: "/banff-highlights-tour" },
  { label: "Private SUV tours", href: "/private-tours" },
  { label: "Yoho & Emerald Lake tour", href: "/banff-yoho-custom-private-tour" },
  { label: "Icefields Parkway & Jasper", href: "/icefields-jasper-private-tour" },
  { label: "3-day luxury packages", href: "/multi-day-tour-package-for-banff" },
];

const DESTINATION_LINKS: FooterLink[] = [
  { label: "Moraine Lake", href: "/destinations/moraine-lake" },
  { label: "Lake Louise", href: "/destinations/lake-louise" },
  { label: "Banff National Park", href: "/destinations/banff-national-park" },
  { label: "Jasper National Park", href: "/destinations/jasper-national-park" },
  { label: "Hotel pickup finder", href: "/pickup-finder" },
  { label: "AI voice concierge", href: "/concierge" },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: "Terms & conditions", href: "/terms-and-conditions" },
  { label: "Privacy policy", href: "/privacy-policy" },
  { label: "FAQ & cancellation", href: "/faq" },
  { label: "Affiliates & Bókun agents", href: "/affiliates" },
  { label: "Staff portal", href: "/admin" },
];

function LinkColumn({ heading, links }: { heading: string; links: FooterLink[] }) {
  return (
    <VStack gap={3}>
      <Heading level={5} accessibilityLevel={2}>
        {heading}
      </Heading>
      <VStack as="ul" gap={2}>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} color="secondary" isStandalone>
              {link.label}
            </Link>
          </li>
        ))}
      </VStack>
    </VStack>
  );
}

export function SiteFooter() {
  return (
    // Section puts className on an outer wrapper, outside its background, so the page
    // margin goes on the inner Stack to keep the muted background full-bleed.
    <Section variant="muted" padding={0} paddingBlock={10}>
      <Stack maxWidth={1280} gap={8} className="mx-auto w-full px-page">
        <Grid columns={{ minWidth: 220, repeat: "fit" }} gap={8}>
          <VStack gap={4}>
            <BrandLogo height={72} />
            <Text as="p" color="secondary">
              Banff and the Canadian Rockies&apos; top-rated tour operator since 2018, ranked the #6
              experience in Canada in TripAdvisor&apos;s 2025 Travelers&apos; Choice Best of the Best.
            </Text>
            <Badge
              variant="yellow"
              icon={<Icon icon={Award} size="xsm" />}
              label="TripAdvisor Best of the Best 2025"
            />
          </VStack>

          <LinkColumn heading="Experiences" links={EXPERIENCE_LINKS} />
          <LinkColumn heading="Destinations & tools" links={DESTINATION_LINKS} />

          <VStack gap={3}>
            <Heading level={5} accessibilityLevel={2}>
              Headquarters
            </Heading>
            <HStack gap={2} vAlign="start">
              <Icon icon={MapPin} size="sm" color="secondary" />
              <Text color="secondary">121 Bow Meadows Crescent #110, Canmore, AB T1W 2W8, Canada</Text>
            </HStack>
            <HStack gap={2} vAlign="center">
              <Icon icon={Phone} size="sm" color="secondary" />
              <Link href="tel:+18257349456" color="secondary" isStandalone>
                +1 (825) 734-9456
              </Link>
            </HStack>
            <HStack gap={2} vAlign="center">
              <Icon icon={Mail} size="sm" color="secondary" />
              <Link href="mailto:info@vistachase.com" color="secondary" isStandalone>
                info@vistachase.com
              </Link>
            </HStack>
            <HStack gap={2} vAlign="center">
              <Icon icon={ShieldCheck} size="sm" color="success" />
              <Text type="supporting">Parks Canada licensed commercial operator</Text>
            </HStack>
          </VStack>
        </Grid>

        <Divider />

        <Stack direction="horizontal" wrap="wrap" gap={4} justify="between" vAlign="center">
          <Text type="supporting">
            © {new Date().getFullYear()} Vista Chase Tours Ltd. All rights reserved.
          </Text>
          <HStack as="ul" gap={5} wrap="wrap">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} color="secondary" size="sm">
                  {link.label}
                </Link>
              </li>
            ))}
          </HStack>
        </Stack>
      </Stack>
    </Section>
  );
}
