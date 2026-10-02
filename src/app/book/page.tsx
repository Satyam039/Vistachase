import { notFound } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { BookingCheckoutClient } from "@/components/booking/BookingCheckoutClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Secure Booking & Checkout | Vista Chase Canadian Rockies",
  description:
    "Complete your reservation for Lake Louise, Moraine Lake shuttles, and luxury private tours with guaranteed access.",
  alternates: {
    canonical: "/book",
  },
};

export default async function BookPage({
  searchParams,
}: {
  searchParams: { departureId?: string; holdToken?: string; pickupStopId?: string };
}) {
  let departureId = searchParams.departureId;

  // If no departure specified, pick first active scheduled departure
  if (!departureId) {
    const firstActive = await prisma.tourDeparture.findFirst({
      where: { status: "ACTIVE" },
      orderBy: [{ date: "asc" }, { departureTime: "asc" }],
    });
    if (firstActive) {
      departureId = firstActive.id;
    }
  }

  if (!departureId) {
    notFound();
  }

  const departure = await prisma.tourDeparture.findUnique({
    where: { id: departureId },
    include: {
      tour: {
        select: {
          id: true,
          title: true,
          slug: true,
          durationHours: true,
          featuredImage: true,
        },
      },
      shuttleRoute: {
        select: {
          id: true,
          name: true,
          slug: true,
          origin: true,
          destination: true,
        },
      },
    },
  });

  if (!departure) {
    notFound();
  }

  const stops = await prisma.shuttleStop.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const seatsAvailable = Math.max(
    0,
    departure.capacityTotal - (departure.capacityBooked + departure.capacityHeld)
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <BookingCheckoutClient
        departure={{
          id: departure.id,
          date: departure.date,
          departureTime: departure.departureTime,
          returnTime: departure.returnTime,
          capacityTotal: departure.capacityTotal,
          capacityBooked: departure.capacityBooked,
          capacityHeld: departure.capacityHeld,
          seatsAvailable,
          price: departure.price,
          currency: departure.currency,
          tour: departure.tour,
          shuttleRoute: departure.shuttleRoute,
        }}
        stops={stops.map((s) => ({
          id: s.id,
          name: s.name,
          town: s.town,
          address: s.address,
          instructions: s.instructions,
        }))}
        initialHoldToken={searchParams.holdToken}
      />
    </div>
  );
}
