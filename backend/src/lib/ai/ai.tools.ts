import prisma from "@/lib/db/prisma";
import { getLiveTrackingProvider } from "@/lib/tracking/tracking.provider";
import { getMapsProvider } from "@/lib/maps/maps.provider";
import { createReservationHold } from "@/modules/reservations/reservation.repository";
import { createBooking } from "@/modules/bookings/booking.repository";
import { dateOnly, formatDateOnly, formatTimeOfDay, todayInMountainTime } from "@/lib/utils/time";

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
// 1. Customer-Facing Safe Tools
// ---------------------------------------------------------------------------

export async function searchTours(args: { query?: string; category?: string }) {
  const tours = await prisma.tour.findMany({
    where: {
      ...(args.category ? { category: args.category.toUpperCase() as any } : {}),
      ...(args.query
        ? {
            OR: [
              { title: { contains: args.query } },
              { summary: { contains: args.query } },
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

  return tours;
}

export async function getTourDetails(args: { tourSlugOrBokunId: string }) {
  const tour = await prisma.tour.findFirst({
    where: {
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

  if (!tour) return null;

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

export async function checkBokunAvailability(args: { date: string; tourSlug?: string }) {
  const departures = await prisma.tourDeparture.findMany({
    where: {
      date: new Date(args.date),
      status: "ACTIVE",
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
    take: 5,
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
    pickupTime: booking.pickupTime || booking.tourDeparture.departureTime,
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
  const today = todayInMountainTime();
  const departures = await prisma.tourDeparture.findMany({
    where: {
      date: { gte: dateOnly(today) },
      status: "ACTIVE",
      ...(args.tourSlug ? { tour: { slug: args.tourSlug } } : {}),
    },
    include: {
      tour: true,
      shuttleRoute: true,
    },
    orderBy: [{ date: "asc" }, { departureTime: "asc" }],
    take: 20,
  });

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
      case "checkBokunAvailability":
      case "checkAvailability":
        return { toolName, success: true, data: await checkBokunAvailability(args as any) };
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
