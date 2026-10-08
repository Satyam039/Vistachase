// Bókun → website departures. For every product with a Bókun ID (prisma/catalog/product-map.json),
// reads the next N days of availability from Bókun and creates or updates our TourDeparture rows:
// date, start time, seats left, adult (or per-vehicle) price and child price. Bókun is the source
// of truth; bookings made on this site that Bókun doesn't know about yet still count as taken.
//
// Response shape (GET /activity.json/{id}/availabilities, checked against the live account):
//   date: epoch ms of the day (UTC midnight), startTime "08:00", availabilityCount (seats left),
//   bookedParticipants, soldOut, unavailable, defaultRateId, rates[{ id, pricedPerPerson,
//   maxPerBooking }], pricesByRate[{ activityRateId, pricePerBooking?: { amount },
//   pricePerCategoryUnit: [{ id: categoryId, amount: { amount } }] }]  (amounts in dollars)
// Passenger category names come from GET /activity.json/{id} (pricingCategories).

import prisma from "@/lib/db/prisma";
import { BokunApiClient } from "@/modules/bokun/bokun.client";
import { PRODUCT_MAP, bokunConfig } from "@/modules/bokun/product-map";
import { dateOnly, formatDateOnly, formatTimeOfDay, timeOfDay, todayInMountainTime } from "@/lib/utils/time";

export interface BokunAvailability {
  date: number;
  startTime?: string;
  availabilityCount?: number;
  bookedParticipants?: number;
  soldOut?: boolean;
  unavailable?: boolean;
  defaultRateId?: number;
  rates?: { id: number; pricedPerPerson?: boolean; maxPerBooking?: number | null }[];
  pricesByRate?: {
    activityRateId: number;
    pricePerBooking?: { amount: number } | null;
    pricePerCategoryUnit?: { id: number; amount: { amount: number } }[];
  }[];
}

export interface BokunCategory {
  id: number;
  title: string;
}

/** What one Bókun availability means for our departure (prices in cents). */
export interface MappedDeparture {
  date: string;
  time: string;
  priceCents: number;
  childPriceCents: number | null;
  /** Seats Bókun still sells, and seats Bókun already has booked. */
  seatsLeft: number;
  bookedInBokun: number;
  /** For private tours: guests per vehicle under the default rate. */
  vehicleSeats: number | null;
  status: "ACTIVE" | "FULL" | "CANCELLED";
}

const isChild = (title: string) => /child|youth|kid/i.test(title);
const isInfant = (title: string) => /infant|baby/i.test(title);
const cents = (dollars: number) => Math.round(dollars * 100);

/** Turns one Bókun availability into our departure fields; null when it has no usable price. */
export function mapAvailability(a: BokunAvailability, category: string, categories: BokunCategory[]): MappedDeparture | null {
  const rate = a.rates?.find((r) => r.id === a.defaultRateId) ?? a.rates?.[0];
  const prices = a.pricesByRate?.find((p) => p.activityRateId === rate?.id) ?? a.pricesByRate?.[0];
  if (!prices) return null;

  let priceCents: number | null = null;
  let childPriceCents: number | null = null;
  if (prices.pricePerBooking?.amount != null) {
    priceCents = cents(prices.pricePerBooking.amount);
  } else {
    const units = (prices.pricePerCategoryUnit ?? []).map((u) => ({ id: u.id, amount: u.amount?.amount, title: categories.find((c) => c.id === u.id)?.title ?? "" }));
    const priced = units.filter((u) => typeof u.amount === "number");
    if (category === "PRIVATE") {
      // "Group of 6 / Group of 13" style categories: the price of the smallest group.
      priceCents = priced.length ? cents(Math.min(...priced.map((u) => u.amount))) : null;
    } else {
      const adults = priced.filter((u) => !isChild(u.title) && !isInfant(u.title));
      const children = priced.filter((u) => isChild(u.title));
      const adult = adults.length ? Math.max(...adults.map((u) => u.amount)) : priced.length ? Math.max(...priced.map((u) => u.amount)) : null;
      priceCents = adult != null ? cents(adult) : null;
      childPriceCents = children.length ? cents(Math.min(...children.map((u) => u.amount))) : null;
    }
  }
  if (priceCents == null || priceCents <= 0) return null;

  const seatsLeft = Math.max(0, a.availabilityCount ?? 0);
  return {
    date: new Date(a.date).toISOString().slice(0, 10),
    time: /^\d{2}:\d{2}$/.test(a.startTime ?? "") ? a.startTime! : "00:00",
    priceCents,
    childPriceCents,
    seatsLeft,
    bookedInBokun: Math.max(0, a.bookedParticipants ?? 0),
    vehicleSeats: category === "PRIVATE" ? rate?.maxPerBooking ?? null : null,
    status: a.unavailable ? "CANCELLED" : a.soldOut || seatsLeft === 0 ? "FULL" : "ACTIVE",
  };
}

// Shuttle products also show on /shuttles through their route.
const SHUTTLE_ROUTE_FOR_SLUG: Record<string, string> = {
  "sunrise-shuttle-to-moraine-lake-and-lake-louise": "moraine-lake-sunrise-shuttle",
  "full-day-at-lake-louise-and-moraine-lake": "lake-louise-moraine-connector",
};

// Our bookings Bókun doesn't know about yet still take seats.
const LOCAL_STATUSES = ["CONFIRMED", "PENDING_PAYMENT", "PAID_UNSYNCED", "COMPLETED"] as const;

export interface AvailabilitySyncResult {
  products: number;
  created: number;
  updated: number;
  closed: number;
  errors: string[];
}

export interface BokunAvailabilitySource {
  getAvailabilities(productId: string, start: string, end: string): Promise<unknown>;
  getCategories(productId: string): Promise<BokunCategory[]>;
}

/** The live Bókun API as an availability source. */
export function bokunApiSource(client?: BokunApiClient): BokunAvailabilitySource {
  if (!client) {
    const config = bokunConfig();
    if (!config.accessKey || !config.secretKey) throw new Error("BOKUN_ACCESS_KEY and BOKUN_SECRET_KEY are not set.");
    client = new BokunApiClient(config.accessKey, config.secretKey, config.apiUrl);
  }
  const api = client;
  return {
    getAvailabilities: (id, start, end) => api.getAvailabilities(id, start, end),
    async getCategories(id) {
      const detail = (await api.fetch("GET", `/activity.json/${id}?lang=EN&currency=CAD`)) as { pricingCategories?: BokunCategory[] } | null;
      return (detail?.pricingCategories ?? []).map((c) => ({ id: c.id, title: c.title }));
    },
  };
}

/** Syncs the next `days` days (from today in Banff) for every product with a Bókun ID. */
export async function syncBokunAvailability(options: { source?: BokunAvailabilitySource; days?: number; from?: string } = {}): Promise<AvailabilitySyncResult> {
  const source = options.source ?? bokunApiSource();
  const days = options.days ?? 60;
  const start = options.from ?? todayInMountainTime();
  const end = formatDateOnly(new Date(dateOnly(start).getTime() + (days - 1) * 86_400_000));
  const result: AvailabilitySyncResult = { products: 0, created: 0, updated: 0, closed: 0, errors: [] };

  const routes = Object.fromEntries((await prisma.shuttleRoute.findMany({ select: { id: true, slug: true } })).map((r) => [r.slug, r.id]));

  for (const product of PRODUCT_MAP.filter((p) => p.bokunId && p.bookingMode === "BOKUN")) {
    const tour = await prisma.tour.findUnique({ where: { slug: product.slug }, select: { id: true, category: true, currency: true } });
    if (!tour) continue;
    try {
      const [raw, categories] = await Promise.all([source.getAvailabilities(product.bokunId!, start, end), source.getCategories(product.bokunId!)]);
      const list = (Array.isArray(raw) ? raw : []) as BokunAvailability[];
      const mapped = list.map((a) => mapAvailability(a, tour.category, categories)).filter((m): m is MappedDeparture => m !== null);
      const shuttleRouteId = routes[SHUTTLE_ROUTE_FOR_SLUG[product.slug]] ?? null;
      const seen = new Set<string>();

      for (const m of mapped) {
        seen.add(`${m.date} ${m.time}`);
        const existing = await prisma.tourDeparture.findFirst({
          where: { tourId: tour.id, date: dateOnly(m.date), departureTime: timeOfDay(m.time) },
          include: { bookings: { where: { bokunBookingId: null, status: { in: [...LOCAL_STATUSES] } }, select: { totalSeats: true } } },
        });
        const localSeats = existing?.bookings.reduce((sum, b) => sum + b.totalSeats, 0) ?? 0;

        let capacityTotal: number;
        let capacityBooked: number;
        if (tour.category === "PRIVATE") {
          // One whole vehicle per departure on the site: sold when Bókun has no seats left or a
          // booking on this site already took it.
          capacityTotal = m.vehicleSeats ?? existing?.capacityTotal ?? 6;
          capacityBooked = m.seatsLeft < 1 || localSeats > 0 ? capacityTotal : 0;
        } else {
          capacityTotal = m.seatsLeft + m.bookedInBokun;
          capacityBooked = m.bookedInBokun + localSeats;
        }
        const data = {
          price: m.priceCents,
          childPrice: m.childPriceCents,
          capacityTotal,
          capacityBooked: Math.min(capacityBooked, capacityTotal),
          currency: tour.currency,
          status: m.status,
          shuttleRouteId,
        };
        if (existing) {
          await prisma.tourDeparture.update({ where: { id: existing.id }, data });
          result.updated++;
        } else {
          await prisma.tourDeparture.create({ data: { ...data, tourId: tour.id, date: dateOnly(m.date), departureTime: timeOfDay(m.time), capacityHeld: 0 } });
          result.created++;
        }
      }

      // Departures Bókun no longer lists in this window are closed (unless guests are booked on them).
      const ours = await prisma.tourDeparture.findMany({
        where: { tourId: tour.id, status: { not: "CANCELLED" }, date: { gte: dateOnly(start), lte: dateOnly(end) } },
        include: { _count: { select: { bookings: true } } },
      });
      for (const d of ours) {
        if (seen.has(`${formatDateOnly(d.date)} ${formatTimeOfDay(d.departureTime)}`) || d._count.bookings > 0) continue;
        await prisma.tourDeparture.update({ where: { id: d.id }, data: { status: "CANCELLED" } });
        result.closed++;
      }
      result.products++;
    } catch (error) {
      result.errors.push(`${product.slug}: ${(error as Error).message.slice(0, 200)}`);
    }
  }
  return result;
}
