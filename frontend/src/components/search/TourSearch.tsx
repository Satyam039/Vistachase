"use client";

// Tour search, scaffolded from the Astryx `library` template: a large search field
// over a row of category toggles and filters, results narrowing in place, grouped
// by category when "All" is selected, and a real empty state.
//
// Filters live in the URL (/search?q=&category=&destination=&seats=&date=), so a
// search can be shared or bookmarked and the back button restores it. The server
// renders the first result set from the same params, so the page works without JS.

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { DateInput } from "@astryxdesign/core/DateInput";
import { Divider } from "@astryxdesign/core/Divider";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Grid } from "@astryxdesign/core/Grid";
import { Layout, LayoutContent, LayoutHeader } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { OverflowList } from "@astryxdesign/core/OverflowList";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { ToggleButton, ToggleButtonGroup } from "@astryxdesign/core/ToggleButton";
import { Search } from "lucide-react";
import { NoResultsIllustration } from "@/components/illustrations";
import { TourCard, fromPrice, nextDepartureFor } from "@/components/tours/TourCard";
import type { TourWithAvailability } from "@/lib/api/types";

export interface SearchFilters {
  q: string;
  category: string;
  destination: string;
  seats: number;
  date: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  SHARED: "Shared tours",
  PRIVATE: "Private tours",
  SHUTTLE: "Lake shuttles",
  MULTIDAY: "Multi-day packages",
};

const SORTS = [
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
] as const;
type SortValue = (typeof SORTS)[number]["value"];

const SEAT_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
  value: String(n),
  label: n === 7 ? "7+ guests" : `${n} ${n === 1 ? "guest" : "guests"}`,
}));

const KEYWORD_URL_DELAY_MS = 300;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Narrows a YYYY-MM-DD string to DateInput's ISODateString type; anything else is no date. */
function toIsoDate(value: string): ISODateString | undefined {
  return ISO_DATE.test(value) ? (value as ISODateString) : undefined;
}

function todayIso(): ISODateString {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10) as ISODateString;
}

export function filterTours(tours: TourWithAvailability[], filters: SearchFilters) {
  const keyword = filters.q.trim().toLowerCase();
  return tours.filter((tour) => {
    if (filters.category !== "ALL" && tour.category !== filters.category) return false;
    if (filters.destination !== "ALL" && tour.destination.slug !== filters.destination) return false;
    if (keyword) {
      const text = `${tour.title} ${tour.summary} ${tour.description} ${tour.destination.name} ${tour.highlights.join(" ")}`.toLowerCase();
      if (!text.includes(keyword)) return false;
    }
    // A chosen date narrows to tours that actually run that day with room for the party.
    if (filters.date && !nextDepartureFor(tour, filters.seats, filters.date)) return false;
    return true;
  });
}

function filtersToQuery(filters: SearchFilters) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.category !== "ALL") params.set("category", filters.category);
  if (filters.destination !== "ALL") params.set("destination", filters.destination);
  if (filters.seats !== 1) params.set("seats", String(filters.seats));
  if (filters.date) params.set("date", filters.date);
  return params.toString();
}

export function TourSearch({
  tours,
  destinations,
  initialFilters,
}: {
  tours: TourWithAvailability[];
  destinations: { slug: string; name: string }[];
  initialFilters: SearchFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [sort, setSort] = useState<SortValue>("price-asc");

  const update = (patch: Partial<SearchFilters>) => setFilters((current) => ({ ...current, ...patch }));

  // Mirror filters into the URL; typing is debounced so each keystroke isn't a history entry.
  useEffect(() => {
    const timer = setTimeout(() => {
      const query = filtersToQuery(filters);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, KEYWORD_URL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [filters, pathname, router]);

  // Only offer categories and destinations that have tours.
  const categories = useMemo(
    () => ["ALL", ...Object.keys(CATEGORY_LABELS).filter((c) => tours.some((t) => t.category === c))],
    [tours]
  );
  const destinationOptions = useMemo(
    () => [
      { value: "ALL", label: "All destinations" },
      ...destinations
        .filter((d) => tours.some((t) => t.destination.slug === d.slug))
        .map((d) => ({ value: d.slug, label: d.name })),
    ],
    [destinations, tours]
  );

  const results = useMemo(() => {
    const filtered = filterTours(tours, filters);
    return [...filtered].sort((a, b) => {
      if (sort === "price-desc") return fromPrice(b) - fromPrice(a);
      if (sort === "rating") return b.rating - a.rating || b.reviewCount - a.reviewCount;
      return fromPrice(a) - fromPrice(b);
    });
  }, [tours, filters, sort]);

  const sections = useMemo(() => {
    if (filters.category !== "ALL") {
      return [{ category: filters.category, items: results }];
    }
    return categories
      .filter((c) => c !== "ALL")
      .map((category) => ({ category, items: results.filter((t) => t.category === category) }))
      .filter((section) => section.items.length > 0);
  }, [filters.category, results, categories]);

  const hasActiveFilters = filtersToQuery({ ...filters, seats: 1 }) !== "" || filters.seats !== 1;
  const sortLabel = SORTS.find((s) => s.value === sort)?.label ?? SORTS[0].label;

  return (
    <Layout
      height="auto"
      contentWidth={1200}
      header={
        <LayoutHeader hasDivider padding={6}>
          <VStack gap={1}>
            <Heading level={1}>Find your Rockies tour</Heading>
            <Text type="supporting" color="secondary">
              Live seat availability across Banff, Lake Louise, Moraine Lake, Yoho and Jasper.
            </Text>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={6}>
          <VStack gap={6}>
            <VStack gap={4}>
              <TextInput
                label="Search tours"
                isLabelHidden
                placeholder="Search Moraine Lake, sunrise, Icefields…"
                value={filters.q}
                onChange={(q) => update({ q })}
                startIcon={Search}
                size="lg"
              />
              <HStack vAlign="center" gap={4} wrap="wrap">
                <StackItem size="fill">
                  <VStack>
                    <ToggleButtonGroup
                      label="Filter by tour type"
                      value={filters.category}
                      onChange={(value) => update({ category: typeof value === "string" ? value : "ALL" })}
                    >
                      <OverflowList
                        gap={1}
                        behavior="observeParent"
                        overflowRenderer={(overflowItems) => (
                          <DropdownMenu
                            button={{ label: `+${overflowItems.length}`, variant: "ghost", size: "lg" }}
                            items={overflowItems.map(({ index }) => ({
                              label: index === 0 ? "All tours" : CATEGORY_LABELS[categories[index]],
                              onClick: () => update({ category: categories[index] }),
                            }))}
                          />
                        )}
                      >
                        {categories.map((category) => (
                          <ToggleButton
                            key={category}
                            label={category === "ALL" ? "All tours" : CATEGORY_LABELS[category]}
                            value={category}
                            size="lg"
                          />
                        ))}
                      </OverflowList>
                    </ToggleButtonGroup>
                  </VStack>
                </StackItem>
                <DropdownMenu
                  button={{ label: sortLabel, size: "lg" }}
                  items={SORTS.map((option) => ({ label: option.label, onClick: () => setSort(option.value) }))}
                />
              </HStack>
              <Grid columns={{ minWidth: 220 }} gap={4}>
                <Selector
                  label="Destination"
                  options={destinationOptions}
                  value={filters.destination}
                  onChange={(destination) => update({ destination })}
                />
                <Selector
                  label="Guests"
                  options={SEAT_OPTIONS}
                  value={String(filters.seats)}
                  onChange={(seats) => update({ seats: Number(seats) || 1 })}
                />
                <DateInput
                  label="Date"
                  isOptional
                  value={toIsoDate(filters.date)}
                  onChange={(date) => update({ date: date ?? "" })}
                  min={todayIso()}
                />
              </Grid>
              <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
                <Text type="supporting" color="secondary">
                  {results.length} {results.length === 1 ? "tour" : "tours"}
                  {filters.date ? " running that day" : ""} for {filters.seats}{" "}
                  {filters.seats === 1 ? "guest" : "guests"}
                </Text>
                <Text type="supporting" color="secondary">
                  Looking for a lake shuttle?{" "}
                  <Link href="/shuttles">See Moraine Lake &amp; Lake Louise shuttles</Link>
                </Text>
              </HStack>
            </VStack>

            {results.length === 0 ? (
              <EmptyState
                icon={<NoResultsIllustration />}
                title="No tours match these filters"
                description={
                  filters.date
                    ? "Nothing runs that day with room for your party. Try another date or a smaller group."
                    : "Try a different keyword, destination or tour type."
                }
                actions={
                  hasActiveFilters ? (
                    <Button
                      label="Clear all filters"
                      variant="secondary"
                      onClick={() => setFilters({ q: "", category: "ALL", destination: "ALL", seats: 1, date: "" })}
                    />
                  ) : undefined
                }
              />
            ) : (
              <VStack gap={6}>
                {sections.flatMap((section) => [
                  <Divider key={`divider-${section.category}`} />,
                  <VStack key={section.category} gap={6}>
                    <Heading level={2}>{CATEGORY_LABELS[section.category] ?? "Tours"}</Heading>
                    <Grid columns={{ minWidth: 300 }} gap={6}>
                      {section.items.map((tour) => (
                        <TourCard key={tour.id} tour={tour} seats={filters.seats} date={filters.date || undefined} />
                      ))}
                    </Grid>
                  </VStack>,
                ])}
              </VStack>
            )}
          </VStack>
        </LayoutContent>
      }
    />
  );
}
