// Cancellation policy: the wording of the live vistachase.com cancellation policy page (which lived
// at /privacy-policy-vista-chase; that URL now redirects here).

import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Cancellation Policy | Vista Chase",
  description: "Vista Chase booking, payment and 72-hour cancellation policy, including group, multi-day and third-party terms.",
  alternates: { canonical: "/cancellation-policy" },
};

const SECTIONS: LegalSection[] = [
  {
    title: "Booking process",
    blocks: [
      "We offer two simple ways to book your experience:",
      { sub: "Instant Booking (Recommended)" },
      "You can book directly through our website for fast, automatic confirmation. Just choose your tour, complete payment, and you'll receive your confirmation email instantly.",
      { sub: "Custom Inquiry" },
      "If you need a personalized plan, you can submit an inquiry or contact us directly. We'll prepare a detailed quote based on your preferred tour type, group size, and travel dates. Once you approve the quote and complete payment, we'll send your confirmed itinerary with all necessary details.",
      "All prices are listed in Canadian Dollars (CAD) and include taxes unless specified otherwise.",
    ],
  },
  {
    title: "Payment terms",
    blocks: [
      "A 20% deposit is required at the time of booking to secure your date. This deposit is refundable if the booking is cancelled 72 hours before the tour.",
      "The remaining balance is due 14 days before the tour.",
      "If you book within 14 days of the tour date, full payment is required.",
      "We accept all major Credit card, Debit Card, Bank Transfer, and PayPal.",
      "If your payment becomes overdue, we'll send reminders. If we don't hear from you, the reservation may be cancelled.",
    ],
  },
  {
    title: "Cancellation policy (applies to all bookings)",
    blocks: [
      "Vista Chase follows a simple, traveler-friendly 72-hour cancellation policy for most tours, with specific conditions for large groups:",
      { sub: "For groups of 1–6 pax" },
      { list: ["Full refund (including your deposit) for cancellations made 72 hours or more before the tour start time.", "No refund for cancellations made within 72 hours of the tour."] },
      { sub: "For groups of 7+ pax" },
      { list: ["Partial refund (total amount paid minus the 20% non-refundable deposit) for cancellations made 72 hours or more before the tour.", "No refund for cancellations made within 72 hours of the tour."] },
      { sub: "Multi-day experience cancellation policy" },
      {
        list: [
          "A 20% deposit is required to confirm all multi-day experiences and is non-refundable under all circumstances.",
          "For cancellations made 72 hours or more before the experience start time, guests will receive a refund of all amounts paid, excluding the 20% non-refundable deposit.",
          "For cancellations made within 72 hours of the experience start time, no refund will be provided.",
        ],
      },
      "This policy ensures we can manage our fleet and staffing commitments, as late cancellations for large groups prevent us from re-allocating our biggest vehicles to other travellers.",
    ],
  },
  {
    title: "Late arrivals & no-shows",
    blocks: [
      "We do our best to accommodate all travelers, but we must also keep tours on schedule for the comfort of the entire group.",
      { sub: "Pickup delays" },
      "If you arrive 10 minutes or more late to your scheduled pickup point, it may be considered a No-Show, and no refund will be issued.",
      { sub: "Shared tour stop delays" },
      "During shared tours, timing is very important. If you return 15 minutes or more late at any tour stop:",
      { list: ["The tour will continue for other guests.", "You will need to arrange your own transportation back to your accommodation."] },
      "Weather and parking challenges are exempt from this rule; we understand these are beyond your control.",
    ],
  },
  {
    title: "Third-party activity policy",
    blocks: [
      "Some experiences—such as gondolas, lake cruises, and Ice Explorer tours—are operated by third-party providers.",
      "These activities follow their own cancellation rules, which may differ from ours. Availability and weather may affect your booking. We will always notify you as early as possible about any changes, and refunds for these items will follow the provider's policy.",
    ],
  },
  {
    title: "Changes to your booking",
    blocks: [
      "We understand travel plans can shift. You may request changes up to 72 hours before the tour, and we will do our best to accommodate them. Changes include:",
      { list: ["Adjusting tour dates", "Modifying activities", "Customizing the itinerary"] },
      "Certain activities depend on availability and may have additional costs.",
      "If weather affects road access or safety, we may adjust your itinerary or reschedule the experience.",
    ],
  },
  {
    title: "Force majeure (events beyond our control)",
    blocks: [
      "Sometimes unexpected events can impact travel. Vista Chase is not responsible for cancellations or changes caused by circumstances outside our control, such as:",
      { list: ["Road or park closures", "Wildfires or flooding", "Extreme weather", "Government restrictions", "Natural disasters", "Airline or transportation disruptions"] },
      "In these cases, we will work with you to reschedule your tour or offer partial refunds where possible, depending on provider policies.",
    ],
  },
  { title: "Refund processing", blocks: ["All approved refunds are processed within 5–10 business days and returned to the original payment method."] },
  {
    title: "Waivers & safety",
    blocks: ["Some activities, such as hiking or adventure experiences, require signing a waiver. If a waiver is required and not signed, the activity will be cancelled without refund."],
  },
  {
    title: "Travel insurance",
    blocks: [
      "We strongly recommend purchasing travel insurance that covers:",
      { list: ["Trip cancellations", "Medical emergencies", "Weather disruptions", "Lost or delayed baggage"] },
      "This provides extra peace of mind for your trip.",
    ],
  },
  {
    title: "Communication requirements",
    blocks: [
      "To ensure your request is received on time, please send all cancellations or changes through:",
      { list: ["support@vistachase.com", "+1 825-734-9456 (call or WhatsApp)"] },
      "This helps us respond quickly and avoid miscommunication.",
    ],
  },
];

export default function CancellationPolicyPage() {
  return (
    <LegalDocument
      title="Cancellation policy"
      intro="Cancel at least 72 hours before your tour for a refund. Here's exactly how deposits, groups, multi-day trips and third-party activities work."
      sections={SECTIONS}
      current="/cancellation-policy"
    />
  );
}
