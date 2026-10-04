// Turns the imported live-site catalog (products.json, written by
// scripts/import_webflow_catalog.py) into Prisma Tour rows.
//
// Images: every image is served by the backend from media/ (scripts/media/build-media.mjs).
// A product keeps the photos its live page used (mapped from their Webflow URLs to the local
// copies), then gets more photos from the Vista Chase photo library that show the places the
// product visits (product-map.json "places"), in the right season.
const products = require("./products.json");
const productMap = require("./product-map.json");
const { assets: media } = require("../../media/manifest.json");

const mapBySlug = new Map(productMap.products.map((p) => [p.slug, p]));
const mediaById = new Map(media.map((a) => [a.id, a]));
const mediaByUrl = new Map(media.filter((a) => a.source.url).map((a) => [a.source.url, a]));

const GALLERY_SIZE = 8;

/** /media path of a media asset by id ("photos/moraine-lake-canoes"); throws if it isn't in the manifest. */
function mediaSrc(id) {
  const asset = mediaById.get(id);
  if (!asset) throw new Error(`Media asset ${id} is missing from media/manifest.json`);
  return asset.src;
}

/** File name without extension or Webflow id, for spotting the same photo in both sources. */
const stem = (name) =>
  decodeURIComponent(name.split("/").pop())
    .replace(/^[0-9a-f]{24}_/, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
const libraryByStem = new Map(
  media.filter((a) => a.collection === "photos" && a.source.file).map((a) => [stem(a.source.file), a])
);

/**
 * Local copy of an image the live site served from the Webflow CDN. When the same photo is
 * in the Vista Chase library (same file name), the library's higher-resolution copy wins.
 */
function localImage(url) {
  const asset = mediaByUrl.get(url);
  if (!asset) throw new Error(`No local copy of ${url}; rebuild media (scripts/media/build-media.mjs)`);
  return (libraryByStem.get(stem(url)) ?? asset).src;
}

/**
 * Library photos for a product: scored by how many of its places they show (earlier places
 * weigh more), preferring its season. Selfies and fleet shots are left to the pages that need them.
 */
function libraryPhotos(map) {
  const weights = new Map(map.places.map((p, i) => [p, map.places.length - i]));
  const scored = [];
  for (const asset of media) {
    if (asset.collection !== "photos" || !["landscape", "wildlife"].includes(asset.kind)) continue;
    let score = asset.places.reduce((sum, p) => sum + (weights.get(p) || 0), 0);
    if (score === 0) continue;
    const winter = asset.tags.includes("winter");
    if (map.season === "winter" && !winter) continue;
    if (map.season === "summer" && winter) continue;
    if (asset.kind === "wildlife") score -= 1;
    scored.push({ asset, score });
  }
  scored.sort((a, b) => b.score - a.score || a.asset.id.localeCompare(b.asset.id));
  // Spread across places: take the best photo for each place before seconds.
  const picked = [];
  const seenPlaces = new Set();
  for (const { asset } of scored) {
    const main = asset.places.find((p) => weights.has(p));
    if (!seenPlaces.has(main)) {
      seenPlaces.add(main);
      picked.push(asset);
    }
  }
  for (const { asset } of scored) if (!picked.includes(asset)) picked.push(asset);
  return picked.map((a) => a.src);
}

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
  const map = mapBySlug.get(product.slug);
  if (!map) throw new Error(`${product.slug} is missing from product-map.json`);
  const images = [...new Set([...product.images.map(localImage), ...libraryPhotos(map)])].slice(0, GALLERY_SIZE);
  const [featuredImage, ...gallery] = images;
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
    bokunId: map.bokunId,
    bookingMode: map.bookingMode,
    priceUnit: product.priceUnit === "group" ? "GROUP" : "PERSON",
    facts: JSON.stringify(product.facts),
    tabs: JSON.stringify(product.tabs),
    faqs: JSON.stringify(product.faqs),
    crossSells: JSON.stringify(product.crossSells),
    vehicleOptions: JSON.stringify(isVehicle ? PRIVATE_VEHICLES : []),
    sortOrder: index,
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    destinationId: destinationIds[map.destination],
  };
}

module.exports = { products, productMap, toTourData, mediaSrc, PRIVATE_VEHICLES };
