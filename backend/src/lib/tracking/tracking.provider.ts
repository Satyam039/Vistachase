import prisma from "@/lib/db/prisma";

export interface VehicleCoordinates {
  latitude: number;
  longitude: number;
  heading: number; // 0 - 360 degrees
  speedKmh: number;
  altitudeMeters?: number;
  updatedAt: string;
}

export interface RouteWaypoint {
  name: string;
  latitude: number;
  longitude: number;
  isPassed: boolean;
  isCurrent: boolean;
  estimatedTime?: string;
}

export interface TrackingTelemetry {
  sessionToken: string;
  bookingReference: string;
  customerName: string;
  tourName: string;
  departureDate: string;
  departureTime: string;
  pickupStopName: string;
  pickupAddress: string;
  pickupInstructions: string;
  pickupTime: string;
  vehicleName: string;
  licensePlate: string;
  driverName: string;
  driverPhoto: string;
  driverPhone?: string;
  status: "PREPARING" | "ON_THE_WAY" | "ARRIVING_SOON" | "SHUTTLE_IS_HERE" | "IN_TRANSIT" | "COMPLETED";
  statusLabel: string;
  statusDescription: string;
  estimatedArrivalMinutes: number;
  vehicleCoordinates: VehicleCoordinates;
  destinationCoordinates: {
    latitude: number;
    longitude: number;
  };
  routeWaypoints: RouteWaypoint[];
  isTrackingActive: boolean;
}

export interface ILiveTrackingProvider {
  /** Public: only a live tracking-session token or a booking's unexpired tracking token opens tracking. */
  getTrackingTelemetry(trackingToken: string): Promise<TrackingTelemetry | null>;
  /** Internal: for a booking whose owner the caller has already verified (e.g. concierge email check). */
  getTelemetryForVerifiedBooking(bookingReference: string): Promise<TrackingTelemetry | null>;
  pushGpsPing?(vehicleId: string, coords: VehicleCoordinates): Promise<void>;
}

// ---------------------------------------------------------------------------
// Canadian Rockies Corridor Topographic Waypoints
// ---------------------------------------------------------------------------
const ROCKIES_CORRIDOR_WAYPOINTS = [
  { name: "Vista Chase Canmore Fleet Depot", latitude: 51.0858, longitude: -115.3484 },
  { name: "Malcolm Hotel Canmore", latitude: 51.0912, longitude: -115.3571 },
  { name: "Trans-Canada Highway 1 Harvie Heights", latitude: 51.1352, longitude: -115.4215 },
  { name: "Banff East Park Gate", latitude: 51.1611, longitude: -115.5089 },
  { name: "Fairmont Banff Springs Hotel", latitude: 51.1645, longitude: -115.5619 },
  { name: "Moose Hotel & Suites (Banff Ave)", latitude: 51.1812, longitude: -115.5714 },
  { name: "Banff Caribou Lodge", latitude: 51.1872, longitude: -115.5683 },
  { name: "Bow Valley Parkway Overpass", latitude: 51.2789, longitude: -115.8643 },
  { name: "Castle Mountain Junction", latitude: 51.2708, longitude: -115.9234 },
  { name: "Lake Louise Village Depot", latitude: 51.4254, longitude: -116.1773 },
  { name: "Fairmont Chateau Lake Louise", latitude: 51.4177, longitude: -116.2168 },
  { name: "Moraine Lake & Ten Peaks", latitude: 51.3271, longitude: -116.1822 },
];

export class MockLiveTrackingProvider implements ILiveTrackingProvider {
  async getTrackingTelemetry(trackingToken: string): Promise<TrackingTelemetry | null> {
    return this.load(trackingToken);
  }

  async getTelemetryForVerifiedBooking(bookingReference: string): Promise<TrackingTelemetry | null> {
    return this.load(null, bookingReference);
  }

  private async load(trackingToken: string | null, verifiedReference?: string): Promise<TrackingTelemetry | null> {
    // 1. Look up tracking session or booking directly
    let booking: any = null;
    let run: any = null;

    // Check tracking session first
    const session = trackingToken
      ? await prisma.trackingSession.findUnique({
      where: { token: trackingToken },
      include: {
        run: {
          include: {
            vehicle: true,
            driver: true,
            tourDeparture: {
              include: {
                tour: true,
                shuttleRoute: true,
              },
            },
            bookings: {
              include: {
                booking: {
                  include: {
                    tourDeparture: {
                      include: {
                        tour: true,
                        shuttleRoute: true,
                      },
                    },
                    pickupStop: true,
                  },
                },
              },
            },
          },
        },
      },
    })
      : null;

    if (session && session.isActive && session.expiresAt > new Date()) {
      run = session.run;
      const firstRunBooking = run.bookings[0]?.booking;
      if (firstRunBooking) {
        booking = firstRunBooking;
      }
    }

    // Otherwise the booking's own tracking token (never its reference or id: references are
    // printed on vouchers and emails, so they must not open live location), or a booking the caller
    // has already verified.
    if (!booking && (trackingToken || verifiedReference)) {
      booking = await prisma.booking.findFirst({
        where: verifiedReference
          ? { bookingReference: verifiedReference }
          : { trackingToken, OR: [{ trackingTokenExpiresAt: null }, { trackingTokenExpiresAt: { gt: new Date() } }] },
        include: {
          tourDeparture: {
            include: {
              tour: true,
              shuttleRoute: true,
              operationRuns: {
                include: {
                  vehicle: true,
                  driver: true,
                },
              },
            },
          },
          pickupStop: true,
        },
      });
    }

    if (!booking) {
      return null;
    }

    const departure = booking.tourDeparture || run?.tourDeparture || {
      date: new Date().toISOString().split("T")[0],
      departureTime: "08:30",
    };
    const tourTitle = departure?.tour?.title || departure?.shuttleRoute?.name || "Canadian Rockies Tour";
    const stop = booking.pickupStop;

    const stopLat = stop?.latitude || 51.1645;
    const stopLng = stop?.longitude || -115.5619;
    const stopName = stop?.name || booking.pickupCustomText || "Fairmont Banff Springs Hotel";
    const stopAddress = stop?.address || "Banff National Park, AB";
    const stopInstructions = stop?.instructions || "Wait in main lobby 5 minutes prior to scheduled departure.";

    // Active run, vehicle, and driver details
    const activeRun = run || departure?.operationRuns?.[0];
    const vehicle = activeRun?.vehicle || {
      name: "Mercedes-Benz Sprinter Executive #4",
      licensePlate: "ALBERTA • 7VC-894",
    };
    const driver = activeRun?.driver || {
      publicName: "Marc",
      name: "Marc Tremblay",
      photoUrl: null as string | null,
      phone: "+1 (825) 734-9456",
    };

    // 2. Realistic Telemetry Simulator: Interpolate progress based on current time
    const now = Date.now();
    const cycleDurationMs = 180000; // 3 minutes full corridor loop for live testing
    const progress = (now % cycleDurationMs) / cycleDurationMs; // 0.0 to 1.0

    const startPoint = ROCKIES_CORRIDOR_WAYPOINTS[0];
    const targetPoint = { latitude: stopLat, longitude: stopLng };

// 2. Telemetry: Read from real VehiclePosition table first!
    const latestPos = vehicle.id ? await prisma.vehiclePosition.findFirst({
      where: { vehicleId: vehicle.id },
      orderBy: { timestamp: "desc" }
    }) : null;
    
    let currentLat = startPoint.latitude;
    let currentLng = startPoint.longitude;
    let speed = 72;
    
    if (latestPos) {
       currentLat = latestPos.latitude;
       currentLng = latestPos.longitude;
       speed = latestPos.speedKmh || 0;
    } else {
       // Fallback to interpolated progress for demo if no GPS ping
       currentLat = startPoint.latitude + (targetPoint.latitude - startPoint.latitude) * progress;
       currentLng = startPoint.longitude + (targetPoint.longitude - startPoint.longitude) * progress;
    }
    const remainingMinutes = Math.max(1, Math.round((1 - progress) * 15));

    // Dynamic Status Logic
    let status: TrackingTelemetry["status"] = "ON_THE_WAY";
    let statusLabel = "Shuttle On The Way";
    let statusDescription = `Your driver is en route to ${stopName}. Estimated arrival in ${remainingMinutes} mins.`;

    if (progress < 0.1) {
      status = "PREPARING";
      statusLabel = "Preparing Departure";
      statusDescription = "Shuttle has completed pre-trip inspection and is underway from Canmore fleet depot.";
    } else if (remainingMinutes <= 2) {
      status = "SHUTTLE_IS_HERE";
      statusLabel = "Shuttle Has Arrived";
      statusDescription = `Your driver is parked at ${stopName}. Please proceed to the vehicle.`;
    } else if (remainingMinutes <= 5) {
      status = "ARRIVING_SOON";
      statusLabel = "Arriving in 5 Minutes";
      statusDescription = `Shuttle is approaching ${stopName}. Please be ready in the main lobby or pickup area.`;
    }

    if (booking.isBoarded) {
      status = "IN_TRANSIT";
      statusLabel = "In Transit to the Rockies";
      statusDescription = "You are checked in and en route to Lake Louise & Moraine Lake!";
    }

    const waypoints: RouteWaypoint[] = [
      {
        name: "Canmore Fleet Headquarters",
        latitude: ROCKIES_CORRIDOR_WAYPOINTS[0].latitude,
        longitude: ROCKIES_CORRIDOR_WAYPOINTS[0].longitude,
        isPassed: true,
        isCurrent: false,
      },
      {
        name: "Trans-Canada Highway 1 Corridor",
        latitude: (startPoint.latitude + targetPoint.latitude) / 2,
        longitude: (startPoint.longitude + targetPoint.longitude) / 2,
        isPassed: progress > 0.5,
        isCurrent: progress >= 0.2 && progress < 0.8,
      },
      {
        name: stopName,
        latitude: targetPoint.latitude,
        longitude: targetPoint.longitude,
        isPassed: status === "SHUTTLE_IS_HERE" || booking.isBoarded,
        isCurrent: status === "SHUTTLE_IS_HERE",
      },
      {
        name: "Moraine Lake & Ten Peaks",
        latitude: 51.3271,
        longitude: -116.1822,
        isPassed: false,
        isCurrent: booking.isBoarded,
      },
    ];

    return {
      sessionToken: trackingToken ?? booking.trackingToken ?? "",
      bookingReference: booking.bookingReference,
      customerName: booking.customerName,
      tourName: tourTitle,
      departureDate: departure.date,
      departureTime: departure.departureTime,
      pickupStopName: stopName,
      pickupAddress: stopAddress,
      pickupInstructions: stopInstructions,
      pickupTime: booking.pickupTime || departure.departureTime,
      vehicleName: vehicle.name,
      licensePlate: vehicle.licensePlate,
      driverName: driver.publicName || driver.name,
      // No guide photos yet: fall back to the Vista Chase emblem (backend/media).
      driverPhoto: driver.photoUrl || "/media/brand/horse-emblem-gold.png",
      driverPhone: driver.phone,
      status,
      statusLabel,
      statusDescription,
      estimatedArrivalMinutes: remainingMinutes,
      vehicleCoordinates: {
        latitude: Number(currentLat.toFixed(5)),
        longitude: Number(currentLng.toFixed(5)),
        heading: 315, // Northwest toward Lake Louise
        speedKmh: speed,
        altitudeMeters: 1450,
        updatedAt: new Date().toISOString(),
      },
      destinationCoordinates: {
        latitude: stopLat,
        longitude: stopLng,
      },
      routeWaypoints: waypoints,
      isTrackingActive: true,
    };
  }

  async pushGpsPing(vehicleId: string, coords: VehicleCoordinates): Promise<void> {
    await prisma.vehiclePosition.create({
      data: {
        vehicleId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        heading: coords.heading,
        speedKmh: coords.speedKmh,
      },
    });
  }
}

let trackingProviderInstance: ILiveTrackingProvider | null = null;

export function getLiveTrackingProvider(): ILiveTrackingProvider {
  if (process.env.FEATURE_TRACKING !== "true") {
    return {
      getTrackingTelemetry: async () => null,
      getTelemetryForVerifiedBooking: async () => null,
      pushGpsPing: async () => {},
    };
  }
  if (!trackingProviderInstance) {
    trackingProviderInstance = new MockLiveTrackingProvider();
  }
  return trackingProviderInstance;
}
