// Terms & conditions: the wording of the live vistachase.com terms page.

import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Terms & Conditions | Vista Chase",
  description: "The terms that govern the Vista Chase website, bookings and participation in our tours and services.",
  alternates: { canonical: "/terms-and-conditions" },
};

const SECTIONS: LegalSection[] = [
  {
    title: "1. Acceptance of terms",
    blocks: [
      "By using our website or booking a tour, you acknowledge that you have read, understood, and agree to these Terms, along with our Privacy Policy and Booking & Cancellation Policy.",
    ],
  },
  {
    title: "2. Eligibility",
    blocks: ["To book with Vista Chase, you must be:", { list: ["At least 18 years old, or", "Under 18 with the consent of a legal guardian."] }, "By booking, you confirm you meet these requirements."],
  },
  {
    title: "3. Use of website & services",
    blocks: [
      "Vista Chase grants you a non-exclusive, revocable license to use our website for personal, non-commercial purposes. You may not:",
      {
        list: [
          "Use the website for unlawful or fraudulent activities",
          "Scrape, copy, or extract data",
          "Use automated bots or harvesting tools",
          "Attempt to disrupt website functionality",
          "Reproduce or distribute any content without permission",
        ],
      },
      "All website content is the property of Vista Chase.",
    ],
  },
  {
    title: "4. Booking & payment process",
    blocks: [
      "Booking custom experiences follow these steps:",
      {
        list: [
          "Inquiry: Submit a form or contact us directly.",
          "Quote: We send a customized experience proposal.",
          "Approval: You confirm the tour details and pricing.",
          "Payment: Pay via credit card, e-transfer, or PayPal.",
          "Confirmation: You receive a confirmed itinerary and instructions.",
        ],
      },
      "For full details, refer to our Booking & Cancellation Policy.",
    ],
  },
  {
    title: "5. Cancellations & refunds",
    blocks: [
      "All cancellations are governed by our 72-hour policy, with specific terms for large group bookings:",
      { sub: "For groups of 1–6 pax" },
      { list: ["Full refund if cancelled 72 hours or more before the tour start time.", "No refund if cancelled within 72 hours of the tour start time."] },
      { sub: "For groups of 7+ pax (large groups)" },
      {
        list: [
          "A 20% deposit (or 20% of the total payment) is strictly non-refundable upon booking.",
          "The remaining balance is refundable if cancelled 72 hours or more before the tour start time.",
          "No refund of any amount if cancelled within 72 hours of the tour.",
        ],
      },
      "Late Arrivals & No-Shows: All tours are fully chargeable if you are late or do not show up at the scheduled pickup time.",
      "Third-Party Activities: Experiences involving third-party providers (e.g., Gondolas, Lake Cruises, Ice Explorers) follow the specific cancellation rules of those providers.",
    ],
  },
  {
    title: "6. Customer responsibilities",
    blocks: [
      { sub: "Punctuality" },
      "Customers must be on time for pickup. Arriving 10+ minutes late may be marked as No-Show. On shared tours, returning 15+ minutes late at stops means the tour continues without you.",
      { sub: "Conduct" },
      "Customers must behave respectfully towards guides, other guests, wildlife, and the environment. Vista Chase may remove disruptive individuals without refund.",
      { sub: "Belongings" },
      "You are responsible for your personal items. Vista Chase is not liable for lost, stolen, or damaged belongings.",
      { sub: "Health & fitness" },
      "You must ensure you are physically able to participate in the activities included in your tour. Any medical, mobility, or health concerns must be disclosed during booking.",
      { sub: "Alcohol & substance use" },
      "Guests under the influence of drugs or alcohol may be refused service with no refund.",
    ],
  },
  {
    title: "7. Changes to itineraries",
    blocks: [
      "Travel in the Rockies can be unpredictable. Vista Chase may adjust itineraries due to: Weather, Road closures, Wildlife encounters, Safety concerns and Third-party availability.",
      "When changes occur, we will provide reasonable alternatives.",
    ],
  },
  {
    title: "8. Adventure activities & assumption of risks",
    blocks: [
      "Some tours include physical activity and natural hazards such as: Uneven terrain, Slippery surfaces, Wildlife, High altitudes, Changing weather, Snow, ice, or wind and Water-based activities.",
      "Participation is at your own risk. A waiver may be required for certain experiences. Failure to sign will result in removal from the activity without refund.",
    ],
  },
  {
    title: "9. Third-party providers",
    blocks: [
      "Some experiences are operated by trusted partners. Vista Chase acts as a facilitator only and is not responsible for:",
      { list: ["Third-party cancellations", "Delays", "Safety measures implemented by other operators", "Service quality or availability"] },
      "You are subject to the third-party provider's terms.",
    ],
  },
  {
    title: "10. Intellectual property",
    blocks: ["All logos, branding, images, videos, text, and content on the Vista Chase website are owned by Vista Chase. Any unauthorized use may result in legal action."],
  },
  {
    title: "11. User-generated content",
    blocks: [
      "If you submit reviews, photos, or feedback, you grant Vista Chase a non-exclusive, royalty-free, perpetual license to use that content for marketing or promotional purposes unless you request otherwise.",
    ],
  },
  {
    title: "12. Photography & media",
    blocks: ["By joining a Vista Chase tour, you consent to photography and video content taken during the experience being used for promotional purposes, unless you inform us in writing."],
  },
  {
    title: "13. Liability limitation",
    blocks: [
      "To the fullest extent permitted by law: Vista Chase is not liable for indirect, incidental, or consequential damages. You agree to participate at your own risk. Vista Chase is not responsible for injuries caused by failure to follow guide instructions, wildlife interactions, weather conditions, or natural terrain.",
    ],
  },
  {
    title: "14. Force majeure",
    blocks: [
      "We are not liable for cancellations or delays caused by events beyond our control, including: Extreme weather, Natural disasters, Road or park closures, Pandemics, Accidents, Government restrictions, Transportation disruptions.",
      "Refunds or rescheduling will follow our Booking & Cancellation Policy.",
    ],
  },
  {
    title: "15. Environmental responsibility",
    blocks: ["We follow “Leave No Trace” principles and expect customers to respect national park rules, wildlife guidelines, and natural spaces."],
  },
  { title: "16. Privacy", blocks: ["Your use of our website and services is also governed by our Privacy Policy, which outlines how we collect and protect personal information."] },
  {
    title: "17. Changes to terms",
    blocks: ["Vista Chase may update these Terms at any time. Updated versions will be posted on our website. Continued use of our services means you accept the updated terms."],
  },
  { title: "18. Governing law", blocks: ["These Terms are governed by the laws of the Province of Alberta, Canada. Any disputes fall under Alberta jurisdiction."] },
  {
    title: "19. Alcohol, drugs & intoxication policy",
    blocks: [
      "To ensure the safety and comfort of all guests, Vista Chase enforces a strict zero-tolerance policy regarding drugs and alcohol on all tours.",
      {
        list: [
          "No alcohol or drugs of any kind (including cannabis, edibles, vape pens, and any recreational substances) are permitted at any time during the tour.",
          "This rule applies even if the substance is legal in Canada, such as cannabis.",
          "Customers may not board the vehicle or participate in the tour if they show any signs of intoxication, including impairment from alcohol, cannabis, edibles, or other substances.",
        ],
      },
      "If a guest becomes intoxicated at any point during the day, the guide reserves full discretion to:",
      { list: ["Remove the guest from activities", "End the tour for that individual", "Or cancel participation immediately"] },
      "No refunds will be issued for removals or tour cancellations resulting from intoxication, possession of prohibited substances, or refusal to comply with this policy. These rules exist to protect you, other travellers, wildlife, and public safety.",
    ],
  },
  {
    title: "20. Intellectual property, copyrights & trademarks",
    blocks: [
      "All content and branding associated with Vista Chase, including but not limited to: the Vista Chase name; the Vista Chase logo, icons, graphics, and design elements; website content (text, descriptions, itineraries, pricing structures); photos, videos, and digital media; marketing materials, guides, and brochure content; and website layout, visuals, and custom tour descriptions are the exclusive property of Vista Chase and are protected under Canadian and international copyright and trademark laws.",
      { sub: "Trademarks" },
      "The Vista Chase name and Vista Chase logo are trademarks (registered or unregistered) owned solely by Vista Chase.",
      "No person or business may copy, reproduce, distribute, display, or use our name, logo, or brand elements without written permission from Vista Chase.",
      "Use of our trademarks in a manner that creates confusion, competition, or misrepresentation is strictly prohibited and may result in legal action.",
      { sub: "Copyright protection" },
      "All original content published by Vista Chase — including tour descriptions, blog content, experience details, images, videos, and original media — is protected by copyright. You may not:",
      {
        list: [
          "Copy or republish our content",
          "Reproduce tour descriptions or itineraries",
          "Use our photos or videos for commercial use",
          "Create derivative works",
          "Use our content for competitor websites or agencies",
        ],
      },
      "without receiving prior written authorization from Vista Chase.",
      { sub: "Prohibited use" },
      "You expressly agree not to:",
      {
        list: [
          "Use or imitate our branding for any commercial purpose",
          "Register any domain name, business name, or social media handle containing “Vista Chase” or confusingly similar variations",
          "Create misleading ads, posts, or listings using Vista Chase branding",
          "Use our images, logo, or content to sell travel services elsewhere",
        ],
      },
      "Violating these conditions may result in immediate legal action, including claims for damages and injunctive relief.",
    ],
  },
  { title: "21. Contact us", blocks: ["For any questions about these Terms, please contact:", { list: ["support@vistachase.com", "+1 825-734-9456"] }] },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms & conditions"
      intro="These General Terms & Conditions (“Terms”) govern the use of the Vista Chase website, bookings, and participation in our tours and services. By accessing our website or booking a Vista Chase experience, you agree to these Terms. If you do not agree, please discontinue use of our website and services."
      sections={SECTIONS}
      current="/terms-and-conditions"
    />
  );
}
