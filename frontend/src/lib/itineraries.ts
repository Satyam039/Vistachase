// The website's tour itineraries: the single source for the tour pages AND the booking
// confirmation email / PDF itinerary (owner, 2026-11-14: "Fix outdated itineraries in booking
// confirmation emails and PDFs ... any itinerary changes made in the current tour data are
// reflected in future booking PDFs automatically").
//
// Used by lib/tourContent.ts (the four day tours' pages) and the Three- and Four-Day journey pages,
// and imported by the backend (backend/src/modules/bookings/tour-itinerary.ts, through the
// `@site/*` path alias) when it builds a booking's itinerary. Change an itinerary here and both the
// website and every booking PDF sent afterwards follow it.
//
// This file must stay plain data and small pure functions with NO imports, so the backend can
// compile it as it is.

export const GUIDE_CALL = "Your guide contacts you the evening before, between 6 and 9 PM, to confirm your exact pickup time.";
/** Booking terms the Columbia Icefield Adventure page lists (owner, 2026-11-23); page only, not in booking PDFs. */
export const ICEFIELD_PAGE_TERMS = [
  "Two seasonal itineraries: From June 1 to October 10 the tour includes the Ice Explorer and Skywalk at the Columbia Icefield. From October 11 to May 31 it visits Abraham Lake instead; the glacier activities are not part of the winter tour.",
  "Group size: A maximum of 12 guests per departure.",
  "What to wear in winter: Suitable winter footwear and warm clothing; ice cleats are provided wherever required.",
  "Minimum numbers: Each departure needs at least four passengers. If your departure doesn't reach four, we let you know at least one week before and offer alternatives or a full refund.",
  "Date changes: Changes requested at least 24 hours before departure are free, subject to availability.",
];

export const PRIVATE_PICKUP = "Doorstep pickup at your accommodation in Banff, Canmore or Lake Louise, at a time agreed with you before the tour.";

export interface ItineraryStep {
  time: string;
  text: string;
}

export interface ItineraryStop {
  name: string;
  text: string;
  /** Visited only from June 1 to October 10 (Moraine Lake, the Ice Explorer and Skywalk). */
  summerOnly?: boolean;
}

export interface TourItinerary {
  /** The tour's website name, with its kind ("Shared Tour" / "Private Tour"). */
  title: string;
  /** How long the day lasts, as the tour page says it. */
  duration: string;
  /** The day in order: pickup, morning, midday, afternoon, return (tour page "Pickup times"). */
  steps: ItineraryStep[];
  /** Stop by stop, with time at each (tour page "Stop by Stop"). */
  stops: ItineraryStop[];
  /** Pickup & Meeting Points paragraphs, when the page has them. */
  pickup?: string[];
  /** Important information (tour page "Important Information"). */
  seasonal: string[];
  /**
   * From October 11 to May 31 the published itinerary doesn't apply and the team confirms the
   * route for the date (the page says so). Booking PDFs for those dates then say the route is to be
   * confirmed and staff are flagged, instead of listing stops that won't be visited.
   */
  winterRouteToBeConfirmed?: boolean;
  /**
   * The tour's own October 11 – May 31 itinerary, when it has one (the Columbia Icefield
   * Adventure's Abraham Lake route). Booking PDFs for winter dates use it instead of the summer one.
   */
  winter?: { stops: ItineraryStop[]; steps: ItineraryStep[]; notes: string[] };
}

/** June 1 to October 10, for a YYYY-MM-DD date: Moraine Lake and the Icefield activities. */
export function inSummerSeason(date: string): boolean {
  const md = date.slice(5, 10);
  return md >= "06-01" && md <= "10-10";
}

// ---------------------------------------------------------------------------------------------
// Day tours (owner's doc, 2026-11-04; private days follow the shared ones, doc 2026-10-28).

const BANFF_YOHO_MIDDAY = "Lunch stop in Lake Louise Village (lunch not included), then Emerald Lake and the Natural Bridge in Yoho, the Lower Spiral Tunnels and Morant's Curve.";
const BANFF_YOHO_AFTERNOON = "Johnston Canyon, Lake Minnewanka and Two Jack Lake.";
const ICEFIELD_MORNING = "Bow Lake, Crowfoot Glacier, Peyto Lake and Waterfowl Lakes along the Icefields Parkway.";

const BANFF_YOHO_STOPS: ItineraryStop[] = [
  { name: "Lake Louise", text: "About 1 hour beside the famous lake below Victoria Glacier." },
  { name: "Moraine Lake", text: "About 1 hour in the Valley of the Ten Peaks. Transportation is arranged for you from June 1 to October 10.", summerOnly: true },
  { name: "Johnston Canyon", text: "About 1 hour on the canyon walkways toward the falls." },
  { name: "Emerald Lake", text: "About 30 minutes on the shore of Yoho's best-known lake." },
  { name: "Natural Bridge", text: "About 15 minutes where the Kicking Horse River cuts through the rock." },
  { name: "Lake Minnewanka", text: "About 20 minutes beside Banff's largest lake." },
  { name: "Two Jack Lake", text: "About 15 minutes for reflections of Mount Rundle." },
  { name: "Lower Spiral Tunnels Viewpoint", text: "About 15 minutes at the railway's famous loop tunnels." },
  { name: "Morant's Curve", text: "About 15 minutes at the classic Bow River railway view, with a drive along the Bow Valley Parkway." },
];

const ICEFIELD_STOPS: ItineraryStop[] = [
  { name: "Bow Lake", text: "A scenic lakeside stop surrounded by towering peaks and glacier-fed waters. Approximately 30 minutes." },
  { name: "Crowfoot Glacier", text: "A brief roadside viewpoint overlooking the historic glacier. Approximately 15 minutes." },
  { name: "Peyto Lake", text: "Enjoy the famous turquoise lake from its panoramic viewpoint. Approximately 30 minutes, including a short uphill walk." },
  { name: "Waterfowl Lakes", text: "A peaceful photography stop framed by the rugged peaks of the Icefields Parkway. Approximately 15 minutes." },
  { name: "Columbia Icefield Ice Explorer", text: "Ride a specially designed vehicle onto the Athabasca Glacier. Seasonal activity.", summerOnly: true },
  { name: "Columbia Icefield Skywalk", text: "Experience dramatic views over the Sunwapta Valley from a glass-floored walkway. Seasonal activity.", summerOnly: true },
];

/** Vista Chase calls the day before (owner, 2026-11-23, Columbia Icefield Adventure page). */
const VC_DAY_BEFORE_CALL = "Vista Chase contacts you the day before your tour to confirm your pickup time and location and to share your driver-guide's name and contact details.";

// Columbia Icefield Adventure (shared), owner's page changes of 2026-11-23: a summer and a winter
// itinerary (the page also explains the waterfall replacement route and Pursuit ticket refunds).
const ICEFIELD_SUMMER_STOPS: ItineraryStop[] = [
  ...ICEFIELD_STOPS.slice(0, 4),
  { name: "Columbia Icefield Ice Explorer", text: "Ride a specially designed vehicle onto the Athabasca Glacier. Included from June 1 to October 10; our team arranges your tickets and activity times.", summerOnly: true },
  { name: "Columbia Icefield Skywalk", text: "Dramatic views over the Sunwapta Valley from a glass-floored walkway. Included from June 1 to October 10. Allow about 2½ hours for both activities combined.", summerOnly: true },
  { name: "Lunch at the Columbia Icefield Centre", text: "A one-hour lunch break, separate from the activities. Buy lunch at the Centre or bring a packed lunch (lunch not included).", summerOnly: true },
];

const ICEFIELD_WINTER_STOPS: ItineraryStop[] = [
  ICEFIELD_STOPS[0],
  { ...ICEFIELD_STOPS[1], name: "Crowfoot Glacier Lookout" },
  { ...ICEFIELD_STOPS[2], text: "Enjoy the famous lake from its panoramic viewpoint. Approximately 30 minutes, including a short uphill walk that may be snowy or icy." },
  ICEFIELD_STOPS[3],
  {
    name: "Abraham Lake",
    text: "Normally about 30–45 minutes, or up to 90 minutes when lunch is taken here. When the lake is frozen and your guide judges conditions suitable, you may walk onto the ice to look for frozen bubbles; otherwise enjoy a shoreline walk and photographs. Bubbles and ice access are not guaranteed. Ice cleats are provided wherever required.",
  },
];

export const TOUR_ITINERARIES: Record<string, TourItinerary> = {
  "banff-highlights-tour": {
    title: "Banff & Yoho Discovery (Shared Tour)",
    duration: "10–11 hours",
    // Owner (2026-11-21): show the 60-minute lunch stop in Lake Louise Village after the two lakes.
    stops: [
      ...BANFF_YOHO_STOPS.slice(0, 2),
      { name: "Lunch in Lake Louise Village", text: "A 60-minute lunch stop in Lake Louise Village (lunch not included)." },
      ...BANFF_YOHO_STOPS.slice(2),
    ],
    steps: [
      { time: "7:30 – 8:00 AM", text: `Pickup in Canmore from about 7:30 AM and in Banff from about 8:00 AM. ${GUIDE_CALL}` },
      { time: "Morning", text: "Lake Louise and Moraine Lake (Moraine Lake from June 1 to October 10)." },
      // Owner (2026-11-21): the shared tour's lunch stop in Lake Louise is 60 minutes.
      { time: "Midday", text: BANFF_YOHO_MIDDAY.replace("Lunch stop in Lake Louise Village", "60-minute lunch stop in Lake Louise Village") },
      { time: "Afternoon", text: BANFF_YOHO_AFTERNOON },
      { time: "5:30 – 6:00 PM", text: "Back in Banff around 5:30 PM and Canmore around 6:00 PM." },
    ],
    // "Important Information" from the owner's doc (2026-11-04, section E).
    seasonal: [
      "Seasonal itinerary: The route and accessible attractions vary by season. Moraine Lake is generally accessible during its operating season, subject to conditions.",
      "Mountain weather: Conditions can change quickly. Comfortable footwear and layered clothing are recommended.",
      "Itinerary adjustments: Stops may change because of road closures, weather, operational restrictions or other circumstances.",
      "Wildlife sightings are possible but can't be guaranteed.",
    ],
  },
  "shared-tours-icefields-jasper": {
    title: "Columbia Icefield Adventure (Shared Tour)",
    duration: "9–11 hours (up to 12 hours on the waterfall replacement itinerary)",
    stops: ICEFIELD_SUMMER_STOPS,
    steps: [
      { time: "7:30 – 8:00 AM", text: `Pickup in Canmore from about 7:30 AM and in Banff from about 8:00 AM. ${VC_DAY_BEFORE_CALL}` },
      { time: "Morning", text: ICEFIELD_MORNING },
      { time: "Midday", text: "Columbia Icefield: the Ice Explorer onto the Athabasca Glacier and the Skywalk (June 1 to October 10; about 2½ hours for both, at times our team arranges), plus a one-hour lunch break at the Columbia Icefield Centre (lunch not included)." },
      { time: "Afternoon", text: "Scenic drive back along the Icefields Parkway." },
      { time: "Evening", text: "Back in Banff and Canmore. Traffic, weather and road conditions can affect return times." },
    ],
    pickup: [
      "Complimentary pickup and drop-off are available at designated locations in Canmore and Banff.",
      `Pickup generally begins around 7:30 AM in Canmore and 8:00 AM in Banff. ${VC_DAY_BEFORE_CALL}`,
      "Please be ready at your confirmed pickup location a few minutes before the scheduled time.",
    ],
    // "Important Information" from the owner's doc (2026-11-04), with the 2026-11-23 page changes.
    seasonal: [
      "Activity disruption: If the Icefield activities can't operate, the tour visits Athabasca Falls and Sunwapta Falls instead (up to 12 hours; the tour does not visit Jasper town). Ice Explorer and Skywalk ticket refunds follow Pursuit's decision: any refund Pursuit gives Vista Chase is passed to you, and an attraction cancellation doesn't automatically qualify for a full-tour refund.",
      "Weather and road conditions: Stops, routes and their order may change due to weather, road closures or operational requirements.",
      "What to bring: Dress in layers and bring a warm jacket, comfortable walking shoes and water. Temperatures along the Icefields Parkway can be significantly colder than in Banff.",
      "Wildlife: Wildlife sightings are possible but cannot be guaranteed.",
    ],
    winter: {
      stops: ICEFIELD_WINTER_STOPS,
      steps: [
        { time: "7:30 – 8:00 AM", text: `Pickup in Canmore from about 7:30 AM and in Banff from about 8:00 AM. ${VC_DAY_BEFORE_CALL}` },
        { time: "Morning", text: "Bow Lake, Crowfoot Glacier Lookout, Peyto Lake and Waterfowl Lakes. On request, a quick morning stop in Lake Louise Village to buy food." },
        { time: "Midday", text: "Abraham Lake, normally about 30–45 minutes (up to 90 minutes when lunch is taken there). Bring a packed lunch; there is no scheduled restaurant stop." },
        { time: "Afternoon", text: "Scenic drive back to Banff and Canmore." },
        { time: "Evening", text: "Back in Banff and Canmore. Traffic, weather and road conditions can affect return times." },
      ],
      notes: [
        "Winter itinerary (October 11 to May 31): Abraham Lake replaces the Columbia Icefield Centre experience. The Ice Explorer and Skywalk are not part of the winter tour.",
        "Ice cleats are provided wherever required. Your guide decides whether conditions are suitable for walking onto the ice.",
      ],
    },
  },
  "banff-private-tour": {
    title: "Banff & Yoho Discovery (Private Tour)",
    duration: "About 10 to 12 hours, door to door",
    stops: BANFF_YOHO_STOPS.map((s) =>
      s.name === "Moraine Lake" ? { ...s, text: "About 1 hour in the Valley of the Ten Peaks, during its operating season (usually June to early October)." } : s,
    ),
    steps: [
      { time: "Morning", text: `${PRIVATE_PICKUP} ${GUIDE_CALL}` },
      { time: "Morning", text: "Lake Louise and Moraine Lake (Moraine Lake during its operating season)." },
      { time: "Midday", text: BANFF_YOHO_MIDDAY },
      { time: "Afternoon", text: BANFF_YOHO_AFTERNOON },
      { time: "Evening", text: "Drop-off at your accommodation. The day runs about 10 to 12 hours, depending on your pace." },
    ],
    seasonal: [
      "Price per vehicle, up to 13 guests: CAD $1,750 from June 1 to October 10, all-inclusive (tax, park entry and Moraine Lake entry fees); CAD $1,240 from October 11 to May 31.",
      "Moraine Lake: during its operating season (usually June to early October); access arrangements depend on your vehicle and are explained before booking.",
      "The route varies by season: your guide adjusts stops to road and weather conditions.",
      "Weather: mountain conditions change quickly, so dress in layers and wear comfortable shoes.",
      "Wildlife sightings are possible but can't be guaranteed.",
    ],
  },
  "icefields-jasper-private-tour": {
    title: "Columbia Icefield Adventure (Private Tour)",
    duration: "About 10 to 12 hours, door to door",
    stops: ICEFIELD_STOPS.map((s) =>
      /ice explorer|skywalk/i.test(s.name) ? { ...s, name: `${s.name} — Optional Add-On`, text: s.text.replace("Included from June 1 to October 10.", "Seasonal; admission costs extra.") } : s,
    ),
    steps: [
      { time: "Morning", text: `${PRIVATE_PICKUP} ${GUIDE_CALL}` },
      { time: "Morning", text: ICEFIELD_MORNING },
      { time: "Midday", text: "Columbia Icefield, with the optional Ice Explorer and Skywalk in season. Lunch stop at the Columbia Icefield Centre (lunch not included)." },
      { time: "Afternoon", text: "Scenic drive back along the Icefields Parkway." },
      { time: "Evening", text: "Drop-off at your accommodation. Traffic, weather and road conditions can affect return times." },
    ],
    seasonal: [
      "Price per vehicle, up to 13 guests: CAD $1,750 from June 1 to October 10; CAD $1,240 from October 11 to May 31.",
      "Ice Explorer and Skywalk: June 1 to October 10, optional and at extra cost.",
      "From October 11 to May 31 the glacier activities don't run and the route is adjusted; our team confirms the route for your date.",
      "Pack an extra warm layer for the Columbia Icefield.",
      "Wildlife sightings are possible but can't be guaranteed.",
    ],
    winterRouteToBeConfirmed: true,
  },
};

// ---------------------------------------------------------------------------------------------
// Private multi-day journeys: each day has its own itinerary (owner's specification, pages 36–40
// and 41–45). Booked as one private day tour per day (backend package-booking.ts PACKAGES), so the
// booking PDF takes the day's itinerary from here, not from the day tour's.

export interface PackageStop {
  name: string;
  desc: string;
  isOptional?: boolean;
}

export interface PackageDay {
  dayNumber: number;
  title: string;
  stops: PackageStop[];
  closing: string;
}

export const PACKAGE_ITINERARIES: Record<"three-day-rockies-discovery" | "four-day-rockies-and-jasper", PackageDay[]> = {
  "three-day-rockies-discovery": [
    {
      dayNumber: 1,
      title: "Day 1 — Banff’s Lakes, Viewpoints & Mountain Scenery",
      stops: [
        { name: "Bow Falls", desc: "See the Bow River tumble over a broad cascade, framed by forest and mountain scenery." },
        { name: "Surprise Corner", desc: "Enjoy a classic viewpoint overlooking the Fairmont Banff Springs hotel above the Bow River." },
        { name: "Hoodoos Trail Viewpoint", desc: "Discover distinctive rock formations and views across the Bow Valley. Enjoy a short walk suited to your group’s interests and ability." },
        { name: "Lake Minnewanka", desc: "Take in the wide waters and mountain backdrop of one of Banff’s best-known lakes." },
        { name: "Two Jack Lake", desc: "Pause beside a peaceful lake with beautiful reflections and views toward Mount Rundle." },
        { name: "Cascade Ponds", desc: "Enjoy a gentle scenic stop among ponds, footbridges and surrounding peaks." },
        { name: "Johnston Canyon", desc: "Follow the canyon’s paths and elevated walkways toward the Lower Falls, conditions permitting. Walking can be adjusted to your group’s comfort." },
        { name: "Banff Gondola — Optional Add-On", desc: "Choose a gondola ride up Sulphur Mountain for panoramic views over Banff and its surrounding ranges. Admission costs extra.", isOptional: true },
        { name: "Lunch in Banff Town", desc: "Enjoy a lunch break with a choice of cafés and restaurants. Meals are purchased separately." },
      ],
      closing: "Return to your accommodation after the day’s sightseeing.",
    },
    {
      dayNumber: 2,
      title: "Day 2 — Lake Louise, Moraine Lake & Yoho",
      stops: [
        { name: "Moraine Lake — Seasonal Access", desc: "Discover the vivid waters and dramatic peaks of the Valley of the Ten Peaks. Enjoy lakeside views and photo opportunities, with transportation arranged as part of your tour." },
        { name: "Lake Louise", desc: "Spend time beside the famous lake, framed by mountain slopes and the distant Victoria Glacier." },
        { name: "Emerald Lake", desc: "Explore the shoreline of this beautiful Yoho lake, surrounded by forest and towering mountains." },
        { name: "Natural Bridge", desc: "See the Kicking Horse River rush through a striking rock formation shaped by moving water." },
        { name: "Takakkaw Falls — Seasonal Access", desc: "Travel into Yoho Valley to admire a dramatic waterfall descending from high above the valley floor." },
        { name: "Spiral Tunnels Viewpoint — When Accessible", desc: "Learn how railway engineers tackled the steep mountain terrain. A passing train may offer a chance to see the tunnels in action, although train sightings are not guaranteed." },
        { name: "Bow Valley Parkway — Scenic Drive", desc: "Enjoy forest, mountain and valley scenery along this quieter route, where road access permits." },
        { name: "Lunch in Lake Louise Village", desc: "Stop in the village to purchase lunch before continuing your sightseeing." },
      ],
      closing: "Return to your accommodation after the tour.",
    },
    {
      dayNumber: 3,
      title: "Day 3 — Icefields Parkway & Columbia Icefield",
      stops: [
        { name: "Bow Lake", desc: "Pause beside a glacier-fed lake surrounded by dramatic peaks and alpine scenery." },
        { name: "Peyto Lake", desc: "Take a short uphill walk to the viewpoint overlooking Peyto Lake and its distinctive outline." },
        { name: "Crowfoot Glacier Lookout", desc: "View the glacier from a roadside lookout and hear how the landscape has changed over time." },
        { name: "Waterfowl Lakes", desc: "Enjoy a scenic photo stop overlooking mountain-framed waters along the parkway." },
        { name: "Big Bend Viewpoint", desc: "Take in sweeping views of the valley and the famous curve of the Icefields Parkway." },
        { name: "Athabasca Glacier & Columbia Icefield Area", desc: "Discover the scale of the glacier landscape and learn about the icefield that shapes this region. Travelling onto the glacier requires the optional Ice Explorer experience." },
        { name: "Ice Explorer — Optional Add-On", desc: "Travel aboard a specialised vehicle onto the Athabasca Glacier, with an opportunity to step onto the ice under the attraction operator’s supervision. Admission costs extra.", isOptional: true },
        { name: "Columbia Icefield Skywalk — Optional Add-On", desc: "Experience a glass-floored walkway overlooking the Sunwapta Valley. Admission costs extra.", isOptional: true },
        { name: "Lunch at the Columbia Icefield Centre", desc: "Purchase lunch at the centre during your visit." },
      ],
      closing: "Return to your accommodation in Banff, Canmore or Lake Louise.",
    },
  ],
  "four-day-rockies-and-jasper": [
    {
      dayNumber: 1,
      title: "Day 1 — Discover Banff",
      stops: [
        { name: "Bow Falls", desc: "Enjoy views of the Bow River cascading through a scenic setting close to Banff town." },
        { name: "Surprise Corner", desc: "Photograph the Fairmont Banff Springs hotel from a viewpoint above the river." },
        { name: "Hoodoos Trail Viewpoint", desc: "Discover unusual rock formations and broad views across the Bow Valley." },
        { name: "Lake Minnewanka", desc: "Spend time beside an expansive lake surrounded by rugged mountain scenery." },
        { name: "Two Jack Lake", desc: "Enjoy a peaceful lakeside stop and opportunities to photograph the surrounding peaks." },
        { name: "Cascade Ponds", desc: "Pause among calm ponds and footbridges beneath Cascade Mountain." },
        { name: "Johnston Canyon", desc: "Explore canyon paths and walkways toward the Lower Falls, with the walk adapted to conditions and your group’s ability." },
        { name: "Banff Gondola — Optional Add-On", desc: "Ride to Sulphur Mountain’s summit area for sweeping views across Banff and the surrounding ranges. Admission costs extra.", isOptional: true },
        { name: "Lunch in Banff Town", desc: "Choose from local cafés and restaurants. Lunch is purchased separately." },
      ],
      closing: "Return to your accommodation in Banff, Canmore or Lake Louise.",
    },
    {
      dayNumber: 2,
      title: "Day 2 — Iconic Lakes & Yoho",
      stops: [
        { name: "Moraine Lake — Seasonal Access", desc: "Visit the lake beneath the Valley of the Ten Peaks, with access transportation arranged by Vista Chase." },
        { name: "Lake Louise", desc: "Enjoy the lakeshore and its memorable mountain-and-glacier backdrop." },
        { name: "Emerald Lake", desc: "Discover one of Yoho’s signature landscapes, with time for lakeside views and photographs." },
        { name: "Natural Bridge", desc: "Watch the Kicking Horse River surge through sculpted rock channels." },
        { name: "Takakkaw Falls — Seasonal Access", desc: "Admire a towering waterfall in Yoho Valley, subject to road access and conditions." },
        { name: "Spiral Tunnels Viewpoint — When Accessible", desc: "Hear the story of this mountain railway engineering achievement. Train sightings depend on railway movements." },
        { name: "Bow Valley Parkway — Scenic Drive", desc: "Travel through forested mountain scenery where the route is open and practical for the day." },
        { name: "Lunch in Lake Louise Village", desc: "Stop to purchase lunch during the day’s exploration." },
      ],
      closing: "Return to your accommodation. Prepare your luggage for the following morning’s departure to Jasper.",
    },
    {
      dayNumber: 3,
      title: "Day 3 — Icefields Parkway to Jasper",
      stops: [
        { name: "Bow Lake", desc: "Begin your parkway sightseeing beside a glacier-fed lake framed by mountain peaks." },
        { name: "Peyto Lake", desc: "Walk to the viewpoint for a striking view of the lake and surrounding valley." },
        { name: "Crowfoot Glacier Lookout", desc: "Stop for glacier views and an introduction to the changing mountain landscape." },
        { name: "Waterfowl Lakes", desc: "Enjoy a scenic pause beside the parkway’s mountain-framed lakes." },
        { name: "Big Bend Viewpoint", desc: "Look across a sweeping valley and the parkway’s dramatic mountain curves." },
        { name: "Athabasca Glacier & Columbia Icefield Area", desc: "Discover one of the journey’s most impressive glacier landscapes. Glacier travel is available through the optional Ice Explorer." },
        { name: "Ice Explorer — Optional Add-On", desc: "Board a specialised glacier vehicle for an organised visit onto the Athabasca Glacier. Admission costs extra.", isOptional: true },
        { name: "Columbia Icefield Skywalk — Optional Add-On", desc: "Step onto a glass-floored walkway with views into the Sunwapta Valley. Admission costs extra.", isOptional: true },
        { name: "Lunch at the Columbia Icefield Centre", desc: "Purchase lunch before continuing north." },
        { name: "Continue to Jasper", desc: "Travel onward through Jasper National Park and finish at your booked accommodation in Jasper town." },
      ],
      closing: "Overnight: Jasper. Accommodation must be booked directly by guests and is not included.",
    },
    {
      dayNumber: 4,
      title: "Day 4 — Maligne Valley, Waterfalls & Your Return Journey",
      stops: [
        { name: "Medicine Lake", desc: "Pause beside a lake known for its changing water levels and mountain setting." },
        { name: "Maligne Lake", desc: "Discover the lakeshore and surrounding peaks, with time to appreciate one of Jasper’s signature landscapes." },
        {
          name: "Maligne Lake Cruise toward Spirit Island — Optional Add-On",
          desc: "Choose a scenic cruise with views of Spirit Island and the surrounding mountains. Tickets cost extra and are subject to seasonal operation and availability. Spirit Island views are part of the cruise experience, rather than the standard lakeshore stop.",
          isOptional: true,
        },
        { name: "Maligne Canyon — Only If Reopened", desc: "If officially reopened and safe to visit for your departure, explore the canyon’s dramatic limestone scenery. While closed, it is excluded and your guide will adjust the day’s sightseeing." },
        { name: "Lunch in Jasper Town", desc: "Enjoy a break to purchase lunch before travelling south." },
        { name: "Athabasca Falls", desc: "See the powerful Athabasca River rush through a narrow rocky gorge, with viewing paths and photo opportunities." },
        { name: "Sunwapta Falls", desc: "Pause at a striking waterfall surrounded by forest and mountain scenery." },
        { name: "Return Along the Icefields Parkway", desc: "Continue south to your prearranged final destination: Banff, Lake Louise, Canmore or Calgary." },
      ],
      closing:
        "Day four includes substantial driving, especially for a Calgary finish. Departure time, attraction reservations and sightseeing stops will be coordinated around your final destination. Discuss any same-day flight with us before booking it.",
    },
  ],
};
