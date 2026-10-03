import { notFound } from "next/navigation";
import { getCheckoutData } from "@/lib/api/catalog";
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
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ departureId?: string; holdToken?: string; pickupStopId?: string; guests?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const checkout = await getCheckoutData(searchParams.departureId);

  if (!checkout) {
    notFound();
  }

  const { departure, stops } = checkout;

  return (
    <BookingCheckoutClient
      departure={{
        id: departure.id,
        date: departure.date,
        departureTime: departure.departureTime,
        returnTime: departure.returnTime,
        capacityTotal: departure.capacityTotal,
        capacityBooked: departure.capacityBooked,
        capacityHeld: departure.capacityHeld,
        seatsAvailable: departure.seatsAvailable,
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
      initialGuests={Number.parseInt(searchParams.guests ?? "", 10) || undefined}
    />
  );
}
