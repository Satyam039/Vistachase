"use client";

// Tour detail page, scaffolded from the Astryx `product-detail` template: a photo
// gallery beside a sticky booking column (title, rating, price, departure + guests,
// primary and secondary actions), with collapsible detail sections below.
// The two columns reflow into one below ~660px (Grid minWidth 320, repeat fit).

import { useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
import { AspectRatio } from "@astryxdesign/core/AspectRatio";
import { Banner } from "@astryxdesign/core/Banner";
import { BreadcrumbItem, Breadcrumbs } from "@astryxdesign/core/Breadcrumbs";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible, CollapsibleGroup } from "@astryxdesign/core/Collapsible";
import { Divider } from "@astryxdesign/core/Divider";
import { Grid } from "@astryxdesign/core/Grid";
import { Icon } from "@astryxdesign/core/Icon";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { SelectableCard } from "@astryxdesign/core/SelectableCard";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { Calendar, Check, Clock, MapPin, ShieldCheck, Sparkles, Star, Users, X } from "lucide-react";
import { QuantityInput } from "@/components/forms/QuantityInput";
import { departureFits, fromPrice, isVehicleTour } from "@/components/tours/TourCard";
import type { DepartureAvailability, TourWithAvailability } from "@/lib/api/types";

// Keeps the booking column in view while the gallery and details scroll. The site's
// AppShell header is sticky too, so the offset adds its measured height
// (published as --_app-shell-header-height; read-only use).
const stickyInfo: CSSProperties = {
  position: "sticky",
  top: "calc(var(--_app-shell-header-height, 0px) + var(--spacing-6))",
  alignSelf: "start",
};

const CATEGORY = {
  SHARED: { label: "Shared tours", href: "/shared-tours" },
  PRIVATE: { label: "Private tours", href: "/private-tours" },
  MULTIDAY: { label: "Multi-day packages", href: "/search?category=MULTIDAY" },
} as const;

const money = (amount: number) =>
  `$${amount.toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function formatDeparture(departure: DepartureAvailability) {
  const parsed = new Date(`${departure.date}T00:00:00`);
  const day = Number.isNaN(parsed.getTime())
    ? departure.date
    : parsed.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${departure.departureTime}`;
}

function TourGallery({ title, images }: { title: string; images: string[] }) {
  const [selected, setSelected] = useState(0);
  return (
    <VStack gap={3}>
      <AspectRatio ratio={4 / 3}>
        <Image
          src={images[selected]}
          alt={title}
          fill
          priority
          sizes="(max-width: 700px) 100vw, 600px"
          className="object-cover rounded-container"
        />
      </AspectRatio>
      {images.length > 1 && (
        <Grid columns={4} gap={2}>
          {images.map((src, i) => (
            <AspectRatio key={src} ratio={1}>
              <SelectableCard
                label={`Photo ${i + 1} of ${images.length}`}
                isSelected={selected === i}
                onChange={() => setSelected(i)}
                variant="transparent"
                padding={0}
                width="100%"
                height="100%"
              >
                <Image src={src} alt="" fill sizes="150px" className="object-cover" />
              </SelectableCard>
            </AspectRatio>
          ))}
        </Grid>
      )}
    </VStack>
  );
}

function DetailList({ items, icon }: { items: string[]; icon: typeof Check }) {
  return (
    <List density="compact">
      {items.map((item) => (
        <ListItem key={item} label={item} startContent={<Icon icon={icon} size="sm" color="secondary" />} />
      ))}
    </List>
  );
}

function BookingPanel({ tour }: { tour: TourWithAvailability }) {
  // Private tours are sold per vehicle: a departure is bookable only while the whole vehicle is free.
  const isVehicle = isVehicleTour(tour);
  const bookable = tour.departures.filter((d) => departureFits(tour, d, 1));
  const [departureId, setDepartureId] = useState(bookable[0]?.id ?? "");
  const departure = tour.departures.find((d) => d.id === departureId);
  const departureSeats = isVehicle ? departure?.capacityTotal : departure?.seatsAvailable;
  const maxGuests = Math.max(1, Math.min(departureSeats ?? tour.maxGroupSize, tour.maxGroupSize));
  const [guests, setGuests] = useState(Math.min(2, maxGuests));
  const partySize = Math.min(guests, maxGuests);

  const options = useMemo(
    () =>
      tour.departures.map((d) => ({
        value: d.id,
        label: formatDeparture(d),
        description: !departureFits(tour, d, 1)
          ? isVehicle
            ? "Booked"
            : "Sold out"
          : isVehicle
            ? `Available · ${money(d.price)} ${d.currency} per vehicle`
            : `${d.seatsAvailable} seats left · ${money(d.price)} ${d.currency}`,
        disabled: !departureFits(tour, d, 1),
      })),
    [tour, isVehicle]
  );

  if (tour.departures.length === 0) {
    return (
      <VStack gap={3}>
        <Banner
          status="info"
          icon={<Icon icon={Calendar} size="sm" />}
          title="Dates on request"
          description="This tour runs on the dates you choose. Tell us your plans and we'll confirm a guide and vehicle."
        />
        <Button
          label="Plan with the AI concierge"
          variant="primary"
          size="lg"
          href="/concierge"
          icon={<Icon icon={Sparkles} size="sm" />}
        />
        <Button label="Contact us" size="lg" href="/contact-us" />
      </VStack>
    );
  }

  if (bookable.length === 0) {
    return (
      <VStack gap={3}>
        <Banner
          status="warning"
          title={isVehicle ? "Every scheduled date is booked" : "Every scheduled departure is sold out"}
          description="Ask our concierge about extra dates or a private charter."
        />
        <Button label="Ask the AI concierge" variant="primary" size="lg" href="/concierge" />
      </VStack>
    );
  }


  return (
    <VStack gap={4}>
      <Selector
        label="Departure"
        options={options}
        value={departureId}
        onChange={setDepartureId}
        hasSearch={options.length > 8}
        placeholder="Choose a date"
      />
      <QuantityInput
        label="Guests"
        description={isVehicle ? `The vehicle seats up to ${maxGuests}` : `Up to ${maxGuests} on this departure`}
        value={partySize}
        onChange={setGuests}
        min={1}
        max={maxGuests}
      />
      {departure && (
        <HStack hAlign="between" vAlign="center" gap={3}>
          <Text type="body" color="secondary">
            {isVehicle ? `Private vehicle for ${partySize} ${partySize === 1 ? "guest" : "guests"}` : `${partySize} × ${money(departure.price)}`}
          </Text>
          <Text type="body" weight="semibold">
            {money(isVehicle ? departure.price : departure.price * partySize)} {departure.currency} + GST
          </Text>
        </HStack>
      )}
      <VStack gap={2}>
        <Button
          label="Book this departure"
          variant="primary"
          size="lg"
          href={`/book?departureId=${encodeURIComponent(departureId)}&guests=${partySize}`}
          isDisabled={!departure}
        />
        <Button label="Ask the AI concierge" size="lg" href="/concierge" icon={<Icon icon={Sparkles} size="sm" />} />
      </VStack>
    </VStack>
  );
}

export function TourDetailView({ tour }: { tour: TourWithAvailability }) {
  const category = CATEGORY[tour.category as keyof typeof CATEGORY] ?? CATEGORY.SHARED;
  const isPrivate = tour.category === "PRIVATE";
  const price = fromPrice(tour);
  const images = Array.from(new Set([tour.featuredImage, ...tour.galleryImages].filter(Boolean)));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: tour.title,
    description: tour.summary,
    touristType: isPrivate ? "Private Group" : "Small Group",
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: tour.currency,
      availability: "https://schema.org/InStock",
    },
    provider: {
      "@type": "TouristInformationCenter",
      name: "Vista Chase",
      url: "https://www.vistachase.com",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: tour.rating.toString(),
      reviewCount: tour.reviewCount.toString(),
    },
  };

  return (
    <Layout
      height="auto"
      contentWidth={1200}
      content={
        <LayoutContent padding={6}>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
          <VStack gap={5}>
            <Breadcrumbs variant="supporting">
              <BreadcrumbItem href="/">Home</BreadcrumbItem>
              <BreadcrumbItem href={category.href}>{category.label}</BreadcrumbItem>
              <BreadcrumbItem isCurrent>{tour.title}</BreadcrumbItem>
            </Breadcrumbs>

            <Grid columns={{ minWidth: 320, repeat: "fit" }} gap={8}>
              <TourGallery title={tour.title} images={images} />

              <VStack gap={5} style={stickyInfo}>
                <VStack gap={2}>
                  <HStack gap={2} wrap="wrap">
                    <Token size="sm" label={tour.destination.name} icon={<Icon icon={MapPin} size="xsm" />} />
                    <Token size="sm" label={category.label.replace(/s$/, "")} />
                  </HStack>
                  <Heading level={1} type="display-2">
                    {tour.title}
                  </Heading>
                  <HStack gap={1.5} vAlign="center">
                    <Icon icon={Star} size="sm" color="warning" />
                    <Text type="body" weight="semibold">
                      {tour.rating.toFixed(1)}
                    </Text>
                    <Text type="body" color="secondary">
                      ({tour.reviewCount} reviews)
                    </Text>
                  </HStack>
                  <HStack gap={1.5} vAlign="end" wrap="wrap">
                    <Text type="large" weight="bold">
                      From {money(price)} {tour.currency}
                    </Text>
                    <Text type="body" color="secondary">
                      {isPrivate ? "per vehicle" : "per guest"}
                    </Text>
                  </HStack>
                </VStack>

                <Text type="large" weight="normal">
                  {tour.summary}
                </Text>

                <HStack gap={4} wrap="wrap">
                  <HStack gap={1.5} vAlign="center">
                    <Icon icon={Clock} size="sm" color="secondary" />
                    <Text type="supporting">{tour.durationHours} hours</Text>
                  </HStack>
                  <HStack gap={1.5} vAlign="center">
                    <Icon icon={Users} size="sm" color="secondary" />
                    <Text type="supporting">
                      {isPrivate ? `Up to ${tour.maxGroupSize}` : `Max ${tour.maxGroupSize}`} guests
                    </Text>
                  </HStack>
                  <HStack gap={1.5} vAlign="center">
                    <Icon icon={MapPin} size="sm" color="secondary" />
                    <Text type="supporting">Hotel pickup included</Text>
                  </HStack>
                </HStack>

                <Divider />
                <BookingPanel tour={tour} />

                <HStack gap={1.5} vAlign="center">
                  <Icon icon={ShieldCheck} size="sm" color="success" />
                  <Text type="supporting">Free cancellation up to 48 hours before departure</Text>
                </HStack>

                <CollapsibleGroup type="multiple" defaultValue={["overview"]}>
                  <Divider />
                  <Collapsible value="overview" trigger={<Heading level={3} accessibilityLevel={2}>Overview</Heading>}>
                    <Text type="body">{tour.description}</Text>
                  </Collapsible>
                  {tour.highlights.length > 0 && (
                    <>
                      <Divider />
                      <Collapsible
                        value="highlights"
                        defaultIsOpen={false}
                        trigger={<Heading level={3} accessibilityLevel={2}>Highlights</Heading>}
                      >
                        <DetailList items={tour.highlights} icon={Sparkles} />
                      </Collapsible>
                    </>
                  )}
                  <Divider />
                  <Collapsible
                    value="included"
                    defaultIsOpen={false}
                    trigger={<Heading level={3} accessibilityLevel={2}>What&apos;s included</Heading>}
                  >
                    <VStack gap={3}>
                      <DetailList items={tour.inclusions} icon={Check} />
                      {tour.exclusions.length > 0 && (
                        <VStack gap={1}>
                          <Text type="label">Not included</Text>
                          <DetailList items={tour.exclusions} icon={X} />
                        </VStack>
                      )}
                    </VStack>
                  </Collapsible>
                  {tour.whatToBring.length > 0 && (
                    <>
                      <Divider />
                      <Collapsible
                        value="bring"
                        defaultIsOpen={false}
                        trigger={<Heading level={3} accessibilityLevel={2}>What to bring</Heading>}
                      >
                        <DetailList items={tour.whatToBring} icon={Check} />
                      </Collapsible>
                    </>
                  )}
                  <Divider />
                </CollapsibleGroup>
              </VStack>
            </Grid>
          </VStack>
        </LayoutContent>
      }
    />
  );
}
