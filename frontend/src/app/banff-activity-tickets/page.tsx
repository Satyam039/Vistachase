import type { Metadata } from "next";
import { getCategoryExtras, getTours } from "@/lib/api/catalog";
import { TourGallery } from "@/components/tours/TourGallery";
import { serviceById } from "@/lib/services";

export const metadata: Metadata = {
  title: "Banff Activity Tickets | Gondola, Lake Cruise, Skywalk & Hot Springs | Vista Chase",
  description:
    "Add the Banff Gondola, a Lake Minnewanka cruise, the Columbia Icefield Skywalk or the Banff Upper Hot Springs to your Rockies trip. One request, timed around your Vista Chase tour.",
  alternates: { canonical: "/banff-activity-tickets" },
};

export default async function BanffActivityTicketsPage() {
  const tours = await getTours({ category: "TICKET" });
  const { reviews, faqs } = await getCategoryExtras(tours);
  return (
    <TourGallery
      heading="Banff activity tickets"
      intro="The Rockies' classic experiences, timed around your day. Tell us your date and party size and we confirm tickets and the best time slot, on their own or alongside any Vista Chase tour."
      ctaLabel="Ask the concierge"
      ctaHref="/concierge"
      tours={tours}
      reviews={reviews}
      faqs={faqs}
      service={serviceById("tickets")}
    />
  );
}
