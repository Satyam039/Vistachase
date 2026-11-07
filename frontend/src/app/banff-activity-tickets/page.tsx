import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ACTIVITY_TICKETS_VISIBLE } from "@/lib/activityTickets";
import { getCategoryExtras, getTours } from "@/lib/api/catalog";
import { TourGallery } from "@/components/tours/TourGallery";
import { serviceById } from "@/lib/services";
import { withSeo } from "@/lib/seo/server";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";

const baseMetadata: Metadata = {
  title: "Banff & Jasper Activity Tickets | Vista Chase",
  description:
    "Add the Banff Gondola, a Lake Minnewanka or Maligne Lake cruise, the Columbia Icefield Adventure or Skywalk to your Rockies trip, at the times we recommend.",
  alternates: { canonical: "/banff-activity-tickets" },
};

export default async function BanffActivityTicketsPage() {
  // Hidden from guests for now (lib/activityTickets.ts): a temporary redirect, so it can come back.
  if (!ACTIVITY_TICKETS_VISIBLE) redirect("/");
  const tours = await getTours({ category: "TICKET" });
  const { reviews, faqs } = await getCategoryExtras(tours);
  return (
    <>
      <PageSeoExtras path="/banff-activity-tickets" />
    <TourGallery
      heading="Banff activity tickets"
      intro="The Rockies' classic experiences, timed around your day. Open a ticket, check our recommended time and book it directly on the Banff Jasper Collection booking page, on its own or alongside any Vista Chase tour."
      ctaLabel="Ask the concierge"
      ctaHref="/concierge"
      tours={tours}
      reviews={reviews}
      faqs={faqs}
      service={serviceById("tickets")}
    />
    </>
  );
}

export function generateMetadata(): Promise<Metadata> {
  return withSeo("/banff-activity-tickets", baseMetadata);
}
