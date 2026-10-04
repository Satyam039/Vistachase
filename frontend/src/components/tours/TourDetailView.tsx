"use client";

// Tour detail page, scaffolded from the Astryx `product-detail` template: a photo
// gallery beside a sticky booking column (title, rating, facts, price, departure +
// guests, primary and secondary actions). Below it, the live vistachase.com tab
// structure (Overview / Inclusions / Itinerary / Seasonal / FAQ) rendered from the
// imported catalog copy, then "Explore more" cross-sells.
// The two columns reflow into one below ~660px (Grid minWidth 320, repeat fit).

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { SelectableCard } from "@astryxdesign/core/SelectableCard";
import { Selector } from "@astryxdesign/core/Selector";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { Calendar, Check, MapPin, Send, ShieldCheck, Sparkles, Star, X } from "lucide-react";
import { QuantityInput } from "@/components/forms/QuantityInput";
import {
  TourCard,
  departureFits,
  fromPrice,
  isVehicleTour,
  priceUnitLabel,
  reviewsLabel,
} from "@/components/tours/TourCard";
import type { DepartureAvailability, TourSection, TourWithAvailability, VehicleOption } from "@/lib/api/types";

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
  SHUTTLE: { label: "Shuttles", href: "/shuttles" },
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

/** Plain copy from the live page; its line breaks are kept. */
function Copy({ children }: { children: ReactNode }) {
  return (
    <Text type="body" className="whitespace-pre-line">
      {children}
    </Text>
  );
}

function TourSectionBlock({ section }: { section: TourSection }) {
  const isExcluded = /exclude|not included/i.test(section.heading);
  return (
    <VStack gap={3}>
      {section.heading && (
        <Heading level={3} accessibilityLevel={2}>
          {section.heading}
        </Heading>
      )}
      {section.body.map((paragraph) => (
        <Copy key={paragraph}>{paragraph}</Copy>
      ))}
      {section.items.length > 0 && <DetailList items={section.items} icon={isExcluded ? X : Check} />}
      {section.stops.length > 0 && (
        <List>
          {section.stops.map((stop) => (
            <ListItem
              key={stop.name}
              label={stop.name}
              startContent={<Icon icon={MapPin} size="sm" color="secondary" />}
              description={
                <Text type="body" color="secondary">
                  {stop.text}
                </Text>
              }
            />
          ))}
        </List>
      )}
      {section.steps.length > 0 && (
        <List>
          {section.steps.map((step) => (
            <ListItem
              key={`${step.time}-${step.text}`}
              label={step.time || "Then"}
              description={
                <Text type="body" color="secondary" className="whitespace-pre-line">
                  {step.text}
                </Text>
              }
            />
          ))}
        </List>
      )}
      {section.note && (
        <Text type="supporting" color="secondary">
          Note: {section.note}
        </Text>
      )}
    </VStack>
  );
}

/** Tabs mirroring the live product page; FAQs come last as an accordion. */
function TourTabs({ tour }: { tour: TourWithAvailability }) {
  const tabs = [
    ...tour.tabs.filter((t) => t.sections.length > 0).map((t) => ({ id: t.label.toLowerCase(), label: t.label })),
    ...(tour.faqs.length > 0 ? [{ id: "faq", label: "FAQ" }] : []),
  ];
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  if (tabs.length === 0) return null;
  const tab = tour.tabs.find((t) => t.label.toLowerCase() === active);

  return (
    <VStack gap={5}>
      <TabList value={active} onChange={setActive} role="tablist" hasDivider>
        {tabs.map((t) => (
          <Tab key={t.id} value={t.id} label={t.label} panelId={`tour-tab-${t.id}`} />
        ))}
      </TabList>
      <VStack gap={6} id={`tour-tab-${active}`} role="tabpanel" aria-label={tabs.find((t) => t.id === active)?.label}>
        {tab?.sections.map((section, i) => (
          <TourSectionBlock key={`${section.heading}-${i}`} section={section} />
        ))}
        {active === "faq" && (
          <VStack gap={3}>
            <Heading level={3} accessibilityLevel={2}>
              Frequently asked questions
            </Heading>
            <CollapsibleGroup type="multiple">
              {tour.faqs.map((faq, i) => (
                <VStack key={faq.question} gap={0}>
                  <Divider />
                  <Collapsible
                    value={`faq-${i}`}
                    defaultIsOpen={false}
                    trigger={
                      <Text type="body" weight="semibold">
                        {faq.question}
                      </Text>
                    }
                  >
                    <Copy>{faq.answer}</Copy>
                  </Collapsible>
                </VStack>
              ))}
              <Divider />
            </CollapsibleGroup>
          </VStack>
        )}
      </VStack>
    </VStack>
  );
}

/** Private tours run in a 6-seat SUV or a 13-seat van; the choice caps the party size. */
function VehiclePicker({
  options,
  value,
  onChange,
}: {
  options: VehicleOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const selected = options.find((v) => v.id === value) ?? options[0];
  return (
    <VStack gap={1.5}>
      <Text type="label">Vehicle</Text>
      <SegmentedControl label="Vehicle" value={selected.id} onChange={onChange} layout="fill">
        {options.map((v) => (
          <SegmentedControlItem key={v.id} value={v.id} label={`${v.label} · ${v.seats}`} />
        ))}
      </SegmentedControl>
      <Text type="supporting" color="secondary">
        Up to {selected.seats} guests. The whole vehicle and guide are yours for the day.
      </Text>
    </VStack>
  );
}

/** Enquiry-only products (custom itineraries, multi-day): no instant booking on the live site either. */
function EnquiryPanel({ tour }: { tour: TourWithAvailability }) {
  const [vehicleId, setVehicleId] = useState(tour.vehicleOptions[0]?.id ?? "");
  const vehicle = tour.vehicleOptions.find((v) => v.id === vehicleId);
  const maxGuests = vehicle?.seats ?? tour.maxGroupSize;
  const [guests, setGuests] = useState(Math.min(2, maxGuests));
  const partySize = Math.min(guests, maxGuests);
  const params = new URLSearchParams({ tour: tour.slug, guests: String(partySize) });
  if (vehicle) params.set("vehicle", vehicle.id);

  return (
    <VStack gap={4}>
      <Banner
        status="info"
        icon={<Icon icon={Calendar} size="sm" />}
        title="Built around your dates"
        description="Tell us your dates and must-see stops. We reply with a tailored plan and price, usually within a day."
      />
      {tour.vehicleOptions.length > 0 && (
        <VehiclePicker options={tour.vehicleOptions} value={vehicleId} onChange={setVehicleId} />
      )}
      <QuantityInput label="Guests" value={partySize} onChange={setGuests} min={1} max={maxGuests} />
      <VStack gap={2}>
        <Button
          label="Request this tour"
          variant="primary"
          size="lg"
          href={`/contact-us?${params.toString()}`}
          icon={<Icon icon={Send} size="sm" />}
        />
        <Button label="Plan with the AI concierge" size="lg" href="/concierge" icon={<Icon icon={Sparkles} size="sm" />} />
      </VStack>
    </VStack>
  );
}

/** Name of the vehicle a scheduled private departure runs with, from its seat count. */
function vehicleName(tour: TourWithAvailability, seats: number | undefined) {
  const match = tour.vehicleOptions.find((v) => v.seats === seats);
  return match ? `${match.label} seats` : "The vehicle seats";
}

function BookingPanel({ tour }: { tour: TourWithAvailability }) {
  // Private tours are sold per vehicle: a departure is bookable only while the whole vehicle is free.
  const isVehicle = isVehicleTour(tour);
  const bookable = tour.departures.filter((d) => departureFits(tour, d, 1));
  const [departureId, setDepartureId] = useState(bookable[0]?.id ?? "");
  const [guests, setGuests] = useState(2);
  const departure = tour.departures.find((d) => d.id === departureId);
  const departureSeats = isVehicle ? departure?.capacityTotal : departure?.seatsAvailable;
  const maxGuests = Math.max(1, Math.min(departureSeats ?? tour.maxGroupSize, tour.maxGroupSize));
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

  if (tour.bookingMode === "ENQUIRY") {
    return <EnquiryPanel tour={tour} />;
  }

  if (tour.departures.length === 0) {
    return (
      <VStack gap={3}>
        <Banner
          status="info"
          icon={<Icon icon={Calendar} size="sm" />}
          title="Dates on request"
          description="Tell us your preferred date and party size and we'll confirm seats, pickup time and price."
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
        description={
          isVehicle
            ? `${vehicleName(tour, departure?.capacityTotal)} for up to ${maxGuests}`
            : `Up to ${maxGuests} on this departure`
        }
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

export function TourDetailView({
  tour,
  related = [],
}: {
  tour: TourWithAvailability;
  /** Cross-sell tours ("Explore more"), in the order the live page lists them. */
  related?: TourWithAvailability[];
}) {
  const category = CATEGORY[tour.category as keyof typeof CATEGORY] ?? CATEGORY.SHARED;
  const isPrivate = tour.category === "PRIVATE" || tour.category === "MULTIDAY";
  const price = fromPrice(tour);
  const images = Array.from(new Set([tour.featuredImage, ...tour.galleryImages].filter(Boolean)));

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "TouristTrip",
      name: tour.title,
      description: tour.metaDescription ?? tour.summary,
      touristType: isPrivate ? "Private Group" : "Small Group",
      image: images,
      offers: {
        "@type": "Offer",
        price,
        priceCurrency: tour.currency,
        availability: "https://schema.org/InStock",
        ...(tour.priceUnit === "GROUP" && {
          priceSpecification: { "@type": "UnitPriceSpecification", price, priceCurrency: tour.currency, unitText: "group" },
        }),
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
    },
    ...(tour.faqs.length > 0
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: tour.faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: { "@type": "Answer", text: faq.answer },
            })),
          },
        ]
      : []),
  ];

  return (
    <Layout
      height="auto"
      contentWidth={1200}
      content={
        <LayoutContent padding={6}>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
          <VStack gap={8}>
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
                        ({reviewsLabel(tour)})
                      </Text>
                    </HStack>
                    <HStack gap={1.5} vAlign="end" wrap="wrap">
                      <Text type="large" weight="bold">
                        From {money(price)} {tour.currency}
                      </Text>
                      <Text type="body" color="secondary">
                        {priceUnitLabel(tour)}
                      </Text>
                    </HStack>
                  </VStack>

                  {tour.facts.length > 0 && (
                    <Grid columns={2} gap={3}>
                      {tour.facts.map((fact) => (
                        <VStack key={fact.label} gap={0.5}>
                          <Text type="supporting" color="secondary">
                            {fact.label}
                          </Text>
                          <Text type="body" weight="semibold">
                            {fact.value}
                          </Text>
                        </VStack>
                      ))}
                    </Grid>
                  )}

                  <Divider />
                  <BookingPanel tour={tour} />

                  <HStack gap={1.5} vAlign="center">
                    <Icon icon={ShieldCheck} size="sm" color="success" />
                    <Text type="supporting">Free cancellation up to 24 hours before your tour</Text>
                  </HStack>
                </VStack>
              </Grid>
            </VStack>

            <TourTabs tour={tour} />

            {related.length > 0 && (
              <VStack gap={4}>
                <Heading level={3} accessibilityLevel={2}>
                  Explore more
                </Heading>
                <Grid columns={{ minWidth: 280, repeat: "fill" }} gap={4}>
                  {related.map((t) => (
                    <TourCard key={t.id} tour={t} />
                  ))}
                </Grid>
              </VStack>
            )}
          </VStack>
        </LayoutContent>
      }
    />
  );
}
