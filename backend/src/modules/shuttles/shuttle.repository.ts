import prisma from "@/lib/db/prisma";
import { getExpiredHeldSeats, liveCapacity } from "@/modules/reservations/reservation.repository";

export interface ShuttleWithDepartures {
  id: string;
  slug: string;
  name: string;
  origin: string;
  destination: string;
  isReturn: boolean;
  description: string;
  notes: string | null;
  departures: {
    id: string;
    date: string;
    departureTime: string;
    returnTime: string | null;
    capacityTotal: number;
    capacityBooked: number;
    capacityHeld: number;
    seatsAvailable: number;
    price: number;
    currency: string;
    status: string;
  }[];
}

export async function getShuttleRoutes(): Promise<ShuttleWithDepartures[]> {
  const routes = await prisma.shuttleRoute.findMany({
    include: {
      departures: {
        where: { status: "ACTIVE" },
        orderBy: [{ date: "asc" }, { departureTime: "asc" }],
      },
    },
  });

  const expiredHeld = await getExpiredHeldSeats(routes.flatMap((r) => r.departures.map((d) => d.id)));

  return routes.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    origin: r.origin,
    destination: r.destination,
    isReturn: r.isReturn,
    description: r.description,
    notes: r.notes,
    departures: r.departures.map((d) => ({
      id: d.id,
      date: d.date.toISOString().split('T')[0],
      departureTime: d.departureTime.toISOString(),
      returnTime: d.returnTime ? d.returnTime.toISOString() : null,
      capacityTotal: d.capacityTotal,
      capacityBooked: d.capacityBooked,
      ...liveCapacity(d, expiredHeld),
      price: d.price / 100,
      currency: d.currency,
      status: d.status,
    })),
  }));
}

export async function getShuttleBySlug(slug: string): Promise<ShuttleWithDepartures | null> {
  const r = await prisma.shuttleRoute.findUnique({
    where: { slug },
    include: {
      departures: {
        where: { status: "ACTIVE" },
        orderBy: [{ date: "asc" }, { departureTime: "asc" }],
      },
    },
  });

  if (!r) return null;

  const expiredHeld = await getExpiredHeldSeats(r.departures.map((d) => d.id));

  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    origin: r.origin,
    destination: r.destination,
    isReturn: r.isReturn,
    description: r.description,
    notes: r.notes,
    departures: r.departures.map((d) => ({
      id: d.id,
      date: d.date.toISOString().split('T')[0],
      departureTime: d.departureTime.toISOString(),
      returnTime: d.returnTime ? d.returnTime.toISOString() : null,
      capacityTotal: d.capacityTotal,
      capacityBooked: d.capacityBooked,
      ...liveCapacity(d, expiredHeld),
      price: d.price / 100,
      currency: d.currency,
      status: d.status,
    })),
  };
}
