// Booking & Cancellation Policy: the owner's "Vista Chase General Terms Conditions and Privacy
// Policy" document (October 28, 2026), word for word. It sits at the URL the policy has on the
// Webflow site (/privacy-policy-vista-chase), so the indexed address keeps working unchanged.
// /cancellation-policy, the easier address used in links and emails, redirects here.

import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/legal/LegalDocument";
import { withSeo } from "@/lib/seo/server";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";

const baseMetadata: Metadata = {
  title: "Booking & Cancellation Policy | Vista Chase",
  description:
    "Vista Chase cancellation deadlines and refunds: shared tours and shuttles, private single-day tours and private multi-day packages, changes, no-shows and refund processing.",
  alternates: { canonical: "/privacy-policy-vista-chase" },
};

const SECTIONS: LegalSection[] = [
  {
    title: "1. Cancellation Summary",
    blocks: [
      {
        table: {
          head: ["Booking type", "Cancellation deadline", "Refund"],
          rows: [
            ["Shared tours and shuttles", "At least 24 hours before departure", "Full refund"],
            ["Private single-day tours", "At least 72 hours before departure", "Full refund"],
            ["Private packages of two or more days", "At least 72 hours before the first tour starts", "80% refund; 20% non-refundable"],
            ["Any booking cancelled after its deadline, or a no-show", "—", "No refund"],
          ],
        },
      },
      "For private multi-day packages, the non-refundable portion is 20% of the total package price, not 20% of an instalment.",
      "If only the 20% deposit has been paid when an eligible multi-day cancellation is received, that deposit is retained and there is no payment to refund.",
      "Separately identified optional activities may have their own cancellation conditions, as disclosed before purchase. The same amount will not be deducted twice.",
    ],
  },
  {
    title: "2. How the Cutoff Is Calculated",
    blocks: [
      "All deadlines use local Alberta time at the departure location.",
      "The deadline is calculated from the scheduled start shown in your confirmation, not the calendar day alone.",
      "For example:",
      {
        list: [
          "A shared tour starting at 8:00 AM on Friday must be cancelled by 8:00 AM on Thursday for a full refund.",
          "A private tour starting at 8:00 AM on Friday must be cancelled by 8:00 AM on Tuesday to meet the 72-hour cutoff.",
        ],
      },
      "For private multi-day packages, the cutoff applies to the first tour day. It does not restart for each day of the package.",
    ],
  },
  {
    title: "3. How to Cancel",
    blocks: [
      "Online: Open “Manage Your Booking” using the link in your confirmation email. If a cancellation option is available, you can cancel directly online. The system will automatically apply the cancellation terms and refund eligibility for your booked product. Complete the cancellation process and retain the confirmation.",
      "By email: Send your booking reference, lead guest’s name and a clear cancellation request to support@vistachase.com. The time your request reaches our inbox determines whether the deadline has been met, regardless of when our team replies.",
      "The time your request reaches our designated inbox determines whether the deadline has been met. Eligibility does not depend on when our team replies.",
      "You may call or message +1 (825) 734-9456 for assistance. If cancelling by phone, request written confirmation.",
      "For reservations made through a travel platform or agent, submit your request through that provider using the terms accepted when booking.",
    ],
  },
  {
    title: "4. Changes to a Reservation",
    blocks: [
      "Date, time, pickup, passenger and activity changes are subject to availability and any price difference.",
      "Contact us as early as possible. A requested change is not confirmed until accepted by Vista Chase in writing.",
      "A change request does not automatically extend a cancellation deadline or make a non-refundable amount refundable. Any additional conditions will be explained before you accept the change.",
    ],
  },
  {
    title: "5. Late Arrivals, Missed Pickups and No-Shows",
    blocks: [
      "Guests must be ready at their confirmed pickup point and time. Shared services may leave without late passengers, and seats on another departure are not guaranteed.",
      "Failure to attend or complete the booked experience because of guest lateness or a no-show does not qualify for a refund.",
      "The same requirement applies to scheduled meeting times during a tour. Contact us promptly if you are delayed.",
    ],
  },
  {
    title: "6. Private Multi-Day Packages",
    blocks: [
      "The 20% non-refundable portion applies from booking confirmation, subject to applicable law and the operator-cancellation provisions below.",
      "Once the package begins, unused days, early departures or activities voluntarily skipped by guests are not refundable.",
      "Accommodation is arranged directly by guests. Hotel cancellation charges are governed by the accommodation provider’s terms.",
    ],
  },
  {
    title: "7. Third-Party Activities",
    blocks: [
      "Optional attractions may include gondolas, cruises, canoe rentals, Ice Explorer and Skywalk experiences.",
      "Any activity-specific cancellation deadline or non-refundable charge must be disclosed before purchase. Refunds for those separately identified items follow the applicable disclosed conditions and law.",
      "Where a provider cancels an activity, we will explain the available alternatives and pass on any refund due to you.",
    ],
  },
  {
    title: "8. If Vista Chase Cancels",
    blocks: [
      "If Vista Chase cancels an entire experience before it starts, we will offer an alternative where available or a refund of amounts paid to us for that cancelled experience.",
      "A guest-cancellation penalty, including a private package’s 20% non-refundable portion, will not be retained merely because Vista Chase cancels the entire service.",
      "For a partially delivered package or materially disrupted itinerary, we will explain the alternatives and any refund for services not provided, taking account of applicable law and separately disclosed activity terms.",
    ],
  },
  {
    title: "9. Weather, Closures and Delays",
    blocks: [
      "Rain, cloud, cold temperatures or disappointing visibility do not automatically qualify a guest for a refund when the service can operate safely.",
      "We may adjust routes or stops for safety, weather, traffic, park restrictions or road closures. If we cancel the service, Section 8 applies.",
      "If the tour operates but you cannot attend because of a flight cancellation or another personal travel disruption, the normal guest-cancellation rules apply, subject to applicable law.",
    ],
  },
  {
    title: "10. Refund Processing",
    blocks: [
      "Approved refunds are normally initiated within 5–10 business days to the original payment method. Your bank or payment provider may require additional time to display the credit.",
      "Currency conversion and exchange-rate differences are controlled by the relevant payment provider.",
    ],
  },
  {
    title: "11. Payment Schedule",
    blocks: [
      "The required deposit, balance and payment deadlines are stated at checkout or in your written quotation.",
      "A deposit payment does not change the cancellation deadline or the non-refundable portion stated for your booking.",
    ],
  },
  {
    title: "12. Travel Insurance and Statutory Rights",
    blocks: [
      "Consider travel insurance covering cancellation, medical needs and unexpected travel disruption.",
      "Nothing in this policy limits rights or remedies that cannot legally be excluded.",
    ],
  },
  {
    // The document numbers this section 12 as well; numbered 13 here so the contents list reads in order.
    title: "13. Agent-Made Reservations",
    blocks: [
      "For bookings made through an agent, contact the agent promptly to request cancellation or changes. The agent must submit the request to Vista Chase through the authorised booking system or designated contact channel.",
      "Unless different terms were expressly agreed in writing, Vista Chase’s product-specific cancellation deadlines apply when the request reaches Vista Chase.",
      "Refunds are returned through the original payment channel. Where an agent collected payment, the agent is responsible for communicating and processing any onward refund due to the guest.",
      "Agent commissions and settlement arrangements are governed separately by the applicable partner agreement.",
    ],
  },
  {
    title: "Contact",
    blocks: [{ list: ["Vista Chase — D Tourist Inc.", "support@vistachase.com", "+1 (825) 734-9456"] }],
  },
];

export default function CancellationPolicyPage() {
  return (
    <>
      <PageSeoExtras path="/privacy-policy-vista-chase" />
      <LegalDocument
        title="Booking & Cancellation Policy"
        updated="October 28, 2026"
        intro="This policy applies to reservations made directly with Vista Chase. Review the terms shown for your selected service before completing payment."
        sections={SECTIONS}
        current="/privacy-policy-vista-chase"
      />
    </>
  );
}

export function generateMetadata(): Promise<Metadata> {
  return withSeo("/privacy-policy-vista-chase", baseMetadata);
}
