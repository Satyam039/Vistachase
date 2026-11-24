// Four-Day Rockies & Jasper page copy (owner's Trello card, 2026-11-24): introduction, pricing,
// luggage wording and the 18 product FAQs, verbatim. The page is app/four-day-rockies-and-jasper.

import { FOUR_DAY_CANCELLATION } from "@/lib/privateTours";

export const FOUR_DAY_PRICE = { total: 6300, undiscounted: 7000, saving: 700 };

export const FOUR_DAY_INTRO = {
  headline: "Four private adventures. Discover more of the Rockies.",
  paragraphs: [
    "Explore Banff’s lakes and viewpoints, Lake Louise and Yoho, then follow the Icefields Parkway into Jasper. Stay overnight in Jasper before discovering Maligne Valley and the waterfalls along your return route.",
    "Enjoy a private van and driver-guide for each tour, with 10% savings included. Choose available dates for the Banff and Lake Louise/Yoho experiences; the Icefields-to-Jasper and Jasper return tours run on consecutive dates.",
    "Summer only, June 1–October 10. Accommodation and optional activities cost extra.",
  ],
};

export const FOUR_DAY_PRICING = [
  "CAD $6,300 per private van for all four tours, including taxes, mandatory fees and 10% savings.",
  "Save CAD $700 against the undiscounted four-day total of CAD $7,000. Optional activities, accommodation, meals and separately arranged Calgary transfers cost extra.",
];

export const FOUR_DAY_LUGGAGE = [
  "Bringing luggage for your Jasper overnight is welcome. Our passenger vans have rear luggage space and can normally accommodate one checked bag and personal items per guest, including a group of 14.",
  "Please tell us about your bags in advance, particularly oversized items or additional luggage, so we can confirm the arrangements.",
];

export const FOUR_DAY_FAQS: { q: string; a: string[] }[] = [
  {
    q: "Why choose the Four-Day Rockies & Jasper package?",
    a: [
      "Explore beyond the Banff area with four complementary private experiences: Banff sightseeing, Lake Louise and Yoho, the Icefields Parkway to Jasper, and Jasper sightseeing with a return journey.",
      "You receive a private van and driver-guide for each tour and save CAD $700 on the four-tour price. The Jasper overnight gives you access to another part of the Rockies without returning south immediately after the Icefields visit. Accommodation, meals and optional activities are extra.",
    ],
  },
  {
    q: "How is this different from the three-day package?",
    a: [
      "The Banff, Lake Louise/Yoho and Icefields sightseeing form the foundation of both packages. This package continues to Jasper after the Icefields visit, adds a guest-booked overnight there, and includes a separate Jasper sightseeing and return tour.",
      "The Jasper tour includes Medicine Lake, Maligne Lake, Athabasca Falls and Sunwapta Falls, with Maligne Canyon included only if officially reopened and suitable for the visit.",
    ],
  },
  {
    q: "Must all four tours run on consecutive days?",
    a: [
      "No. The Banff and Lake Louise/Yoho tours can be booked on other available dates.",
      "However, Icefields Parkway to Jasper and Jasper Highlights & Return must run on consecutive dates, with an overnight stay in Jasper between them. All four tours must have different dates within June 1–October 10.",
    ],
  },
  {
    q: "Where should we book accommodation?",
    a: [
      "Book accommodation in Banff or Canmore around the Banff-based tours, and in Jasper town for the night between the Icefields-to-Jasper and Jasper return tours.",
      "Accommodation is not included. Confirm your tour dates before making non-refundable hotel reservations.",
    ],
  },
  {
    q: "What does the package cost, and what do we save?",
    a: [
      "The package costs CAD $6,300 per private van, including taxes, mandatory fees and 10% savings. That is CAD $700 less than the undiscounted four-day total.",
      "It covers up to 14 guests; 12–13 is recommended for comfort. Accommodation, meals, optional attraction tickets and separately arranged Calgary transfers cost extra.",
    ],
  },
  {
    q: "Where does the tour finish?",
    a: [
      "Your included final drop-off can be in Banff, Canmore or Lake Louise, as arranged when booking.",
      "Calgary drop-off, including the airport, costs extra and must be arranged separately in advance. Flight timing and the transfer arrangements require team confirmation.",
    ],
  },
  {
    q: "How long are the Icefields-to-Jasper and Jasper return tours?",
    a: [
      "Allow approximately 10 hours for Icefields-to-Jasper.",
      "The Jasper sightseeing and return tour to Banff or Canmore normally takes 10–12 hours. Traffic, conditions and reserved activities may affect timing. A separately arranged Calgary transfer requires additional planning.",
    ],
  },
  {
    q: "Can we bring luggage for the Jasper overnight?",
    a: [
      "Yes. Our vans have rear luggage space and normally accommodate one checked bag and personal items per guest, including a group of 14.",
      "Please tell us about your luggage beforehand so we can confirm space for oversized items, additional bags or other equipment.",
    ],
  },
  {
    q: "Which activities can we add?",
    a: [
      "Request:",
      "• Banff Gondola and Lake Minnewanka cruise on the Banff sightseeing tour.\n• Combined Ice Explorer + Skywalk on the Icefields-to-Jasper tour.\n• Maligne Lake cruise to Spirit Island on the Jasper tour.",
      "Activities cost extra and depend on operation, availability and the day’s schedule. Select participant numbers during booking; staff arrange tickets and invoice separately. Ice Explorer and Skywalk cannot be selected individually.",
    ],
  },
  {
    q: "Will we see Spirit Island without taking the cruise?",
    a: [
      "The standard itinerary includes a Maligne Lake lakeshore visit. The Spirit Island visit is part of the optional Maligne Lake cruise, which requires a separate ticket. It is not included in the standard lakeshore stop.",
    ],
  },
  {
    q: "Is Maligne Canyon guaranteed?",
    a: [
      "No. It is included only if officially reopened and suitable for your departure. Otherwise, the guide adjusts the day’s sightseeing. Its availability must be checked for your travel date.",
    ],
  },
  {
    q: "Does everyone have to join the optional activities?",
    a: [
      "No. Only participating guests need tickets. Other guests can discuss appropriate alternatives at the attraction location and agree on meeting arrangements with the guide.",
      "For the Icefield Centre, options include lunch, the centre and suitable independent walks arranged around the schedule. Declining an attraction does not create a separate sightseeing tour.",
    ],
  },
  {
    q: "How flexible is the itinerary?",
    a: [
      "Discuss stops and pacing with your guide. Longer visits can require another stop to be shortened or skipped.",
      "Reserved activities, the journey to Jasper and the return journey constrain the available time. The two Jasper-linked tours must remain on consecutive dates.",
    ],
  },
  {
    q: "Where are the lunch stops?",
    a: [
      "Lunch is planned in:",
      "• Banff town on the Banff sightseeing tour.\n• Lake Louise Village on the Lake Louise/Yoho tour.\n• Columbia Icefield Centre on the Icefields-to-Jasper tour.\n• Jasper town on the Jasper sightseeing/return tour.",
      "Meals are not included. Guests can purchase food or bring a packed lunch.",
    ],
  },
  {
    q: "Are airport transfers included?",
    a: [
      "No. Calgary airport transfers are separately arranged at extra cost.",
      "The confirmed one-way Calgary–Banff/Canmore rates are CAD $364 for 1–6 passengers or CAD $850 for 7–14, including taxes and mandatory fees. Calgary–Lake Louise rates are CAD $445 and CAD $895, respectively.",
      "Ask the team to confirm the route and price for any Calgary drop-off connected directly to your Jasper return day.",
    ],
  },
  {
    q: "What is the package cancellation policy?",
    a: [
      "Cancel at least 72 hours before your earliest booked service for an 80% refund. The remaining 20% of the total package price is non-refundable.",
      "An earlier arrival transfer starts that deadline; otherwise, it starts from the first tour. Later guest cancellations and voluntarily unused services are non-refundable. Deadlines use local Alberta time.",
    ],
  },
  {
    q: "Can we change dates after booking?",
    a: [
      "You can request changes at any time, subject to availability and confirmation. The Icefields-to-Jasper and Jasper return tours must remain consecutive.",
      "A change request does not extend the cancellation deadline or make unused services refundable. Check hotel and attraction cancellation terms separately before changing arrangements.",
    ],
  },
  {
    q: "What if Vista Chase cancels a tour day?",
    a: [
      "We refund the actual amount paid for the cancelled day—normally CAD $1,575—without retaining the guest-cancellation penalty on it.",
      "If Vista Chase cancels the entire package, the package amount paid is refunded. Separately booked accommodation and invoiced attractions have their own applicable terms.",
    ],
  },
];

export { FOUR_DAY_CANCELLATION };
