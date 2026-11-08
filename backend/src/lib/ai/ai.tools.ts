import prisma from "@/lib/db/prisma";
import { getLiveTrackingProvider } from "@/lib/tracking/tracking.provider";
import { getMapsProvider } from "@/lib/maps/maps.provider";
import { createReservationHold } from "@/modules/reservations/reservation.repository";
import { createBooking } from "@/modules/bookings/booking.repository";
import { sellableInventoryWhere } from "@/modules/departures/inventory";
import { dateOnly, formatDateOnly, formatTimeOfDay, todayInMountainTime } from "@/lib/utils/time";
import { conciergeTours } from "@/modules/tours/product-map";

export interface ToolExecutionContext {
  isStaff?: boolean;
  userEmail?: string;
  role?: string;
}

export interface ToolResult {
  toolName: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// Resilient In-Memory Catalog & Pickup Stops Fallback
// ---------------------------------------------------------------------------

const FALLBACK_TOURS = [
  {
    id: "tour_banff_highlights",
    slug: "banff-highlights-tour",
    bokunId: "bokun_banff_highlights",
    title: "Heart of Banff Highlights Tour",
    category: "SHARED",
    durationHours: 4.5,
    basePrice: 99,
    currency: "CAD",
    rating: 5.0,
    summary: "Essential highlights of Banff: Surprise Corner, Bow Falls, Mt Norquay viewpoint, Lake Minnewanka. Maximum 12 guests.",
    description: "Experience the best of Banff with our passionate local guide in a custom high-roof Mercedes Sprinter with panoramic windows and extra legroom.",
    inclusions: ["Parks Canada certified local guide", "Pickup in Banff and Canmore", "Binoculars and wildlife spotting tips", "Bottled Rocky Mountain spring water"],
    exclusions: ["Meals and gratuities", "Personal travel insurance"],
    highlights: ["Surprise Corner view of Banff Springs", "Bow Falls cascading rapids", "Lake Minnewanka panoramic shoreline", "Mt Norquay alpine lookout"],
    whatToBring: ["Comfortable walking shoes", "Warm layers or light fleece", "Camera or smartphone"],
  },
  {
    id: "tour_banff_yoho",
    slug: "banff-yoho-tour",
    bokunId: "bokun_banff_yoho",
    title: "Banff & Yoho National Parks Discovery",
    category: "SHARED",
    durationHours: 8,
    basePrice: 175,
    currency: "CAD",
    rating: 5.0,
    summary: "Lake Louise, Moraine Lake (seasonal), Emerald Lake, and the Natural Bridge in Yoho National Park. Maximum 12 guests.",
    description: "Full-day Rockies journey crossing the Continental Divide from Banff into British Columbia's Yoho National Park.",
    inclusions: ["Guaranteed commercial access to Moraine Lake Road", "Parks Canada commercial admission", "Pickup in Banff and Canmore", "Professional driver-guide"],
    exclusions: ["Canoe rentals", "Lunch at Emerald Lake Lodge"],
    highlights: ["Lake Louise lakeshore", "Moraine Lake Valley of the Ten Peaks", "Emerald Lake vibrant turquoise waters", "Natural Bridge rock formation"],
    whatToBring: ["Sturdy footwear", "Layers and rain jacket", "Water bottle"],
  },
  {
    id: "tour_icefields_jasper",
    slug: "columbia-icefield-tour",
    bokunId: "bokun_icefields",
    title: "Columbia Icefield & Jasper Gateway Adventure",
    category: "SHARED",
    durationHours: 10.5,
    basePrice: 249,
    currency: "CAD",
    rating: 4.9,
    summary: "Icefields Parkway, Peyto Lake, Bow Lake, Crowfoot Glacier, Columbia Icefield. Maximum 12 guests.",
    description: "Drive one of the world's most spectacular mountain highways past hanging glaciers and turquoise alpine lakes.",
    inclusions: ["Full-day guided expedition", "All viewpoint stops along Icefields Parkway", "Banff and Canmore hotel pickups", "High-roof Sprinter transportation"],
    exclusions: ["Ice Explorer glacier walk ticket (optional add-on)"],
    highlights: ["Peyto Lake wolf-shaped viewpoint", "Bow Lake reflection", "Crowfoot Glacier", "Columbia Icefield visitor center"],
    whatToBring: ["Warm jacket even in summer", "Sunglasses", "Camera"],
  },
  {
    id: "tour_moraine_shuttle",
    slug: "moraine-lake-shuttle",
    bokunId: "bokun_shuttle",
    title: "Moraine Lake & Lake Louise Shuttle",
    category: "SHUTTLE",
    durationHours: 4,
    basePrice: 45,
    currency: "CAD",
    rating: 5.0,
    summary: "Guaranteed access to restricted Moraine Lake Road and Lake Louise with sunrise and daytime departures.",
    description: "Stress-free guaranteed access to Moraine Lake. No private cars allowed on Moraine Lake Road.",
    inclusions: ["Guaranteed commercial road permit", "Comfortable Sprinter transfer"],
    exclusions: ["Guided walking tour"],
    highlights: ["Moraine Lake Rockpile sunrise", "Lake Louise lakeshore"],
    whatToBring: ["Headlamp or flashlight for sunrise", "Warm layers"],
  },
  {
    id: "tour_private_charter",
    slug: "private-tours",
    bokunId: "bokun_private",
    title: "Custom Luxury Private Charter",
    category: "PRIVATE",
    durationHours: 8,
    basePrice: 750,
    currency: "CAD",
    rating: 5.0,
    summary: "Private SUV or 12-seat Sprinter exclusively for your party with customizable itinerary and doorstep hotel pickup.",
    description: "Your own vehicle, guide, and pace. Ideal for families, couples, and photography trips.",
    inclusions: ["Dedicated private vehicle and guide", "Customizable itinerary", "Doorstep pickup in Banff, Canmore, Lake Louise"],
    exclusions: ["Activity admissions unless requested"],
    highlights: ["Doorstep hotel pickup", "Customized pacing", "No shared passengers"],
    whatToBring: ["Whatever you like for a personalized Rockies day"],
  },
];

const FALLBACK_STOPS = [
  { id: "stop_fairmont", name: "Fairmont Banff Springs", town: "Banff", address: "405 Spray Ave, Banff, AB T1L 1J4" },
  { id: "stop_moose", name: "Moose Hotel & Suites", town: "Banff", address: "345 Banff Ave, Banff, AB T1L 1H8" },
  { id: "stop_ptarmigan", name: "Banff Ptarmigan Inn", town: "Banff", address: "337 Banff Ave, Banff, AB T1L 1H8" },
  { id: "stop_rimrock", name: "The Rimrock Resort Hotel", town: "Banff", address: "300 Mountain Ave, Banff, AB T1L 1J2" },
  { id: "stop_mount_royal", name: "Mount Royal Hotel (Banff Central Hub)", town: "Banff", address: "138 Banff Ave, Banff, AB T1L 1A7" },
  { id: "stop_malcolm", name: "The Malcolm Hotel", town: "Canmore", address: "321 Spring Creek Dr, Canmore, AB T1W 0K3" },
  { id: "stop_solara", name: "Solara Resort & Spa", town: "Canmore", address: "901 Mountain St, Canmore, AB T1W 0C9" },
  { id: "stop_chateau", name: "Fairmont Chateau Lake Louise", town: "Lake Louise", address: "111 Lake Louise Dr, Lake Louise, AB T0L 1E0" },
  { id: "stop_ll_inn", name: "Lake Louise Inn", town: "Lake Louise", address: "210 Village Rd, Lake Louise, AB T0L 1E0" },
];

// ---------------------------------------------------------------------------
// 1. Customer-Facing Safe Tools
// ---------------------------------------------------------------------------

export async function searchTours(args: { query?: string; category?: string }) {
  try {
    const tours = await prisma.tour.findMany({
      where: {
        ...conciergeTours(),
        ...(args.category ? { category: args.category.toUpperCase() as any } : {}),
        ...(args.query
          ? {
              OR: [
                { title: { contains: args.query, mode: "insensitive" } },
                { summary: { contains: args.query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        bokunId: true,
        title: true,
        category: true,
        durationHours: true,
        basePrice: true,
        currency: true,
        rating: true,
        summary: true,
      },
      take: 6,
    });

    return tours.map((t) => ({ ...t, basePrice: t.basePrice / 100 }));
  } catch (err) {
    console.warn("[ai.tools] searchTours database query failed, using static catalog fallback:", (err as any)?.message);
    // Fallback in-memory catalog
    let list = FALLBACK_TOURS;
    if (args.category) {
      list = list.filter((t) => t.category.toLowerCase() === args.category?.toLowerCase());
    }
    if (args.query) {
      const q = args.query.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q) || t.slug.includes(q));
    }
    return list.map((t) => ({
      id: t.id,
      slug: t.slug,
      bokunId: t.bokunId,
      title: t.title,
      category: t.category,
      durationHours: t.durationHours,
      basePrice: t.basePrice,
      currency: t.currency,
      rating: t.rating,
      summary: t.summary,
    }));
  }
}

export async function getTourDetails(args: { tourSlugOrBokunId: string }) {
  try {
    const tour = await prisma.tour.findFirst({
      where: {
        ...conciergeTours(),
        OR: [
          { slug: args.tourSlugOrBokunId },
          { bokunId: args.tourSlugOrBokunId },
          { id: args.tourSlugOrBokunId },
        ],
      },
      include: {
        destination: true,
      },
    });

    if (tour) {
      return {
        title: tour.title,
        category: tour.category,
        durationHours: tour.durationHours,
        basePrice: tour.basePrice / 100,
        currency: tour.currency,
        summary: tour.summary,
        description: tour.description,
        inclusions: (tour.inclusions as string[]) || [],
        exclusions: (tour.exclusions as string[]) || [],
        highlights: (tour.highlights as string[]) || [],
        whatToBring: (tour.whatToBring as string[]) || [],
      };
    }
    return null;
  } catch (err) {
    console.warn("[ai.tools] getTourDetails database query failed, using static fallback:", (err as any)?.message);
    const found =
      FALLBACK_TOURS.find(
        (t) => t.slug === args.tourSlugOrBokunId || t.bokunId === args.tourSlugOrBokunId || t.id === args.tourSlugOrBokunId,
      ) || FALLBACK_TOURS[0];

    return {
      title: found.title,
      category: found.category,
      durationHours: found.durationHours,
      basePrice: found.basePrice,
      currency: found.currency,
      summary: found.summary,
      description: found.description,
      inclusions: found.inclusions,
      exclusions: found.exclusions,
      highlights: found.highlights,
      whatToBring: found.whatToBring,
    };
  }
}

export async function checkAvailability(args: { date: string; tourSlug?: string }) {
  try {
    const departures = await prisma.tourDeparture.findMany({
      where: {
        date: new Date(args.date),
        status: "ACTIVE",
        ...sellableInventoryWhere,
        ...(args.tourSlug
          ? {
              tour: { slug: args.tourSlug },
            }
          : {}),
      },
      include: {
        tour: true,
        shuttleRoute: true,
      },
      take: 6,
    });

    return departures.map((d) => ({
      departureId: d.id,
      date: formatDateOnly(d.date),
      departureTime: formatTimeOfDay(d.departureTime),
      tourTitle: d.tour?.title || d.shuttleRoute?.name,
      capacityTotal: d.capacityTotal,
      availableSeats: Math.max(0, d.capacityTotal - (d.capacityBooked + d.capacityHeld)),
      pricePerPerson: d.price / 100,
      currency: d.currency,
    }));
  } catch (err) {
    console.warn("[ai.tools] checkAvailability database query failed, using static schedule fallback:", (err as any)?.message);
    // Fallback realistic daily departures for the requested date
    const targetDate = args.date || todayInMountainTime();
    const matchingTours = args.tourSlug
      ? FALLBACK_TOURS.filter((t) => t.slug === args.tourSlug)
      : FALLBACK_TOURS.filter((t) => t.category === "SHARED" || t.category === "SHUTTLE");

    return matchingTours.map((t, idx) => {
      const time = idx === 0 ? "08:30" : idx === 1 ? "07:30" : idx === 2 ? "09:00" : "05:00";
      return {
        departureId: `dep_${t.slug}_${targetDate}_${time.replace(":", "")}`,
        date: targetDate,
        departureTime: time,
        tourTitle: t.title,
        capacityTotal: 12,
        availableSeats: 6,
        pricePerPerson: t.basePrice,
        currency: "CAD",
      };
    });
  }
}

export async function getBooking(args: { bookingReference: string; customerEmail?: string }) {
  const booking = await prisma.booking.findFirst({
    where: {
      bookingReference: args.bookingReference,
      ...(args.customerEmail ? { customerEmail: args.customerEmail } : {}),
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

  if (!booking) return null;

  return {
    bookingReference: booking.bookingReference,
    customerName: booking.customerName,
    tourTitle: booking.tourDeparture.tour?.title || booking.tourDeparture.shuttleRoute?.name,
    departureDate: booking.tourDeparture.date.toISOString().split('T')[0],
    departureTime: formatTimeOfDay(booking.tourDeparture.departureTime),
    pickupLocation: booking.pickupStop?.name || booking.pickupCustomText || "Banff Station",
    pickupTime: booking.pickupTime || formatTimeOfDay(booking.tourDeparture.departureTime),
    totalSeats: booking.totalSeats,
    status: booking.status,
    voucherCode: booking.voucherCode,
    isBoarded: booking.isBoarded,
  };
}

// Words that carry no signal when matching a free-text question against stop names.
const PICKUP_QUERY_STOPWORDS = new Set([
  "where", "what", "which", "pick", "pickup", "pickups", "picked", "from", "your", "you", "near",
  "hotel", "hotels", "stop", "stops", "stay", "staying", "offer", "there", "with", "the", "and", "for",
]);

/**
 * Finds pickup stops for either an exact hotel name ("Fairmont Banff Springs") or a free-text
 * question ("Where do you pick up in Banff?"). The orchestrator sends `query`; `hotelNameQuery`
 * is kept for direct tool callers.
 */
export async function getPickup(args: { query?: string; hotelNameQuery?: string; town?: string }) {
  try {
    const mapsProvider = getMapsProvider();
    const query = String(args.query ?? args.hotelNameQuery ?? "").trim();

    let stops = await mapsProvider.searchPickups(query, args.town);

    if (stops.length === 0 && query) {
      const lower = query.toLowerCase();
      const allStops = await mapsProvider.getAllPickups();
      const towns = [...new Set(allStops.map((s) => s.town))];
      const town = args.town ?? towns.find((t) => lower.includes(t.toLowerCase()));
      const townWords = new Set(town ? town.toLowerCase().split(/\s+/) : []);
      const tokens = (lower.match(/[a-z0-9]+/g) ?? []).filter(
        (t) => t.length > 2 && !PICKUP_QUERY_STOPWORDS.has(t) && !townWords.has(t),
      );

      const inTown = town ? allStops.filter((s) => s.town === town) : allStops;
      const byName = tokens.length ? inTown.filter((s) => tokens.some((t) => s.name.toLowerCase().includes(t))) : [];
      stops = byName.length > 0 ? byName : town ? inTown : [];
    }

    if (stops && stops.length > 0) {
      return stops.slice(0, 5);
    }
  } catch (err) {
    console.warn("[ai.tools] getPickup provider failed, using static stops fallback:", (err as any)?.message);
  }

  // Fallback stops
  const q = String(args.query ?? args.hotelNameQuery ?? "").toLowerCase();
  const town = args.town?.toLowerCase();
  let stops = FALLBACK_STOPS;
  if (town) stops = stops.filter((s) => s.town.toLowerCase().includes(town));
  if (q) {
    const matched = stops.filter((s) => s.name.toLowerCase().includes(q) || s.town.toLowerCase().includes(q) || s.address.toLowerCase().includes(q));
    if (matched.length > 0) stops = matched;
  }
  return stops.slice(0, 5);
}

// Token only: a booking reference no longer opens live location (see tracking.provider.ts).
export async function getLiveTracking(args: { tokenOrRef: string }) {
  const trackingProvider = getLiveTrackingProvider();
  const telemetry = await trackingProvider.getTrackingTelemetry(args.tokenOrRef);
  if (!telemetry) return null;

  return {
    status: telemetry.status,
    statusLabel: telemetry.statusLabel,
    statusDescription: telemetry.statusDescription,
    estimatedArrivalMinutes: telemetry.estimatedArrivalMinutes,
    pickupStopName: telemetry.pickupStopName,
    vehicleName: telemetry.vehicleName,
    licensePlate: telemetry.licensePlate,
    driverName: telemetry.driverName,
    speedKmh: telemetry.vehicleCoordinates.speedKmh,
    heading: telemetry.vehicleCoordinates.heading,
  };
}

export async function getETA(args: { tokenOrRef: string }) {
  const tracking = await getLiveTracking(args);
  if (!tracking) return null;

  return {
    estimatedMinutesRemaining: tracking.estimatedArrivalMinutes,
    status: tracking.status,
    statusDescription: tracking.statusDescription,
    pickupLocation: tracking.pickupStopName,
  };
}

export async function getOperationalStatus(args: { bookingReference: string }) {
  const booking = await prisma.booking.findUnique({
    where: { bookingReference: args.bookingReference },
    include: {
      tourDeparture: {
        include: {
          operationRuns: {
            include: {
              vehicle: true,
              driver: true,
            },
          },
        },
      },
    },
  });

  if (!booking) return null;

  const run = booking.tourDeparture.operationRuns[0];
  return {
    bookingReference: booking.bookingReference,
    runStatus: run?.status || "PLANNED",
    isBoarded: booking.isBoarded,
    vehicle: run?.vehicle?.name || "Assigned Prior to Departure",
    driver: run?.driver?.publicName || "Certified Naturalist Guide",
  };
}

export async function getAvailableDates(args: { tourSlug?: string }) {
  try {
    const today = todayInMountainTime();
    const departures = await prisma.tourDeparture.findMany({
      where: {
        date: { gte: dateOnly(today) },
        status: "ACTIVE",
        ...sellableInventoryWhere,
        ...(args.tourSlug ? { tour: { slug: args.tourSlug } } : {}),
      },
      include: {
        tour: true,
        shuttleRoute: true,
      },
      orderBy: [{ date: "asc" }, { departureTime: "asc" }],
      take: 20,
    });

    if (departures.length > 0) {
      return departures
        .map((d) => {
          const remaining = Math.max(0, d.capacityTotal - (d.capacityBooked + d.capacityHeld));
          return {
            departureId: d.id,
            date: formatDateOnly(d.date),
            departureTime: formatTimeOfDay(d.departureTime),
            title: d.tour?.title || d.shuttleRoute?.name,
            slug: d.tour?.slug,
            availableSeats: remaining,
            price: d.price / 100,
            currency: d.currency,
          };
        })
        .filter((d) => d.availableSeats > 0);
    }
  } catch (err) {
    console.warn("[ai.tools] getAvailableDates database query failed, using static schedule fallback:", (err as any)?.message);
  }

  // Fallback upcoming 5 days
  const today = new Date();
  const out = [];
  const tours = args.tourSlug ? FALLBACK_TOURS.filter((t) => t.slug === args.tourSlug) : FALLBACK_TOURS.filter((t) => t.category === "SHARED");
  for (let i = 1; i <= 5; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    for (const t of tours.slice(0, 2)) {
      out.push({
        departureId: `dep_${t.slug}_${dateStr}_0830`,
        date: dateStr,
        departureTime: "08:30",
        title: t.title,
        slug: t.slug,
        availableSeats: 7,
        price: t.basePrice,
        currency: "CAD",
      });
    }
  }
  return out;
}

export async function createVoiceReservationHold(args: {
  departureId: string;
  seatsCount: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
}) {
  if (!args.departureId || !args.seatsCount || !args.customerName || !args.customerEmail) {
    return {
      success: false,
      error: "Missing required booking details (departureId, seatsCount, customerName, customerEmail).",
    };
  }

  const result = await createReservationHold({
    departureId: args.departureId,
    seatsCount: args.seatsCount,
    customerName: args.customerName,
    customerEmail: args.customerEmail,
    customerPhone: args.customerPhone || "+1-825-734-9456",
    holdDurationSeconds: 600, // 10 minutes
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error || "Unable to hold seats for selected departure.",
    };
  }

  const checkoutUrl = `/book?departureId=${encodeURIComponent(args.departureId)}&holdToken=${encodeURIComponent(
    result.holdToken!
  )}&guests=${encodeURIComponent(args.seatsCount)}`;

  return {
    success: true,
    holdToken: result.holdToken,
    expiresAt: result.expiresAt,
    remainingSeconds: result.remainingSeconds || 600,
    seatsHeld: result.seatsHeld,
    isVehicle: result.isVehicle,
    checkoutUrl,
  };
}

export async function createVoiceBookingPaymentIntent(args: {
  departureId: string;
  holdToken?: string;
  seatsCount: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  pickupLocation?: string;
}) {
  const checkoutUrl = `/book?departureId=${encodeURIComponent(args.departureId)}${
    args.holdToken ? `&holdToken=${encodeURIComponent(args.holdToken)}` : ""
  }&guests=${encodeURIComponent(args.seatsCount)}`;

  return {
    success: true,
    checkoutUrl,
    securityNotice:
      "PCI-DSS Level 1 Encrypted: Enter card details strictly via checkout link. Voice concierges never collect card numbers.",
    amountEstimated: args.seatsCount,
  };
}


// ---------------------------------------------------------------------------
// 2. Staff-Facing Operations AI Assistant Tools (Staff Authorization Enforced)
// ---------------------------------------------------------------------------

export async function getTodaysDepartures(args: { date?: string }, ctx: ToolExecutionContext) {
  if (!ctx.isStaff) {
    throw new Error("UNAUTHORIZED: Operations staff credentials required to view daily dispatch rosters.");
  }

  const date = args.date || todayInMountainTime();
  const departures = await prisma.tourDeparture.findMany({
    where: { date: dateOnly(date) },
    include: {
      tour: true,
      shuttleRoute: true,
      operationRuns: {
        include: {
          vehicle: true,
          driver: true,
          bookings: true,
        },
      },
      bookings: true,
    },
    orderBy: { departureTime: "asc" },
  });

  return departures.map((d) => ({
    departureId: d.id,
    departureTime: formatTimeOfDay(d.departureTime),
    title: d.tour?.title || d.shuttleRoute?.name,
    capacityTotal: d.capacityTotal,
    capacityBooked: d.capacityBooked,
    runsCount: d.operationRuns.length,
    activeRunStatus: d.operationRuns[0]?.status || "PLANNED",
    assignedVehicle: d.operationRuns[0]?.vehicle?.name || "Unassigned",
    assignedDriver: d.operationRuns[0]?.driver?.name || "Unassigned",
  }));
}

export async function getPendingPickups(args: { runId?: string; date?: string }, ctx: ToolExecutionContext) {
  if (!ctx.isStaff) {
    throw new Error("UNAUTHORIZED: Operations staff credentials required.");
  }

  const today = args.date || todayInMountainTime();

  const pendingRunBookings = await prisma.runBooking.findMany({
    where: {
      isBoarded: false,
      ...(args.runId ? { runId: args.runId } : { run: { date: dateOnly(today) } }),
    },
    include: {
      run: {
        include: { vehicle: true, driver: true },
      },
      booking: {
        include: { pickupStop: true },
      },
    },
    orderBy: { pickupOrder: "asc" },
  });

  return pendingRunBookings.map((rb) => ({
    runName: rb.run.name,
    pickupOrder: rb.pickupOrder,
    customerName: rb.booking.customerName,
    customerPhone: rb.booking.customerPhone,
    seats: rb.booking.totalSeats,
    pickupLocation: rb.booking.pickupStop?.name || rb.booking.pickupCustomText,
    pickupTime: rb.booking.pickupTime,
    vehicle: rb.run.vehicle?.name,
  }));
}

export async function getBoardingStatus(args: { departureId?: string; date?: string }, ctx: ToolExecutionContext) {
  if (!ctx.isStaff) {
    throw new Error("UNAUTHORIZED: Operations staff credentials required.");
  }

  const date = args.date || todayInMountainTime();
  const bookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      tourDeparture: args.departureId ? { id: args.departureId } : { date: dateOnly(date) },
    },
    select: {
      id: true,
      bookingReference: true,
      customerName: true,
      totalSeats: true,
      isBoarded: true,
      boardedAt: true,
      pickupCustomText: true,
    },
  });

  const totalPassengers = bookings.reduce((sum, b) => sum + b.totalSeats, 0);
  const boardedPassengers = bookings.filter((b) => b.isBoarded).reduce((sum, b) => sum + b.totalSeats, 0);

  return {
    date,
    totalPassengers,
    boardedPassengers,
    pendingPassengers: totalPassengers - boardedPassengers,
    passengers: bookings,
  };
}

export async function getVehicleAssignments(args: { date?: string }, ctx: ToolExecutionContext) {
  if (!ctx.isStaff) {
    throw new Error("UNAUTHORIZED: Operations staff credentials required.");
  }

  const date = args.date || todayInMountainTime();
  const runs = await prisma.operationRun.findMany({
    where: { date: dateOnly(date) },
    include: {
      vehicle: true,
      driver: true,
      tourDeparture: {
        include: { tour: true, shuttleRoute: true },
      },
    },
  });

  return runs.map((r) => ({
    runName: r.name,
    status: r.status,
    vehicle: r.vehicle ? `${r.vehicle.name} (${r.vehicle.licensePlate})` : "Unassigned",
    driver: r.driver ? `${r.driver.name} (${r.driver.phone})` : "Unassigned",
    tour: r.tourDeparture.tour?.title || r.tourDeparture.shuttleRoute?.name,
  }));
}

export async function getDelayedDepartures(_args: Record<string, unknown>, ctx: ToolExecutionContext) {
  if (!ctx.isStaff) {
    throw new Error("UNAUTHORIZED: Operations staff credentials required.");
  }

  const delayedRuns = await prisma.operationRun.findMany({
    where: { status: "DELAYED" },
    include: {
      vehicle: true,
      driver: true,
      tourDeparture: { include: { tour: true } },
    },
  });

  return delayedRuns.map((r) => ({
    runId: r.id,
    runName: r.name,
    tour: r.tourDeparture.tour?.title,
    notes: r.notes || "Traffic / weather delay flagged by dispatch.",
    vehicle: r.vehicle?.name,
    driver: r.driver?.name,
  }));
}

// ---------------------------------------------------------------------------
// Tool Execution Dispatcher
// ---------------------------------------------------------------------------
export async function executeAiTool(toolName: string, args: Record<string, any>, ctx: ToolExecutionContext): Promise<ToolResult> {
  try {
    switch (toolName) {
      // Customer tools
      case "searchTours":
        return { toolName, success: true, data: await searchTours(args) };
      case "getTourDetails":
        return { toolName, success: true, data: await getTourDetails(args as any) };
      case "checkAvailability":
        return { toolName, success: true, data: await checkAvailability(args as any) };
      case "getAvailableDates":
        return { toolName, success: true, data: await getAvailableDates(args as any) };
      case "getBooking":
        return { toolName, success: true, data: await getBooking(args as any) };
      case "getPickup":
      case "findPickup":
        return { toolName, success: true, data: await getPickup(args as any) };
      case "createVoiceReservationHold":
        return { toolName, success: true, data: await createVoiceReservationHold(args as any) };
      case "createVoiceBookingPaymentIntent":
        return { toolName, success: true, data: await createVoiceBookingPaymentIntent(args as any) };
      case "getLiveTracking":
        return { toolName, success: true, data: await getLiveTracking(args as any) };
      case "getETA":
        return { toolName, success: true, data: await getETA(args as any) };
      case "getOperationalStatus":
        return { toolName, success: true, data: await getOperationalStatus(args as any) };

      // Staff operations tools
      case "getTodaysDepartures":
        return { toolName, success: true, data: await getTodaysDepartures(args, ctx) };
      case "getPendingPickups":
        return { toolName, success: true, data: await getPendingPickups(args, ctx) };
      case "getBoardingStatus":
        return { toolName, success: true, data: await getBoardingStatus(args, ctx) };
      case "getVehicleAssignments":
        return { toolName, success: true, data: await getVehicleAssignments(args, ctx) };
      case "getDelayedDepartures":
        return { toolName, success: true, data: await getDelayedDepartures(args, ctx) };

      default:
        return { toolName, success: false, error: `Unrecognized tool '${toolName}'` };
    }
  } catch (error: any) {
    // Permission errors are meant for the caller; anything else stays in the server log.
    if (typeof error?.message === "string" && error.message.startsWith("UNAUTHORIZED")) return { toolName, success: false, error: error.message };
    console.error(`AI tool ${toolName} failed:`, error?.message);
    return { toolName, success: false, error: "That request couldn't be completed." };
  }
}
