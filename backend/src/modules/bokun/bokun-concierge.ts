// Bókun Concierge Integration: direct Bókun API data for AI concierge agents.
//
// Provides real-time booking lookups, tour activity details, and live seat availability
// directly from Bókun (https://api.bokun.io) rather than relying only on local database records.
//
// When Bókun is connected, this is the authoritative source of truth for:
//   - Booking details: exact Bókun status, confirmation codes, passengers, pickup notes, custom answers
//   - Tour details: live Bókun titles, inclusions, exclusions, pricing categories, booking questions
//   - Availabilities: live Bókun seat counts and departure times

import prisma from "@/lib/db/prisma";
import { bokunClient, bokunConnected, type BokunApi } from "@/modules/bokun/config";
import { findInBokun } from "@/modules/bokun/bokun-booking";
import { PRODUCT_MAP } from "@/modules/tours/product-map";
import { websiteName } from "@/lib/ai/concierge.catalog";
import { formatDateOnly, formatTimeOfDay } from "@/lib/utils/time";
import { signBookingLink, voucherLink } from "@/lib/security/signed-links";

export interface BokunBookingDetails {
  confirmationCode: string;
  bookingReference: string | null;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  tourTitle: string;
  departureDate: string;
  departureTime: string;
  totalSeats: number;
  passengerBreakdown?: string;
  pickupLocation: string;
  pickupTime?: string;
  dropoffLocation?: string;
  specialRequests?: string;
  notes?: string;
  totalAmount: number; // dollars
  currency: string;
  paymentStatus?: string;
  voucherCode?: string;
  voucherUrl?: string;
  trackingToken?: string;
  bookingQuestions?: { question: string; answer: string }[];
  source: "BOKUN" | "LOCAL";
}

export interface BokunTourDetails {
  bokunId: string;
  slug?: string;
  title: string;
  summary: string;
  description: string;
  duration?: string;
  inclusions: string[];
  exclusions: string[];
  pricingCategories: { id: number; title: string; minAge?: number; maxAge?: number }[];
  bookingQuestions: { id: string; label: string; required?: boolean; type?: string }[];
  pickupPlaces?: string[];
  stops?: string[];
  bookingMode: "BOKUN";
}

const TOUR_CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute memory cache for Bókun product details
const tourCache = new Map<string, { data: BokunTourDetails; expiresAt: number }>();

/** Tests: clear tour details cache. */
export function clearBokunTourCacheForTests() {
  tourCache.clear();
}

/**
 * Normalizes Bókun dates from epoch ms, ISO string or YYYY-MM-DD.
 */
function normalizeDate(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return new Date(Math.round(raw / 86_400_000) * 86_400_000).toISOString().slice(0, 10);
  }
  if (typeof raw === "string") {
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    if (/^\d{10,}$/.test(raw)) return normalizeDate(Number(raw));
  }
  return null;
}

/**
 * Normalizes Bókun time from string or { hour, minute }.
 */
function normalizeTime(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    if (typeof o.hour === "number") {
      const h = String(o.hour).padStart(2, "0");
      const m = String(o.minute ?? 0).padStart(2, "0");
      return `${h}:${m}`;
    }
  }
  if (typeof raw === "string") {
    const m = raw.match(/(?:^|T|\s)(\d{1,2}):(\d{2})/);
    if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  }
  return null;
}

/**
 * Fetches booking details directly from Bókun by Bókun confirmation code or Vista Chase reference.
 * If found in Bókun, returns the live authoritative Bókun data merged with local voucher links.
 * If Bókun is unreachable or unconfigured, seamlessly falls back to Prisma database records.
 */
export async function getBokunBookingDetails(
  referenceOrCode: string,
  customerEmail?: string,
  client: BokunApi | null = bokunClient()
): Promise<BokunBookingDetails | null> {
  const ref = String(referenceOrCode ?? "").trim();
  if (!ref) return null;
  const email = customerEmail ? String(customerEmail).trim().toLowerCase() : undefined;

  // 1. Check local Prisma database for matching booking record
  let localBooking: any = null;
  try {
    localBooking = await prisma.booking.findFirst({
      where: {
        OR: [
          { bookingReference: { equals: ref, mode: "insensitive" } },
          { bokunBookingId: { equals: ref, mode: "insensitive" } },
          { voucherCode: { equals: ref, mode: "insensitive" } },
        ],
      },
      include: {
        tourDeparture: {
          include: {
            tour: true,
            shuttleRoute: true,
          },
        },
        pickupStop: true,
      },
    });
  } catch {
    // Prisma database read failed or DB offline: proceed directly with Bókun lookup
  }

  // Verify email on local booking if provided and client is not querying Bókun
  if (localBooking && email && localBooking.customerEmail.toLowerCase() !== email && !client) {
    return null;
  }

  // 2. Query Bókun directly if Bókun client is connected
  if (client) {
    let bokunCode: string | null = null;

    if (localBooking?.bokunBookingId) {
      bokunCode = localBooking.bokunBookingId;
    } else if (ref.toUpperCase().startsWith("VC-")) {
      // Search Bókun by external reference
      const found = await findInBokun(client, ref);
      if (found?.code) bokunCode = found.code;
    } else {
      // Direct Bókun confirmation code (e.g. VistaChase-108972148 or numeric ID)
      bokunCode = ref;
    }

    if (bokunCode) {
      try {
        const raw = (await client.fetch("GET", `/booking.json/booking/${encodeURIComponent(bokunCode)}`)) as Record<string, unknown> | null;
        if (raw && typeof raw === "object") {
          const customer = (raw.customer ?? raw.mainContactDetails ?? {}) as Record<string, unknown>;
          const bokunCustomerEmail = String(customer.email ?? "").trim().toLowerCase();
          const localCustomerEmail = localBooking ? localBooking.customerEmail.toLowerCase() : "";

          // Security check: if email is required, ensure it matches either Bókun's customer or local booking
          if (email && bokunCustomerEmail && bokunCustomerEmail !== email && localCustomerEmail !== email) {
            return null;
          }

          const activity = (Array.isArray(raw.activityBookings) ? raw.activityBookings[0] : null) as Record<string, unknown> | null;
          const activityDetails = (activity?.activity ?? {}) as Record<string, unknown>;
          const tourTitle = String(
            activityDetails.title ?? activity?.title ?? activity?.activityTitle ?? raw.productTitle ?? localBooking?.tourDeparture?.tour?.title ?? "Tour Experience"
          );

          const date =
            normalizeDate(activity?.date) ??
            normalizeDate(activity?.startDate) ??
            normalizeDate(activity?.startDateTime) ??
            (localBooking ? formatDateOnly(localBooking.tourDeparture.date) : "TBD");

          const time =
            normalizeTime(activity?.startTime) ??
            normalizeTime(activity?.startTimeStr) ??
            normalizeTime(activity?.startDateTime) ??
            (localBooking ? formatTimeOfDay(localBooking.tourDeparture.departureTime) : "08:00");

          const participants = Number(
            activity?.totalParticipants ?? (Array.isArray(activity?.pricingCategoryBookings) ? activity!.pricingCategoryBookings.length : localBooking?.totalSeats ?? 1)
          );

          // Format passenger categories (e.g. "2 Adults, 1 Child")
          let passengerBreakdown: string | undefined;
          if (Array.isArray(activity?.pricingCategoryBookings) && activity!.pricingCategoryBookings.length > 0) {
            passengerBreakdown = (activity!.pricingCategoryBookings as any[])
              .map((p) => {
                const count = p.bookedSeats ?? p.quantity ?? 1;
                const catTitle = p.pricingCategory?.title ?? p.title ?? "Guest";
                return `${count} ${catTitle}`;
              })
              .join(", ");
          }

          // Pickup information from Bókun
          const pickupPlace = (activity?.pickupPlace ?? {}) as Record<string, unknown>;
          const pickupLocation =
            String(
              activity?.pickupPlaceDescription ??
              pickupPlace.title ??
              pickupPlace.name ??
              activity?.pickupAddress ??
              pickupPlace.address ??
              localBooking?.pickupStop?.name ??
              localBooking?.pickupCustomText ??
              "Banff / Canmore Area"
            );

          const pickupTime = normalizeTime(activity?.pickupTime) ?? (localBooking?.pickupTime ? localBooking.pickupTime : time);
          const dropoffPlace = (activity?.dropoffPlace ?? {}) as Record<string, unknown>;
          const dropoffLocation = dropoffPlace.title ? String(dropoffPlace.title) : undefined;

          // Notes & Special Requests from Bókun
          const notes = String(raw.notes ?? activity?.notes ?? "").trim();
          const specialRequests = String(raw.specialRequests ?? localBooking?.specialRequests ?? notes).trim();

          // Pricing
          let totalPriceDollars = localBooking ? localBooking.totalAmount / 100 : 0;
          for (const key of ["totalPrice", "totalDue", "priceWithDiscount", "totalPriceAmount"]) {
            const v = Number(raw[key]);
            if (Number.isFinite(v) && v > 0) {
              totalPriceDollars = v;
              break;
            }
          }

          const currency = String(raw.currency ?? localBooking?.currency ?? "CAD");
          const status = String(activity?.status ?? raw.status ?? localBooking?.status ?? "CONFIRMED").toUpperCase();
          const firstName = String(customer.firstName ?? "").trim();
          const lastName = String(customer.lastName ?? "").trim();
          const customerName = `${firstName} ${lastName}`.trim() || localBooking?.customerName || "Valued Guest";
          const customerPhone = String(customer.phoneNumber ?? customer.phone ?? localBooking?.customerPhone ?? "").trim();

          const voucherCode = localBooking?.voucherCode ?? String(raw.confirmationCode ?? bokunCode);
          const bookingRef = String(raw.externalBookingReference ?? localBooking?.bookingReference ?? ref);

          return {
            confirmationCode: String(raw.confirmationCode ?? bokunCode),
            bookingReference: bookingRef,
            status,
            customerName,
            customerEmail: bokunCustomerEmail || localCustomerEmail || email || "",
            customerPhone: customerPhone || undefined,
            tourTitle,
            departureDate: date,
            departureTime: time,
            totalSeats: Number.isFinite(participants) ? participants : 1,
            passengerBreakdown,
            pickupLocation,
            pickupTime: pickupTime || undefined,
            dropoffLocation,
            specialRequests: specialRequests || undefined,
            notes: notes || undefined,
            totalAmount: totalPriceDollars,
            currency,
            paymentStatus: String(raw.paymentStatus ?? (status === "CONFIRMED" ? "PAID" : "PENDING")),
            voucherCode,
            voucherUrl: localBooking ? `/booking/${localBooking.bookingReference}/voucher` : undefined,
            trackingToken: localBooking?.trackingToken ?? undefined,
            source: "BOKUN",
          };
        }
      } catch (err) {
        console.warn(`[bokun-concierge] direct Bókun fetch for ${bokunCode} failed: ${(err as Error).message}`);
      }
    }
  }

  // 3. Fallback to Prisma database booking if Bókun was offline or booking is only stored locally
  if (localBooking) {
    if (email && localBooking.customerEmail.toLowerCase() !== email) return null;
    const title = localBooking.tourDeparture.tour ? websiteName(localBooking.tourDeparture.tour) : localBooking.tourDeparture.shuttleRoute?.name ?? "Tour Experience";

    return {
      confirmationCode: localBooking.bokunBookingId ?? localBooking.bookingReference,
      bookingReference: localBooking.bookingReference,
      status: localBooking.status,
      customerName: localBooking.customerName,
      customerEmail: localBooking.customerEmail,
      customerPhone: localBooking.customerPhone,
      tourTitle: title,
      departureDate: formatDateOnly(localBooking.tourDeparture.date),
      departureTime: formatTimeOfDay(localBooking.tourDeparture.departureTime),
      totalSeats: localBooking.totalSeats,
      passengerBreakdown: `${localBooking.adultsCount} Adult${localBooking.adultsCount > 1 ? "s" : ""}${localBooking.childrenCount > 0 ? `, ${localBooking.childrenCount} Child${localBooking.childrenCount > 1 ? "ren" : ""}` : ""}${localBooking.infantsCount > 0 ? `, ${localBooking.infantsCount} Infant${localBooking.infantsCount > 1 ? "s" : ""}` : ""}`,
      pickupLocation: localBooking.pickupStop?.name ?? localBooking.pickupCustomText ?? "Banff Station",
      pickupTime: localBooking.pickupTime ?? formatTimeOfDay(localBooking.tourDeparture.departureTime),
      specialRequests: localBooking.specialRequests ?? undefined,
      totalAmount: localBooking.totalAmount / 100,
      currency: localBooking.currency,
      paymentStatus: localBooking.status === "CONFIRMED" ? "PAID" : "PENDING",
      voucherCode: localBooking.voucherCode,
      voucherUrl: `/booking/${localBooking.bookingReference}/voucher`,
      trackingToken: localBooking.trackingToken ?? undefined,
      source: "LOCAL",
    };
  }

  return null;
}

/**
 * Fetches tour/activity details directly from Bókun (GET /activity.json/{bokunId}?lang=EN&currency=CAD).
 * Caches in memory for 5 minutes so rapid chat turns avoid repeated HTTP roundtrips.
 */
export async function getBokunTourDetails(
  tourSlugOrBokunId: string,
  client: BokunApi | null = bokunClient()
): Promise<BokunTourDetails | null> {
  const query = String(tourSlugOrBokunId ?? "").trim();
  if (!query) return null;

  // Resolve bokunId from PRODUCT_MAP or prisma.tour
  let bokunId: string | null = null;
  let slug: string | undefined;

  const mapped = PRODUCT_MAP.find((p) => p.slug === query || p.bokunId === query);
  if (mapped?.bokunId) {
    bokunId = mapped.bokunId;
    slug = mapped.slug;
  } else if (/^\d+$/.test(query)) {
    bokunId = query;
  } else {
    try {
      const dbTour = await prisma.tour.findFirst({
        where: { OR: [{ slug: query }, { id: query }, { bokunId: query }] },
        select: { bokunId: true, slug: true },
      });
      if (dbTour?.bokunId) {
        bokunId = dbTour.bokunId;
        slug = dbTour.slug;
      }
    } catch {
      // database read error
    }
  }

  if (!bokunId) return null;

  // Check cache
  const cached = tourCache.get(bokunId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  if (!client) return null;

  try {
    const raw = (await client.fetch("GET", `/activity.json/${encodeURIComponent(bokunId)}?lang=EN&currency=CAD`)) as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") return null;

    const title = String(raw.title ?? raw.name ?? "").replace(/&amp;/g, "&").trim();
    const summary = String(raw.excerpt ?? raw.summary ?? "").replace(/&amp;/g, "&").trim();
    const description = String(raw.description ?? summary).replace(/&amp;/g, "&").trim();

    // Inclusions & Exclusions
    const parseList = (val: unknown): string[] => {
      if (Array.isArray(val)) return val.map((v) => String(v.title ?? v.name ?? v).trim()).filter(Boolean);
      if (typeof val === "string") return val.split(/\n|;/).map((s) => s.trim().replace(/^[-*•]\s*/, "")).filter(Boolean);
      return [];
    };

    const inclusions = parseList(raw.inclusions ?? raw.included);
    const exclusions = parseList(raw.exclusions ?? raw.notIncluded);

    // Pricing categories (Adults, Children, etc.)
    const pricingCategories = (Array.isArray(raw.pricingCategories) ? raw.pricingCategories : []).map((c: any) => ({
      id: Number(c.id),
      title: String(c.title ?? c.name ?? "Guest"),
      minAge: c.minAge != null ? Number(c.minAge) : undefined,
      maxAge: c.maxAge != null ? Number(c.maxAge) : undefined,
    }));

    // Booking questions (e.g. required pickup hotel, dietary requirements, phone)
    const bookingQuestions = (Array.isArray(raw.bookingQuestions) ? raw.bookingQuestions : []).map((q: any) => ({
      id: String(q.id ?? q.questionId ?? ""),
      label: String(q.question ?? q.label ?? q.title ?? ""),
      required: Boolean(q.required),
      type: q.dataType ? String(q.dataType) : undefined,
    }));

    // Pickup points
    const pickupPlaces = (Array.isArray(raw.pickupPlaces) ? raw.pickupPlaces : []).map((p: any) =>
      String(p.title ?? p.name ?? p.address ?? "").trim()
    ).filter(Boolean);

    // Agenda / stops
    const agendaList: unknown = raw.agendaItems ?? raw.itinerary;
    const stops = (Array.isArray(agendaList) ? agendaList : []).map((s: any) =>
      String(s.title ?? s.name ?? "").trim()
    ).filter(Boolean);

    let duration: string | undefined;
    if (typeof raw.durationHours === "number" && raw.durationHours > 0) {
      duration = `${raw.durationHours} hours`;
    } else if (typeof raw.durationDays === "number" && raw.durationDays > 0) {
      duration = `${raw.durationDays} days`;
    }

    const data: BokunTourDetails = {
      bokunId,
      slug,
      title,
      summary,
      description,
      duration,
      inclusions,
      exclusions,
      pricingCategories,
      bookingQuestions,
      pickupPlaces: pickupPlaces.length ? pickupPlaces : undefined,
      stops: stops.length ? stops : undefined,
      bookingMode: "BOKUN",
    };

    tourCache.set(bokunId, { data, expiresAt: Date.now() + TOUR_CACHE_TTL_MS });
    return data;
  } catch (err) {
    console.warn(`[bokun-concierge] failed to fetch Bókun tour details for ${bokunId}: ${(err as Error).message}`);
    return null;
  }
}
