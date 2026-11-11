// What the concierge knows about Vista Chase without an AI model (concierge.fallback.ts).
//
// Every answer here is copied or condensed from what the website already publishes: the FAQ page
// (frontend app/faq), the Shared and Private tour pages (frontend lib/sharedTours.ts,
// lib/privateTours.ts), the Booking & Cancellation Policy and the owner's pricing that the AI
// agent's prompt also uses (concierge.agent.ts). Nothing is new information. When a question
// isn't covered, the concierge says so and offers a live agent instead of guessing.
//
// Matching: each topic has weighted patterns. A topic answers early (before the tour, date and
// price handlers) when it scores 2 or more, and as a last resort when it scores 1.

import { BALANCE_DUE_DAYS_BEFORE, DEPOSIT_MIN_DAYS_BEFORE, DEPOSIT_PERCENT } from "@/modules/bookings/deposit";
import { activityTicketsVisible } from "@/modules/tours/product-map";

export const PHONE = "+1 (825) 734-9456";
export const CONTACT = `call us on ${PHONE} (6 a.m. – 9 p.m. Mountain Time) or email support@vistachase.com`;

interface Topic {
  id: string;
  /** [pattern, weight]: a weight of 2 means the pattern alone is enough to answer. */
  patterns: [RegExp, number][];
  answer: () => string;
}

const TOPICS: Topic[] = [
  {
    id: "lunch",
    patterns: [[/\b(lunch|meals?|food|eat|eating|snacks?|restaurants?|breakfast|dinner|vegetarian|vegan|halal)\b/, 2]],
    answer: () =>
      "Lunch isn't included. On Banff & Yoho Discovery we stop in Lake Louise Village, and on the Columbia Icefield Adventure at the Columbia Icefield Centre, where you can buy lunch. You're welcome to bring a packed lunch and snacks. Bottled water is provided.",
  },
  {
    id: "bring",
    patterns: [
      [/\b(what (should|do|to) (i|we) (bring|pack|wear)|what to (bring|pack|wear)|wear|clothes|clothing|shoes|boots|jacket|dress)\b/, 2],
      [/\b(bring|pack)\b/, 1],
    ],
    answer: () =>
      "Bring comfortable walking shoes, layers, a weatherproof jacket, sun protection and a camera. Pack an extra warm layer for the Columbia Icefield day. In winter, add warm waterproof layers, gloves and insulated boots.",
  },
  {
    id: "weather",
    patterns: [[/\b(weather|rain\w*|snow\w*|cold|temperature|storm|forecast|road clos\w*)\b/, 2]],
    answer: () =>
      "Tours run in most weather, and your guide may adjust stops for comfort and visibility. If Parks Canada closes a road, we offer a free reschedule or a full refund.",
  },
  {
    id: "wildlife",
    patterns: [[/\b(wildlife|animals?|bears?|elk|moose|sheep|goats?|deer)\b/, 2]],
    answer: () =>
      "Elk, deer, bighorn sheep and mountain goats are common, and sometimes bears. Sightings are possible but can't be guaranteed, and we always keep a safe distance.",
  },
  {
    id: "ages",
    patterns: [[/\b(kids?|child\w*|infants?|bab(y|ies)|toddlers?|ages?|youth|teens?|teenagers?|old enough|family|families)\b/, 2]],
    answer: () =>
      "Children are welcome. Ages: Adult 16–99, Youth 6–15, Infant 0–5. On shared tours and shuttles infants pay their fare and take their own seat. Walks at the stops are short and light to moderate, and guides pace the day for everyone. You'll see the price for each age when you choose guests on the tour page.",
  },
  {
    id: "accessibility",
    patterns: [[/\b(wheelchairs?|mobility|accessib\w*|disab\w*|seniors?|elderly|fitness|difficult\w*|strenuous|hik\w*|walking)\b/, 2]],
    answer: () =>
      `Walking varies by itinerary, with some uneven paths and uphill sections, but stops are short and guides pace the day for everyone. If anyone in your group has mobility concerns, please contact us before booking so we can advise: ${CONTACT}.`,
  },
  {
    id: "group-size",
    patterns: [
      [/\b(group size|how many (people|guests|persons|passengers)|maximum|max|capacity|large group|big group|groups? of \d+|\d+ (people|guests|persons))\b/, 2],
    ],
    answer: () =>
      "Shared tours are small-group tours. Private tours are priced per vehicle, for up to 13 guests. For a bigger group, send us a request at /contact-us?group=1 and the team will plan it.",
  },
  {
    id: "private",
    patterns: [
      [/\bprivate\b/, 1],
      [/\b(custom\w*|own (guide|vehicle|itinerary)|tailor\w*|bespoke|how (does|do) (it|they|private) work|per vehicle)\b/, 1],
    ],
    answer: () =>
      "Private tours give you your own vehicle, a dedicated driver-guide and doorstep pickup, priced per vehicle for up to 13 guests. The price includes national park fees, Moraine Lake access where it's on the itinerary, taxes and required fees. Gondolas, cruises, Ice Explorer and Skywalk, lunch and accommodation cost extra. We can adjust stops and pacing where the route and conditions allow, and our sister company Banff Elite plans fully bespoke trips. See /private-tours.",
  },
  {
    id: "airport",
    patterns: [[/\b(airport|yyc|calgary|transfers?|arrival|flight)\b/, 2]],
    answer: () =>
      "We arrange Calgary airport transfers with private bookings of two or more tour days (not with a one-day tour or on their own): tick the airport transfer box when you book the package and add your flight, accommodation, guests and luggage. The price is CAD $364 per transfer, added to the total at checkout and paid with the tour; the team confirms the arrangements.",
  },
  {
    id: "accommodation",
    patterns: [[/\b(accommodation|hotels? (included|booking)|book (a|our|the) hotel|where (should|to) (we|i) stay|overnight|lodging)\b/, 2]],
    answer: () =>
      "Accommodation isn't included in any tour: you choose and book your own. For tours of up to three days you can stay in Banff, Canmore or Lake Louise; the four-day journey needs a night in Jasper after day three.",
  },
  {
    id: "multiday",
    patterns: [[/\b(two[- ]day|2[- ]day|three[- ]day|3[- ]day|four[- ]day|4[- ]day|multi[- ]?day|package|combine|both tours)\b/, 2]],
    answer: () =>
      "Multi-day options: the shared Two-Day Rockies Explorer books Banff & Yoho Discovery and the Columbia Icefield Adventure together and saves 10% (other guests join, up to 12 each day). Private journeys run two days (CAD $1,575 per day in summer, $1,240 in winter) or three and four days (CAD $1,575 per day, June 1 to October 10 only). Accommodation isn't included. See /multi-day-tour-package-for-banff.",
  },
  {
    id: "choose",
    patterns: [[/\b(which (tour|one|trip)|best tour|recommend\w*|suggest\w*|first time|should (i|we) (choose|do|book))\b/, 2]],
    answer: () =>
      "Choose Banff & Yoho Discovery for the iconic lakes (Lake Louise, Moraine Lake in season, Emerald Lake), or the Columbia Icefield Adventure for the Icefields Parkway and the glacier. The Two-Day Rockies Explorer combines both and saves 10%. Prefer your own vehicle and pace? Pick a private tour. Just want to reach Moraine Lake and Lake Louise? Take our lake shuttle.",
  },
  {
    id: "duration",
    patterns: [[/\b(how long|how many hours|duration|what time .*(back|return|finish|end)|return time|get back)\b/, 2]],
    answer: () =>
      "Each single-day tour is a full-day outing, and each tour page shows its estimated duration. Traffic, weather and road conditions can change return times.",
  },
  {
    id: "pickup-time",
    patterns: [[/\b((what time|when) .*pick ?(you )?up|pick ?up (time|start)|time .*pick ?up)\b/, 2]],
    answer: () =>
      "Shared tour pickups start at 7:30 AM in Canmore and 8:00 AM in Banff. Shuttle pickup times depend on the departure you book. Your exact pickup time and place are on your voucher, and we confirm them before your tour. Tell me your hotel to check its pickup stop.",
  },
  {
    id: "jasper-town",
    patterns: [[/\bjasper (town|village)\b|\b(go|goes|going|visit|visits|stop) (to|in|at) jasper\b/, 2]],
    answer: () =>
      "The Columbia Icefield Adventure travels the Icefields Parkway as far as the Columbia Icefield and doesn't continue to Jasper town. The private four-day Rockies & Jasper journey does stay in Jasper.",
  },
  {
    id: "moraine-season",
    patterns: [
      [/\bmoraine\b/, 1],
      [/\b(open|opens|season|closed in|winter|when can)\b/, 1],
    ],
    answer: () =>
      "Moraine Lake is usually open from June 1 to around October 10, depending on road and weather conditions. Moraine Lake Road is closed to private cars, so you need a shuttle or a licensed operator like Vista Chase. Outside the season, tours visit Emerald Lake and the Natural Bridge instead.",
  },
  {
    id: "shuttle",
    patterns: [
      [/\bshuttles?\b/, 1],
      [/\b(how (does|do) (it|the shuttle|shuttles) work|tell me about|info\w*|details?|explain|what is)\b/, 1],
    ],
    answer: () =>
      "Our Moraine Lake & Lake Louise shuttle runs in summer from Banff and Canmore with guaranteed access, since Moraine Lake Road is closed to private cars. Tell me a date and I'll show the times with free seats, or see /shuttles.",
  },
  {
    id: "parks-pass",
    patterns: [[/\b(parks? (canada )?pass|park (fees?|entry|admission)|national park (fees?|pass))\b/, 2]],
    answer: () =>
      "Every visitor to Banff National Park needs a Parks Canada pass. Our private tours include national park fees, and several shared tours include park entry: check What's included on the tour page. Otherwise buy a pass online from Parks Canada or at the park gate.",
  },
  {
    id: "attractions",
    patterns: [[/\b(tickets?|gondola|cruise|skywalk|ice explorer|glacier adventure|attractions?)\b/, 2]],
    answer: () =>
      activityTicketsVisible()
        ? "The summer Columbia Icefield Adventure (June 1 to October 10) includes the Ice Explorer and Skywalk. Other attraction tickets, like the Banff Gondola and lake cruises, are booked on the operator's site from /banff-activity-tickets."
        : `The summer Columbia Icefield Adventure (June 1 to October 10) includes the Ice Explorer and Skywalk, and on private tours you can add activities at checkout. We don't sell separate attraction tickets (gondola, cruises) on the website at the moment. For help, ${CONTACT}.`,
  },
  {
    id: "payment",
    patterns: [[/\b(pay|paying|payment|deposit|credit card|debit|visa|mastercard|amex|paypal|currency|tax|taxes|hidden fees?|usd|cad)\b/, 2]],
    answer: () =>
      `You pay securely by card on our checkout page (never in this chat). Prices are in CAD and the price shown is the price you pay, with taxes and required fees included. For departures at least ${DEPOSIT_MIN_DAYS_BEFORE} days away you can pay a ${DEPOSIT_PERCENT}% deposit and the balance ${BALANCE_DUE_DAYS_BEFORE} days before the tour.`,
  },
  {
    id: "voucher",
    patterns: [[/\b(voucher|confirmation (email|e-mail)|(didn.?t|did not|haven.?t|not) (get|got|receive\w*)|no email|e-?ticket)\b/, 2]],
    answer: () =>
      "Your confirmation email has your voucher. If it hasn't arrived, check your spam folder or sign in to My trips (/account/trips) with the email you booked with. You can also send me your booking reference (VC-…) and email and I'll look it up.",
  },
  {
    id: "how-to-book",
    patterns: [[/\b(how (do|can) (i|we) (book|reserve)|how to (book|reserve)|booking process|book online)\b/, 2]],
    answer: () =>
      "Pick a date on the tour page and check out securely online. You get a confirmation email with your voucher, and your guide contacts you the day before with final pickup details. I can also check dates with free seats for you: tell me the tour and a date.",
  },
  {
    id: "guide",
    patterns: [[/\b(guides?|driver)\b/, 1], [/\b(assign\w*|same|specific|request|who is|language|speak)\b/, 1]],
    answer: () =>
      "Your guide is assigned the day before your tour, and we share their contact details then. On multi-day bookings we aim to keep the same guide. You can request a specific guide when booking; we'll try, but it can't be guaranteed.",
  },
  {
    id: "late",
    patterns: [[/\b(no[- ]show|miss(ed)? (the|my) (pick ?up|tour|shuttle)|arrive late|late arrival|if (i am|i'm|we are|we're) late)\b/, 2]],
    answer: () =>
      `Please be ready at your pickup point at the confirmed time. Guests who arrive 10 or more minutes late, or don't show, are charged in full and can't be refunded. If you're running late on the day, ${CONTACT} right away.`,
  },
  {
    id: "winter",
    patterns: [[/\b(winter|december|january|february|march|christmas|ski\w*)\b/, 2]],
    answer: () =>
      "Yes, we run tours in winter. Banff & Yoho Discovery runs all year, visiting Emerald Lake and the Natural Bridge while Moraine Lake is closed (about October 10 to June 1). In winter the Ice Explorer and Skywalk don't run and the Columbia Icefield route is adjusted; our team confirms the route for your date. The lake shuttles run in summer only. Ask me for dates to see what's available.",
  },
  {
    id: "about",
    patterns: [[/\b(about (vista chase|you|your company)|who are you|licen[cs]ed|insured|reviews?|ratings?|tripadvisor|how long have you)\b/, 2]],
    answer: () =>
      "Vista Chase is a Canmore-based tour operator for Banff and the Canadian Rockies, running since 2018 and licensed by Parks Canada. We're rated 5.0 from 1,700+ reviews and won Tripadvisor Travellers' Choice Best of the Best 2026. Read more at /about-us.",
  },
];

export interface KnowledgeMatch {
  id: string;
  score: number;
  answer: string;
}

/** The best-matching topic for a question, or null when nothing published covers it. */
export function knowledgeAnswer(text: string): KnowledgeMatch | null {
  const lower = text.toLowerCase();
  let best: KnowledgeMatch | null = null;
  for (const topic of TOPICS) {
    const score = topic.patterns.reduce((sum, [re, weight]) => sum + (re.test(lower) ? weight : 0), 0);
    // Two one-point patterns must both match; a single one-point hit is too weak to answer.
    const needed = topic.patterns.every(([, w]) => w < 2) ? topic.patterns.reduce((s, [, w]) => s + w, 0) : 2;
    if (score >= needed && (!best || score > best.score)) best = { id: topic.id, score, answer: topic.answer() };
  }
  return best;
}
