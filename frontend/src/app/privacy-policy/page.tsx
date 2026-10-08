// Privacy policy: the wording of the live vistachase.com privacy page.

import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Privacy Policy | Vista Chase",
  description: "How Vista Chase collects, uses and protects your personal information.",
  alternates: { canonical: "/privacy-policy" },
};

const SECTIONS: LegalSection[] = [
  {
    title: "Information we may collect",
    blocks: [
      "We collect information directly from you and through your use of our website. This helps us process bookings, personalize your experience, and improve our services.",
      { sub: "Personal information" },
      "Personal information identifies you as an individual. This may include:",
      {
        list: [
          "Contact Details: Name, email address, phone number, and mailing address.",
          "Booking Information: Travel preferences, itinerary details, accommodation preferences, and other trip-related inputs.",
          "Payment Information: Billing details required for reservations. We do not store full credit card numbers; all payments are processed through secure, PCI-compliant systems.",
          "Communication Records: Messages sent through our website, email, WhatsApp, or customer service channels.",
        ],
      },
      { sub: "Non-personal information" },
      "We also collect information that does not directly identify you:",
      {
        list: [
          "Device Information: IP address, browser type, device model, and operating system.",
          "Usage Data: Pages visited, links clicked, time spent on the site, and general browsing behavior.",
          "Cookies: Small data files that help us analyze website performance and improve your experience. (See the Cookies Policy section below.)",
        ],
      },
    ],
  },
  {
    title: "Legal basis for using your information",
    blocks: [
      "We process personal information based on:",
      {
        list: [
          "Your consent (e.g., newsletter signup or inquiry form)",
          "Contract fulfilment (e.g., processing bookings and sending itineraries)",
          "Legitimate business interests (e.g., analytics, service improvement)",
          "Legal obligations (e.g., tax, compliance, and reporting requirements)",
        ],
      },
    ],
  },
  {
    title: "How we use your information",
    blocks: [
      "We use your information to deliver quality experiences and enhance your interactions with Vista Chase. We use data to:",
      {
        list: [
          "Process Bookings: Confirm reservations, customize itineraries, and provide relevant travel details.",
          "Improve Services: Analyze feedback, enhance our offerings, and develop new travel experiences.",
          "Communicate with You: Send confirmations, updates, and customer support responses.",
          "Provide Marketing Updates: Share relevant promotions or Vista Chase announcements. You may opt out of promotional emails at any time.",
        ],
      },
      "We do not sell or disclose your personal information to external companies for their own marketing purposes.",
    ],
  },
  {
    title: "Sharing of information",
    blocks: [
      "Your information is shared only when necessary to provide services or comply with the law. We may share your information with:",
      {
        list: [
          "Trusted Service Providers: Third-party partners assisting with payment processing, booking systems, website hosting, or operational support. They must protect your data and use it only for the services they provide to us.",
          "Legal or Regulatory Authorities: If required by law, court order, or lawful government request.",
        ],
      },
      { sub: "International transfers" },
      "Some trusted third-party service providers may store or process data on servers located outside Canada. These providers follow strict security and confidentiality obligations.",
    ],
  },
  {
    title: "Data security and retention",
    blocks: [
      "We use industry-standard safeguards to protect your information from unauthorized access, alteration, or misuse. Security practices include: Encryption, Secure servers, Access restrictions and Regular system updates.",
      "We keep your information only as long as necessary to: Provide your booked services, Meet legal or accounting requirements, Resolve disputes or protect our rights.",
    ],
  },
  {
    title: "Customer rights",
    blocks: [
      "Under Alberta privacy laws and best international practices, you have the right to:",
      {
        list: [
          "Access your personal information",
          "Correct or update inaccurate information",
          "Request deletion of certain data (subject to legal limits)",
          "Withdraw consent for marketing or data processing",
          "Request a copy of your stored information",
        ],
      },
      "To exercise any of these rights, contact: support@vistachase.com",
      "If you have concerns about how your information is handled, you may also contact the Office of the Information and Privacy Commissioner of Alberta.",
    ],
  },
  {
    title: "Children's privacy",
    blocks: [
      "We do not knowingly collect personal information from children under 16 years old. If you believe a child has provided information without parental consent, please contact us so we can delete it.",
    ],
  },
  {
    title: "Use of AI technology",
    blocks: [
      "We may use AI-assisted tools to enhance customer experience—for example, analyzing feedback or improving response quality.",
      "We do not use AI for automated decision-making related to pricing, eligibility, or customer rights.",
      "All AI usage complies with data protection regulations and ethical standards.",
    ],
  },
  {
    title: "Cookies policy",
    blocks: [
      "Our website may use cookies to provide a smoother browsing experience and understand how visitors use our site. We use:",
      {
        list: [
          "Essential Cookies: Required for the website to function.",
          "Analytics Cookies: Help us understand website performance and visitor behavior.",
          "Preference Cookies: Remember your language, region, or settings.",
        ],
      },
      "You can manage cookie preferences through your browser settings. Disabling cookies may affect website performance.",
    ],
  },
  {
    title: "External links",
    blocks: [
      "Our website may contain links to third-party sites (such as tourism boards or travel platforms). Vista Chase is not responsible for the privacy practices or content of these websites. We recommend reviewing their policies before sharing information.",
    ],
  },
  {
    title: "Privacy policy updates",
    blocks: [
      "We may update this policy occasionally to reflect new practices or legal requirements. Any updates will be posted on this page, and we encourage you to review the policy periodically.",
    ],
  },
  {
    title: "Contact us",
    blocks: ["For questions about this Privacy Policy, data practices, or to exercise your privacy rights, please contact us at:", { list: ["Vista Chase Support Email: support@vistachase.com"] }],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title="Privacy policy"
      intro="At Vista Chase, your privacy matters. We are committed to protecting any personal information you share with us and using it only to deliver safe, reliable, and personalized travel experiences. We never sell your information, and we strive to keep our practices transparent, secure, and easy to understand."
      sections={SECTIONS}
      current="/privacy-policy"
    />
  );
}
