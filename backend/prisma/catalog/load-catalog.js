// Turns the imported live-site catalog (products.json, written by
// scripts/import_webflow_catalog.py) into Prisma Tour rows.
const products = require("./products.json");

// Live fleet: a 6-seat Cadillac and 12–13-seat vans. Private tours are sold per vehicle.
const PRIVATE_VEHICLES = [
  { id: "suv", label: "Luxury SUV", seats: 6 },
  { id: "van", label: "Executive van", seats: 13 },
];

// Order products appear in on listing pages (live site order).
const FEATURED = new Set([
  "banff-highlights-tour",
  "banff-private-tour",
  "icefields-jasper-private-tour",
  "sunrise-shuttle-to-moraine-lake-and-lake-louise",
  "multi-day-tour-package-for-banff",
]);

function fact(product, pattern) {
  const found = product.facts.find((f) => pattern.test(f.label));
  return found ? found.value : "";
}

/** "9-11 hours" → 10, "2-7 Days" → 48, "3 hours" → 3 */
function durationHours(product) {
  const text = fact(product, /duration/i);
  const nums = (text.match(/\d+(\.\d+)?/g) || []).map(Number);
  if (nums.length === 0) return 8;
  const value = nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0];
  return /day/i.test(text) ? Math.round(nums[0] * 24) : value;
}

/** Largest group the page advertises ("max 12 people", "Max 6 or 13 each group"). */
function maxGroupSize(product) {
  const text = product.facts.map((f) => `${f.label} ${f.value}`).join(" ");
  const match = text.match(/max[^\d]*(\d+)(?:\s*or\s*(\d+))?/i);
  if (!match) return product.category === "SHUTTLE" ? 14 : 12;
  return Number(match[2] || match[1]);
}

// Pages whose sights aren't a list of named stops.
const HIGHLIGHTS = {
  "sunrise-shuttle-to-moraine-lake-and-lake-louise": ["Moraine Lake at sunrise", "Lake Louise in the morning"],
  "full-day-at-lake-louise-and-moraine-lake": [
    "Lake Louise (4 hours)",
    "Moraine Lake (3 hours)",
    "Lake Agnes Tea House hike",
    "Rockpile Trail",
  ],
  "multi-day-tour-package-for-banff": ["Banff", "Yoho", "Jasper", "Kootenay", "Waterton"],
};

/** Short stop names ("Bow Falls — Banff’s Roaring Gateway" → "Bow Falls") for cards and search. */
function highlights(product) {
  if (HIGHLIGHTS[product.slug]) return HIGHLIGHTS[product.slug];
  return product.stops.map((s) => s.name.split(/\s*[—–:]\s+/)[0]).slice(0, 6);
}

function toTourData(product, index, destinationIds) {
  const isVehicle = product.category === "PRIVATE" || product.category === "MULTIDAY";
  const [featuredImage, ...gallery] = product.images;
  return {
    slug: product.slug,
    title: product.title,
    category: product.category,
    durationHours: durationHours(product),
    summary: product.metaDescription || product.title,
    description: product.overview ? product.overview.paragraphs.join("\n\n") : "",
    inclusions: JSON.stringify(product.includes),
    exclusions: JSON.stringify(product.excludes),
    highlights: JSON.stringify(highlights(product)),
    whatToBring: JSON.stringify([]),
    featuredImage: featuredImage || "",
    galleryImages: JSON.stringify(gallery),
    basePrice: product.priceFrom || 0,
    currency: "CAD",
    minGroupSize: 1,
    maxGroupSize: maxGroupSize(product),
    isFeatured: FEATURED.has(product.slug),
    rating: product.rating || 5,
    reviewCount: product.reviewCountLabel ? parseInt(product.reviewCountLabel.replace(/\D/g, ""), 10) : 0,
    bokunExperienceId: product.bokunExperienceId,
    bookingMode: product.bookingMode,
    priceUnit: product.priceUnit === "group" ? "GROUP" : "PERSON",
    facts: JSON.stringify(product.facts),
    tabs: JSON.stringify(product.tabs),
    faqs: JSON.stringify(product.faqs),
    crossSells: JSON.stringify(product.crossSells),
    vehicleOptions: JSON.stringify(isVehicle ? PRIVATE_VEHICLES : []),
    sortOrder: index,
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    destinationId: destinationIds[product.destination],
  };
}

module.exports = { products, toTourData, PRIVATE_VEHICLES };
