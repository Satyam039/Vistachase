// Starter content for the SEO dashboard, built from Vista Chase's own catalogue (tours, shuttles,
// tickets and destination pages that exist today). Insert-only and idempotent: it never edits or
// removes anything staff have changed.
//
// Every keyword here is a hypothesis: volume and difficulty are null ("unknown") and validation is
// UNVERIFIED. Where the Banff Elite reference sheet listed a generic place name, the note says so
// as an unverified lead; its figures are never copied into Vista Chase records.
// Not seeded on purpose: services Vista Chase doesn't sell today (Calgary airport transfers,
// chauffeur and corporate transport, helicopter tours, weddings, honeymoon packages).

import prisma from "@/lib/db/prisma";
import { normalizeKeyword } from "@/modules/seo/paths";
import { syncPages } from "@/modules/seo/seo.pages";

type Track = "TRAFFIC_ACQUISITION" | "BOOKING_CONVERSION";
type Intent = "INFORMATIONAL" | "COMMERCIAL" | "TRANSACTIONAL" | "NAVIGATIONAL";
type Funnel = "TOFU" | "MOFU" | "BOFU";
type PageType = "HOME" | "TOUR" | "DESTINATION" | "LANDING" | "GUIDE";

interface StarterCluster {
  name: string;
  track: Track;
  pillar: string;
  hubPath: string;
  description: string;
}

export const STARTER_CLUSTERS: StarterCluster[] = [
  { name: "Brand", track: "BOOKING_CONVERSION", pillar: "Brand", hubPath: "/", description: "People searching for Vista Chase by name." },
  { name: "Banff small-group tours", track: "BOOKING_CONVERSION", pillar: "Tours", hubPath: "/shared-tours", description: "Shared day tours from Banff and Canmore with hotel pickup." },
  { name: "Banff private tours", track: "BOOKING_CONVERSION", pillar: "Tours", hubPath: "/private-tours", description: "Private vehicle tours and customisable itineraries." },
  { name: "Moraine Lake & Lake Louise shuttles", track: "BOOKING_CONVERSION", pillar: "Shuttles", hubPath: "/shuttles", description: "Sunrise and day shuttles; Moraine Lake road is closed to private vehicles." },
  { name: "Icefields Parkway & Jasper tours", track: "BOOKING_CONVERSION", pillar: "Tours", hubPath: "/shared-tours-icefields-jasper", description: "Shared and private tours along the Icefields Parkway to Jasper." },
  { name: "Yoho & Emerald Lake tours", track: "BOOKING_CONVERSION", pillar: "Tours", hubPath: "/shared-tours-banff-yoho", description: "Banff + Yoho tours (Emerald Lake, Natural Bridge)." },
  { name: "Winter tours", track: "BOOKING_CONVERSION", pillar: "Tours", hubPath: "/winter-special", description: "Winter shared and private tours." },
  { name: "Multi-day Rockies trips", track: "BOOKING_CONVERSION", pillar: "Tours", hubPath: "/multi-day-tour-package-for-banff", description: "Multi-day Canadian Rockies packages (request a date)." },
  { name: "Banff attraction tickets", track: "BOOKING_CONVERSION", pillar: "Tickets", hubPath: "/banff-activity-tickets", description: "Gondola, cruise and Icefield tickets sold by enquiry." },
  { name: "Moraine Lake guide", track: "TRAFFIC_ACQUISITION", pillar: "Destinations", hubPath: "/destinations/moraine-lake", description: "Visiting Moraine Lake: access, timing, what to expect." },
  { name: "Lake Louise guide", track: "TRAFFIC_ACQUISITION", pillar: "Destinations", hubPath: "/destinations/lake-louise", description: "Visiting Lake Louise: parking, shuttles, sights." },
  { name: "Banff National Park planning", track: "TRAFFIC_ACQUISITION", pillar: "Destinations", hubPath: "/destinations/banff-national-park", description: "Planning a trip to Banff National Park." },
  { name: "Johnston Canyon", track: "TRAFFIC_ACQUISITION", pillar: "Destinations", hubPath: "/guides/johnston-canyon", description: "A stop on the Banff highlights tour; planned guide." },
  { name: "Icefields Parkway & Columbia Icefield", track: "TRAFFIC_ACQUISITION", pillar: "Destinations", hubPath: "/guides/icefields-parkway", description: "The drive and its stops; planned guide." },
  { name: "Seasonal trip planning", track: "TRAFFIC_ACQUISITION", pillar: "Planning", hubPath: "/guides/best-time-to-visit-banff", description: "When to go and what each season offers; planned guide." },
];

interface StarterKeyword {
  keyword: string;
  cluster: string;
  intent: Intent;
  funnel: Funnel;
  path: string;
  pageType: PageType;
  primary?: boolean;
  priority: "HIGH" | "MEDIUM" | "LOW";
  relevance: number;
  note?: string;
}

const ref = (_volume: string, _kd: string) => `Hypothesis: Banff Elite's reference sheet lists this term. Its volume and difficulty belong to that sheet, not Vista Chase, and are not copied here; research it in a keyword tool before relying on it.`;

export const STARTER_KEYWORDS: StarterKeyword[] = [
  // Brand
  { keyword: "vista chase", cluster: "Brand", intent: "NAVIGATIONAL", funnel: "BOFU", path: "/", pageType: "HOME", primary: true, priority: "HIGH", relevance: 5 },
  { keyword: "vista chase banff", cluster: "Brand", intent: "NAVIGATIONAL", funnel: "BOFU", path: "/", pageType: "HOME", priority: "MEDIUM", relevance: 5 },
  // Booking conversion
  { keyword: "banff tours", cluster: "Banff small-group tours", intent: "COMMERCIAL", funnel: "MOFU", path: "/", pageType: "HOME", primary: true, priority: "HIGH", relevance: 5, note: "Broad; the home page targets it so /shared-tours and /private-tours don't compete for it." },
  { keyword: "small group tours banff", cluster: "Banff small-group tours", intent: "COMMERCIAL", funnel: "BOFU", path: "/shared-tours", pageType: "LANDING", primary: true, priority: "HIGH", relevance: 5 },
  { keyword: "banff day tour", cluster: "Banff small-group tours", intent: "COMMERCIAL", funnel: "BOFU", path: "/shared-tours", pageType: "LANDING", priority: "HIGH", relevance: 5 },
  { keyword: "banff highlights tour", cluster: "Banff small-group tours", intent: "TRANSACTIONAL", funnel: "BOFU", path: "/banff-highlights-tour", pageType: "TOUR", primary: true, priority: "HIGH", relevance: 5 },
  { keyword: "banff sightseeing tour", cluster: "Banff small-group tours", intent: "COMMERCIAL", funnel: "BOFU", path: "/banff-highlights-tour", pageType: "TOUR", priority: "MEDIUM", relevance: 4 },
  { keyword: "johnston canyon tour", cluster: "Banff small-group tours", intent: "COMMERCIAL", funnel: "BOFU", path: "/banff-highlights-tour", pageType: "TOUR", priority: "MEDIUM", relevance: 4, note: "The highlights tour stops at Johnston Canyon (tour FAQ)." },
  { keyword: "banff private tours", cluster: "Banff private tours", intent: "COMMERCIAL", funnel: "BOFU", path: "/private-tours", pageType: "LANDING", primary: true, priority: "HIGH", relevance: 5, note: ref("90", "20") },
  { keyword: "private tour banff national park", cluster: "Banff private tours", intent: "TRANSACTIONAL", funnel: "BOFU", path: "/banff-private-tour", pageType: "TOUR", primary: true, priority: "HIGH", relevance: 5 },
  { keyword: "private guide banff", cluster: "Banff private tours", intent: "COMMERCIAL", funnel: "BOFU", path: "/private-tours", pageType: "LANDING", priority: "MEDIUM", relevance: 4 },
  { keyword: "canadian rockies private tour", cluster: "Banff private tours", intent: "COMMERCIAL", funnel: "BOFU", path: "/private-tours", pageType: "LANDING", priority: "MEDIUM", relevance: 4 },
  { keyword: "custom banff itinerary private tour", cluster: "Banff private tours", intent: "TRANSACTIONAL", funnel: "BOFU", path: "/banff-yoho-custom-private-tour", pageType: "TOUR", primary: true, priority: "MEDIUM", relevance: 4 },
  { keyword: "moraine lake shuttle", cluster: "Moraine Lake & Lake Louise shuttles", intent: "TRANSACTIONAL", funnel: "BOFU", path: "/shuttles", pageType: "LANDING", primary: true, priority: "HIGH", relevance: 5, note: ref("9,900", "44") },
  { keyword: "lake louise shuttle", cluster: "Moraine Lake & Lake Louise shuttles", intent: "TRANSACTIONAL", funnel: "BOFU", path: "/shuttles", pageType: "LANDING", priority: "HIGH", relevance: 5 },
  { keyword: "moraine lake sunrise shuttle", cluster: "Moraine Lake & Lake Louise shuttles", intent: "TRANSACTIONAL", funnel: "BOFU", path: "/sunrise-shuttle-to-moraine-lake-and-lake-louise", pageType: "TOUR", primary: true, priority: "HIGH", relevance: 5 },
  { keyword: "moraine lake sunrise tour", cluster: "Moraine Lake & Lake Louise shuttles", intent: "COMMERCIAL", funnel: "BOFU", path: "/sunrise-shuttle-to-moraine-lake-and-lake-louise", pageType: "TOUR", priority: "MEDIUM", relevance: 4 },
  { keyword: "shuttle from banff to lake louise", cluster: "Moraine Lake & Lake Louise shuttles", intent: "TRANSACTIONAL", funnel: "BOFU", path: "/full-day-at-lake-louise-and-moraine-lake", pageType: "TOUR", primary: true, priority: "HIGH", relevance: 5 },
  { keyword: "icefields parkway tour", cluster: "Icefields Parkway & Jasper tours", intent: "COMMERCIAL", funnel: "BOFU", path: "/shared-tours-icefields-jasper", pageType: "TOUR", primary: true, priority: "HIGH", relevance: 5 },
  { keyword: "jasper day trip from banff", cluster: "Icefields Parkway & Jasper tours", intent: "COMMERCIAL", funnel: "BOFU", path: "/shared-tours-icefields-jasper", pageType: "TOUR", priority: "MEDIUM", relevance: 4 },
  { keyword: "columbia icefield tour from banff", cluster: "Icefields Parkway & Jasper tours", intent: "TRANSACTIONAL", funnel: "BOFU", path: "/shared-tours-icefields-jasper", pageType: "TOUR", priority: "MEDIUM", relevance: 4, note: "Check the tour's itinerary names the Columbia Icefield stop before optimising for this." },
  { keyword: "private tour jasper national park", cluster: "Icefields Parkway & Jasper tours", intent: "TRANSACTIONAL", funnel: "BOFU", path: "/icefields-jasper-private-tour", pageType: "TOUR", primary: true, priority: "MEDIUM", relevance: 4 },
  { keyword: "emerald lake tour from banff", cluster: "Yoho & Emerald Lake tours", intent: "COMMERCIAL", funnel: "BOFU", path: "/shared-tours-banff-yoho", pageType: "TOUR", primary: true, priority: "MEDIUM", relevance: 4 },
  { keyword: "yoho national park tour", cluster: "Yoho & Emerald Lake tours", intent: "COMMERCIAL", funnel: "BOFU", path: "/shared-tours-banff-yoho", pageType: "TOUR", priority: "MEDIUM", relevance: 4 },
  { keyword: "banff winter tours", cluster: "Winter tours", intent: "COMMERCIAL", funnel: "BOFU", path: "/winter-special", pageType: "TOUR", primary: true, priority: "MEDIUM", relevance: 4 },
  { keyword: "private winter tour banff", cluster: "Winter tours", intent: "TRANSACTIONAL", funnel: "BOFU", path: "/winter-signature-private-tour", pageType: "TOUR", primary: true, priority: "LOW", relevance: 3 },
  { keyword: "multi day canadian rockies tour", cluster: "Multi-day Rockies trips", intent: "COMMERCIAL", funnel: "BOFU", path: "/multi-day-tour-package-for-banff", pageType: "TOUR", primary: true, priority: "MEDIUM", relevance: 4 },
  { keyword: "banff tour package", cluster: "Multi-day Rockies trips", intent: "COMMERCIAL", funnel: "MOFU", path: "/multi-day-tour-package-for-banff", pageType: "TOUR", priority: "LOW", relevance: 3 },
  { keyword: "banff gondola tickets", cluster: "Banff attraction tickets", intent: "TRANSACTIONAL", funnel: "BOFU", path: "/banff-gondola-tickets", pageType: "TOUR", primary: true, priority: "MEDIUM", relevance: 3, note: `${ref("14,800", "56")} Tickets are sold by enquiry, and the operator's own site will usually rank first.` },
  { keyword: "lake minnewanka cruise tickets", cluster: "Banff attraction tickets", intent: "TRANSACTIONAL", funnel: "BOFU", path: "/lake-minnewanka-cruise-tickets", pageType: "TOUR", primary: true, priority: "LOW", relevance: 3 },
  { keyword: "columbia icefield skywalk tickets", cluster: "Banff attraction tickets", intent: "TRANSACTIONAL", funnel: "BOFU", path: "/columbia-icefield-skywalk-tickets", pageType: "TOUR", primary: true, priority: "LOW", relevance: 3 },
  // Traffic acquisition
  { keyword: "moraine lake", cluster: "Moraine Lake guide", intent: "INFORMATIONAL", funnel: "TOFU", path: "/destinations/moraine-lake", pageType: "DESTINATION", primary: true, priority: "HIGH", relevance: 5, note: ref("27,100", "60") },
  { keyword: "how to get to moraine lake", cluster: "Moraine Lake guide", intent: "INFORMATIONAL", funnel: "TOFU", path: "/destinations/moraine-lake", pageType: "DESTINATION", priority: "HIGH", relevance: 5, note: "Answer with current Parks Canada access rules, then link to the shuttles." },
  { keyword: "moraine lake parking", cluster: "Moraine Lake guide", intent: "INFORMATIONAL", funnel: "TOFU", path: "/destinations/moraine-lake", pageType: "DESTINATION", priority: "MEDIUM", relevance: 4, note: "The road is closed to private vehicles; keep the page accurate to Parks Canada." },
  { keyword: "best time to visit moraine lake", cluster: "Moraine Lake guide", intent: "INFORMATIONAL", funnel: "TOFU", path: "/destinations/moraine-lake", pageType: "DESTINATION", priority: "MEDIUM", relevance: 4, note: ref("70", "26") },
  { keyword: "lake louise", cluster: "Lake Louise guide", intent: "INFORMATIONAL", funnel: "TOFU", path: "/destinations/lake-louise", pageType: "DESTINATION", primary: true, priority: "HIGH", relevance: 5, note: ref("74,000", "83") },
  { keyword: "lake louise parking", cluster: "Lake Louise guide", intent: "INFORMATIONAL", funnel: "TOFU", path: "/destinations/lake-louise", pageType: "DESTINATION", priority: "MEDIUM", relevance: 4, note: ref("3,600", "33") },
  { keyword: "lake louise to moraine lake", cluster: "Lake Louise guide", intent: "INFORMATIONAL", funnel: "TOFU", path: "/destinations/lake-louise", pageType: "DESTINATION", priority: "MEDIUM", relevance: 4, note: ref("1,600", "36") },
  { keyword: "banff national park", cluster: "Banff National Park planning", intent: "INFORMATIONAL", funnel: "TOFU", path: "/destinations/banff-national-park", pageType: "DESTINATION", primary: true, priority: "HIGH", relevance: 4, note: ref("33,100", "73") },
  { keyword: "banff national park pass", cluster: "Banff National Park planning", intent: "INFORMATIONAL", funnel: "TOFU", path: "/destinations/banff-national-park", pageType: "DESTINATION", priority: "LOW", relevance: 3, note: ref("2,900", "32") },
  { keyword: "things to do in banff", cluster: "Banff National Park planning", intent: "INFORMATIONAL", funnel: "TOFU", path: "/guides/things-to-do-in-banff", pageType: "GUIDE", primary: true, priority: "HIGH", relevance: 4, note: ref("6,600", "28") },
  { keyword: "banff itinerary", cluster: "Banff National Park planning", intent: "INFORMATIONAL", funnel: "TOFU", path: "/guides/banff-itinerary", pageType: "GUIDE", primary: true, priority: "MEDIUM", relevance: 4 },
  { keyword: "johnston canyon", cluster: "Johnston Canyon", intent: "INFORMATIONAL", funnel: "TOFU", path: "/guides/johnston-canyon", pageType: "GUIDE", primary: true, priority: "MEDIUM", relevance: 3, note: ref("22,200", "51") },
  { keyword: "icefields parkway", cluster: "Icefields Parkway & Columbia Icefield", intent: "INFORMATIONAL", funnel: "TOFU", path: "/guides/icefields-parkway", pageType: "GUIDE", primary: true, priority: "MEDIUM", relevance: 4 },
  { keyword: "columbia icefield", cluster: "Icefields Parkway & Columbia Icefield", intent: "INFORMATIONAL", funnel: "TOFU", path: "/guides/icefields-parkway", pageType: "GUIDE", priority: "LOW", relevance: 3, note: ref("9,900", "57") },
  { keyword: "peyto lake", cluster: "Icefields Parkway & Columbia Icefield", intent: "INFORMATIONAL", funnel: "TOFU", path: "/guides/icefields-parkway", pageType: "GUIDE", priority: "LOW", relevance: 3 },
  { keyword: "best time to visit banff", cluster: "Seasonal trip planning", intent: "INFORMATIONAL", funnel: "TOFU", path: "/guides/best-time-to-visit-banff", pageType: "GUIDE", primary: true, priority: "MEDIUM", relevance: 4 },
  { keyword: "banff in winter", cluster: "Seasonal trip planning", intent: "INFORMATIONAL", funnel: "TOFU", path: "/guides/best-time-to-visit-banff", pageType: "GUIDE", priority: "LOW", relevance: 3 },
];

const STARTER_SOURCE = "Hypothesis from the Vista Chase catalogue review (2026-10-13)";

/**
 * Syncs pages, then adds the starter clusters and keywords that don't exist yet, maps them to the
 * pages that exist, and fills an empty focus keyword from each page's primary keyword. Also
 * prepares llms.txt (switched off) when it has never been set up.
 */
export async function bootstrapSeo(userId?: string) {
  const pages = await syncPages(userId);

  const clusterIds = new Map((await prisma.seoKeywordCluster.findMany({ select: { id: true, name: true } })).map((c) => [c.name, c.id]));
  let clustersAdded = 0;
  for (const c of STARTER_CLUSTERS) {
    if (clusterIds.has(c.name)) continue;
    const created = await prisma.seoKeywordCluster.create({ data: c });
    clusterIds.set(c.name, created.id);
    clustersAdded++;
  }

  const pageByPath = new Map((await prisma.seoPage.findMany({ select: { id: true, path: true, focusKeyword: true } })).map((p) => [p.path, p]));
  let keywordsAdded = 0;
  let mappingsAdded = 0;
  for (const k of STARTER_KEYWORDS) {
    const normalized = normalizeKeyword(k.keyword);
    if (await prisma.seoKeyword.findUnique({ where: { normalized } })) continue;
    const page = pageByPath.get(k.path);
    const created = await prisma.seoKeyword.create({
      data: {
        keyword: k.keyword,
        normalized,
        designation: k.primary ? "PRIMARY" : "SECONDARY",
        intent: k.intent,
        funnelStage: k.funnel,
        track: STARTER_CLUSTERS.find((c) => c.name === k.cluster)!.track,
        clusterId: clusterIds.get(k.cluster) ?? null,
        targetPath: k.path,
        targetPageType: k.pageType,
        priority: k.priority,
        businessRelevance: k.relevance,
        status: page ? "PLANNED" : "IDEA",
        dataSource: STARTER_SOURCE,
        validationStatus: "UNVERIFIED",
        notes: k.note ?? (page ? null : `Planned page: ${k.path} doesn't exist yet. Create it as a guide only with enough original content to stand on its own.`),
        createdById: userId,
      },
    });
    keywordsAdded++;
    if (page) {
      await prisma.seoKeywordMapping.create({ data: { keywordId: created.id, pageId: page.id, role: k.primary ? "PRIMARY" : "SECONDARY" } });
      mappingsAdded++;
      if (k.primary && k.intent !== "NAVIGATIONAL" && !page.focusKeyword) {
        await prisma.seoPage.update({ where: { id: page.id }, data: { focusKeyword: k.keyword } });
        page.focusKeyword = k.keyword;
      }
    }
  }

  let llmsPrepared = false;
  if (!(await prisma.seoSiteSettings.findUnique({ where: { id: "site" } }))) {
    await prisma.seoSiteSettings.create({
      data: {
        id: "site",
        siteName: "Vista Chase",
        summary: "Vista Chase runs small-group and private tours and shuttles in Banff National Park and the Canadian Rockies, with hotel pickup in Banff, Canmore and Lake Louise.",
        contactPhone: "+1-825-734-9456",
        address: "121 Bow Meadows Crescent #110, Canmore, AB T1W 2W8, Canada",
        serviceArea: ["Banff National Park", "Lake Louise", "Moraine Lake", "Canmore", "Yoho National Park", "Icefields Parkway", "Jasper National Park"],
        llmsEnabled: false,
        updatedById: userId,
      },
    });
    await prisma.seoLlmsEntry.createMany({
      data: [
        { title: "Private tours", path: "/private-tours", description: "Private vehicle tours of Banff, Yoho and Jasper national parks.", section: "PRIMARY", sortOrder: 0 },
        { title: "Shared tours", path: "/shared-tours", description: "Small-group day tours with hotel pickup.", section: "PRIMARY", sortOrder: 1 },
        { title: "Moraine Lake & Lake Louise shuttles", path: "/shuttles", description: "Sunrise and day shuttles to Moraine Lake and Lake Louise.", section: "PRIMARY", sortOrder: 2 },
        { title: "Destinations", path: "/destinations", description: "The places our tours visit.", section: "PRIMARY", sortOrder: 3 },
        { title: "Contact us", path: "/contact-us", description: "Questions, groups and custom trips.", section: "PRIMARY", sortOrder: 4 },
        { title: "FAQ", path: "/faq", description: "Booking, pickup, cancellation and park access answers.", section: "SECONDARY", sortOrder: 0 },
        { title: "Cancellation policy", path: "/privacy-policy-vista-chase", section: "SECONDARY", sortOrder: 1 },
        { title: "About us", path: "/about-us", section: "SECONDARY", sortOrder: 2 },
      ],
    });
    llmsPrepared = true;
  }

  return { pagesAdded: pages.added, clustersAdded, keywordsAdded, mappingsAdded, llmsPrepared };
}
