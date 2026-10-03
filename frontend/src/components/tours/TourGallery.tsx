"use client";

// Category listing page, scaffolded from the Astryx `product-gallery` template:
// a two-part header (heading beside intro + call to action) over a uniform card
// grid that reflows 3 → 2 → 1 columns as the width narrows. Browse-only; filtering
// lives on /search.

import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Grid } from "@astryxdesign/core/Grid";
import { Icon } from "@astryxdesign/core/Icon";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { ArrowRight } from "lucide-react";
import { NoResultsIllustration } from "@/components/illustrations";
import { TourCard } from "@/components/tours/TourCard";
import type { TourWithAvailability } from "@/lib/api/types";

export function TourGallery({
  heading,
  intro,
  ctaLabel,
  ctaHref,
  tours,
}: {
  heading: string;
  intro: string;
  ctaLabel: string;
  ctaHref: string;
  tours: TourWithAvailability[];
}) {
  return (
    <Layout
      height="auto"
      contentWidth={1200}
      content={
        <LayoutContent padding={6}>
          <VStack gap={8}>
            <Grid columns={{ minWidth: 280 }} gap={4} align="start">
              <Heading level={1}>{heading}</Heading>
              <VStack gap={3} hAlign="start">
                <Text type="body">{intro}</Text>
                <Button
                  label={ctaLabel}
                  variant="primary"
                  href={ctaHref}
                  endContent={<Icon icon={ArrowRight} color="inherit" />}
                />
              </VStack>
            </Grid>

            {tours.length === 0 ? (
              <EmptyState
                icon={<NoResultsIllustration />}
                title="No tours are listed right now"
                description="New seasonal departures are announced soon. Our concierge can arrange a private charter in the meantime."
                actions={<Button label="Ask the AI concierge" variant="secondary" href="/concierge" />}
              />
            ) : (
              <Grid columns={{ minWidth: 300 }} gap={6}>
                {tours.map((tour) => (
                  <TourCard key={tour.id} tour={tour} headingLevel={2} />
                ))}
              </Grid>
            )}
          </VStack>
        </LayoutContent>
      }
    />
  );
}
