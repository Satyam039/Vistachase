// General Terms & Conditions: the owner's "Vista Chase General Terms Conditions and Privacy Policy"
// document (October 28, 2026), sections 1–22 and the contact block, word for word; section 10 also
// shows the cancellation summary table from the policy, so the rules per tour type are here too. The Booking &
// Cancellation Policy from the same document is at /privacy-policy-vista-chase.

import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/legal/LegalDocument";
import { withSeo } from "@/lib/seo/server";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";

const baseMetadata: Metadata = {
  title: "Terms & Conditions | Vista Chase",
  description: "The terms that apply to bookings made directly with Vista Chase and to use of our website: bookings, payments, pickups, private and multi-day tours, cancellations and privacy.",
  alternates: { canonical: "/terms-and-conditions" },
};

const SECTIONS: LegalSection[] = [
  {
    title: "1. Bookings and Acceptance",
    blocks: [
      "The lead guest must be at least 18 and authorised to book for everyone in the reservation. They are responsible for providing accurate booking information and sharing the applicable terms, itinerary and pickup instructions with their group.",
      "A booking is confirmed when we issue a confirmation. An enquiry or unaccepted quotation does not reserve a vehicle, guide or departure.",
      "Any special arrangement must be confirmed by us in writing.",
    ],
  },
  {
    title: "2. Prices and Payments",
    blocks: [
      "Prices are in Canadian dollars unless clearly stated otherwise.",
      "Advertised tour and shuttle prices include applicable taxes and mandatory charges for the advertised service. Optional activities, upgrades and additional services are priced separately and shown before payment.",
      "Private tours are priced per vehicle according to the selected vehicle capacity. Shared tours and shuttles are priced according to the passenger categories shown when booking.",
      "Your checkout or written quotation states the payment required to confirm your booking and any balance due date. Failure to pay by the stated deadline may result in cancellation after notice.",
    ],
  },
  {
    title: "3. Inclusions and Optional Activities",
    blocks: [
      "Your product page and booking confirmation identify what is included.",
      "Unless expressly included, meals, accommodation, personal purchases and third-party activities are excluded.",
      "Optional activities may include gondolas, lake cruises, canoe rentals, the Ice Explorer and Skywalk. Availability, admission requirements and operating conditions are determined by the activity provider. Selecting an activity does not make the rest of the experience private.",
      "Accommodation is booked and paid for directly by guests unless we expressly agree otherwise in writing.",
    ],
  },
  {
    title: "4. Pickup, Timing and Return Arrangements",
    blocks: [
      "Guests must attend the pickup location at the confirmed time. Shared tours and shuttles operate to coordinated schedules and may depart without late passengers.",
      "A booking does not provide an automatic grace period or guarantee a seat on a later departure.",
      "Guests must also return to the designated meeting point at each stop by the time provided. Contact us promptly if you are delayed. Any assistance or alternative transportation is subject to availability and may involve additional cost.",
      "Travel and return times are estimates. Allow flexibility for traffic, weather, road conditions and other delays. Discuss flights or other time-sensitive connections with us before booking.",
      "Shuttle tickets do not include parking permission unless expressly stated. Samson Mall is a pickup point, not a park-and-ride facility for our guests.",
    ],
  },
  {
    title: "5. Private and Multi-Day Experiences",
    blocks: [
      "Private bookings provide a vehicle and driver-guide for your booked group during the agreed service periods.",
      "We aim to accommodate reasonable preferences within the booked route, available time and operating conditions. A private booking does not provide unlimited vehicle use, unrestricted access or unlimited changes.",
      "Guide assignments are normally made the day before departure. We aim to retain the same guide for multi-day bookings, but availability or operational circumstances may require a change. Requests for specific guides cannot be guaranteed.",
      "Guests are responsible for booking suitable accommodation along their confirmed route. Airport transfers are included only when expressly shown in the booking confirmation; otherwise, they must be arranged and paid for separately.",
    ],
  },
  {
    title: "6. Seasonal Access and Itinerary Changes",
    blocks: [
      "Routes, stops and activities may change because of weather, road or park closures, safety concerns, wildlife restrictions, traffic or third-party availability.",
      "Moraine Lake visits depend on seasonal access and operating conditions. Transportation arrangements may differ by vehicle option and may involve a shuttle transfer.",
      "We may change the order of stops or provide reasonable alternatives. Wildlife sightings, sunrise visibility, clear mountain views and particular lake colours are not guaranteed.",
      "Material changes or cancellations will be handled under our cancellation policy and applicable law.",
    ],
  },
  {
    title: "7. Guest Responsibilities and Safety",
    blocks: [
      "Guests must follow driver instructions, seatbelt requirements, park rules, wildlife guidance and activity-provider requirements.",
      "Tell us before booking about mobility needs, required child restraints, significant luggage or equipment, and assistance needed to participate. We will discuss whether the selected service can accommodate those requirements.",
      "Children must be accompanied and supervised by a responsible adult. Guests must use appropriate footwear and clothing for the conditions.",
      "Unsafe, abusive, discriminatory or seriously disruptive behaviour may result in refusal or termination of service. Consumption of alcohol, smoking, vaping and recreational drug use are prohibited in our vehicles. Guests must not participate while impaired.",
      "Any removal will be managed with reasonable attention to safety. Refund eligibility depends on the circumstances and applicable law.",
    ],
  },
  {
    title: "8. Outdoor Activities and Personal Belongings",
    blocks: [
      "Mountain travel can involve changing weather, uneven ground, slippery paths and other natural hazards. Participate within your abilities and follow safety instructions.",
      "Some activities require a separate waiver. Any required waiver should be reviewed before purchasing the activity.",
      "Keep valuables, medication and essential clothing with you. Vehicles may leave sightseeing locations between scheduled pickups. Our responsibility for lost or damaged property is determined by applicable law; nothing here excludes liability that cannot legally be excluded.",
    ],
  },
  {
    title: "9. Third-Party Providers",
    blocks: [
      "Independent providers operate certain attractions, payment services and booking platforms.",
      "Activity-specific restrictions and cancellation conditions will be disclosed before purchase where they affect your booking. We will assist with relevant changes or refund requests, but cannot guarantee an independent provider’s availability or performance.",
      "Nothing in these terms removes Vista Chase’s responsibility for its own services or your statutory rights.",
    ],
  },
  {
    title: "10. Cancellation and Refunds",
    blocks: [
      "Our Booking & Cancellation Policy forms part of these terms.",
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
      "The policy displayed and accepted when booking applies to that reservation. A later website update does not retrospectively reduce an existing booking’s refund rights.",
      "Reservations through another platform follow the terms disclosed and accepted on that platform.",
    ],
  },
  {
    title: "11. Website Content and Intellectual Property",
    blocks: [
      "Website text, photographs, branding and other materials are owned by or licensed to their respective rights holders.",
      "You may use the website to research and book services. Unauthorised commercial reproduction, fraudulent use, interference with security or disruption of the website is prohibited.",
    ],
  },
  {
    title: "12. Bookings Through Agents and Affiliates",
    blocks: [
      "An agent making a reservation on behalf of guests must have authority to do so and must provide the guests with the applicable itinerary, inclusions, exclusions, pickup instructions and cancellation terms before confirming the booking.",
      "Agents must accurately represent Vista Chase services. Changes to prices, inclusions, refund rights or other promises made by an agent do not bind Vista Chase unless we have expressly accepted them in writing.",
      "The booking confirmation identifies the service purchased. Any separate agreement between Vista Chase and an authorised agent governs their commercial relationship.",
      "Referral affiliates do not have authority to confirm reservations, collect payments on our behalf or change our terms unless expressly authorised in writing.",
    ],
  },
  {
    title: "13. Liability and Your Rights",
    blocks: [
      "We will provide our services with reasonable care and skill. Nothing in these terms excludes or limits rights, remedies or liability that cannot lawfully be excluded or limited. Guests remain responsible for following reasonable safety instructions and arranging suitable personal travel insurance.",
    ],
  },
  {
    title: "14. Events Outside Our Control",
    blocks: [
      "Severe weather, wildfires, road closures, government restrictions and other events outside our reasonable control may affect services.",
      "We will communicate material disruptions as soon as reasonably possible. Cancellation, rescheduling and refund arrangements follow our cancellation policy and applicable law.",
    ],
  },
  {
    title: "15. Privacy: Information We Collect",
    blocks: [
      "We collect personal information reasonably needed to respond to enquiries, manage bookings and deliver services. Depending on your interaction, this may include:",
      {
        list: [
          "Name, contact details and booking reference.",
          "Passenger numbers, relevant ages and vehicle requirements.",
          "Pickup addresses, accommodation details and flight information.",
          "Travel preferences and requested activities.",
          "Accessibility or health information you choose to provide for assistance or safety.",
          "Payment status, transaction references and billing information.",
          "Communications with our team.",
          "Website device, cookie and usage information, which may constitute personal information.",
        ],
      },
      "Please provide information about other travellers only with appropriate authority.",
    ],
  },
  {
    title: "16. Privacy: How Information Is Used and Shared",
    blocks: [
      "We use information to administer reservations, coordinate guides and transportation, arrange requested activities, communicate service updates, process payments and refunds, and meet legal obligations.",
      "Relevant information may be shared with assigned drivers, guides, activity providers and service providers supporting bookings, payments, communications and website operations. We limit sharing to what is reasonably needed.",
      "We do not sell personal information or provide it to other organisations for their unrelated marketing.",
      "We may disclose information where required or permitted by law, including in an emergency or to respond to lawful requests.",
    ],
  },
  {
    title: "17. Payments, Messaging and AI Assistance",
    blocks: [
      "Use the designated payment process for card payments. Do not send full card details through email, WhatsApp or website chat.",
      "If you use WhatsApp or another communication platform, that provider also processes information under its own privacy terms.",
      "AI-assisted chat or support tools, where used, may process the information you enter and may make mistakes. Do not submit unnecessary sensitive information. Ask our team to confirm information affecting your booking, payment or refund.",
    ],
  },
  {
    title: "18. Cookies, Marketing and Choices",
    blocks: [
      "Cookies may support essential website functions, preferences and usage measurement. Any non-essential tracking should operate in accordance with the choices and notices presented on the website and applicable law.",
      "Marketing communications are separate from necessary booking messages. You may unsubscribe from promotional emails without affecting essential communications about your reservation.",
    ],
  },
  {
    title: "19. Security, Retention and Access",
    blocks: [
      "We use reasonable administrative, technical and physical safeguards appropriate to the information involved. No transmission or storage system is completely risk-free.",
      "Information is retained for as long as reasonably needed for the stated purposes, legal obligations and legitimate recordkeeping, then securely deleted or anonymised where appropriate.",
      "You may request access to or correction of your personal information and ask about retention or withdrawal of consent. Requests are subject to identity verification and applicable legal exceptions. Withdrawal may affect services requiring that information.",
      "Privacy enquiries should be addressed to the person responsible for privacy at support@vistachase.com. You may also contact the Office of the Information and Privacy Commissioner of Alberta.",
    ],
  },
  {
    title: "20. Children’s Information",
    blocks: [
      "Bookings involving children must be made by an authorised adult. We collect only the information reasonably needed to arrange their participation, such as age and child-restraint requirements.",
      "Do not submit unnecessary sensitive information about a child.",
    ],
  },
  {
    title: "21. External Providers and International Processing",
    blocks: [
      "External websites and services have their own privacy practices.",
      "Where service providers process information outside Canada, additional disclosure about the countries involved, purposes and responsible privacy contact will be provided in our privacy information before the relevant collection or transfer, as required.",
    ],
  },
  {
    title: "22. Updates and Governing Law",
    blocks: [
      "These terms are governed by applicable Alberta and Canadian law, subject to mandatory rights that may apply to a guest.",
      "Updates will be posted with a revised date. Material changes affecting an existing booking require appropriate notice and, where necessary, agreement.",
    ],
  },
  {
    title: "Contact",
    blocks: [{ list: ["Vista Chase — D Tourist Inc.", "Email: support@vistachase.com", "Phone: +1 (825) 734-9456"] }],
  },
];

export default function TermsPage() {
  return (
    <>
      <PageSeoExtras path="/terms-and-conditions" />
      <LegalDocument
        title="General Terms & Conditions"
        updated="October 28, 2026"
        intro="These terms apply to bookings made directly with Vista Chase and to use of our website. Vista Chase is operated by D Tourist Inc. References to “we,” “us” and “our” mean D Tourist Inc. operating as Vista Chase. Please read these terms, the cancellation policy and the details of your selected experience before booking."
        sections={SECTIONS}
        current="/terms-and-conditions"
      />
    </>
  );
}

export function generateMetadata(): Promise<Metadata> {
  return withSeo("/terms-and-conditions", baseMetadata);
}
