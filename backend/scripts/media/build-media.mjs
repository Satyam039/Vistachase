// Builds backend/media: every image the site uses, served by the backend at /media.
//
//   node scripts/media/build-media.mjs [--photos <dir>] [--only photos|site]
//
// 1. Photos: the business's photo library (the repo-root Images/ folder by default),
//    described in scripts/media/photo-catalog.json. Each is resized to fit 2400px and
//    saved as WebP in media/photos/<id>.webp. Entries marked "exclude" are skipped.
// 2. Live site: every image vistachase.com (Webflow) uses, listed in
//    scripts/media/live-site-images.json. Each is downloaded once and sorted into
//    media/{brand,badges,icons,site,blog}. Photos become WebP; logos, badges and
//    icons keep their PNG/SVG format.
// 3. media/manifest.json lists every file with its size, alt text, places and tags,
//    plus the original source (file name or Webflow URL) so content can be remapped.
//
// Re-running is incremental: existing outputs are reused unless --force is passed.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, "../..");
const mediaDir = path.join(backendDir, "media");
const cacheDir = path.join(backendDir, "node_modules/.cache/vistachase-media");

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const photosDir = path.resolve(arg("--photos") ?? path.join(backendDir, "../Images"));
const only = arg("--only");
const force = args.includes("--force");

const MAX_EDGE = 2048;
const ICON_MAX_EDGE = 1600;

// Readable names for live-site files whose Webflow names say nothing.
const NAME_OVERRIDES = {
  "images 4 (1)": "logo-dark",
  "images 4": "logo-white",
  "4a63d88a7f5330f9765fc90768f76f2c323f34d3": "horse-emblem-gold",
  "Horse Background Image V3": "horse-rider-background",
  "Frames": "five-stars",
  "Tripadvisor BOTB Badge + Travelers’ Choice Center Aligned Black - L": "tripadvisor-best-of-the-best-2025",
  "Tripadvisor_idSto8f0HB_1": "tripadvisor-logo",
  "klook-logo_brandlogos.net_naa2l": "klook-logo",
  "expedia-logo-png-transparent": "expedia-logo",
  "viator-seeklogo": "viator-logo",
};

// Words in live-site file names → the place tags used across the catalog.
const PLACE_WORDS = [
  [/moraine/i, ["moraine-lake", "banff"]],
  [/louise|fairview|big beehive/i, ["lake-louise", "banff"]],
  [/peyto/i, ["peyto-lake", "icefields-parkway", "banff"]],
  [/bow[- ]lake|crowfoot/i, ["bow-lake", "icefields-parkway", "banff"]],
  [/waterfawl|waterfowl|icefield/i, ["icefields-parkway"]],
  [/emerald|takakkaw|yoho|natural bridge/i, ["yoho"]],
  [/spirit|maligne/i, ["jasper", "maligne"]],
  [/jasper|athabasca/i, ["jasper"]],
  [/abraham/i, ["abraham-lake"]],
  [/three[- ]sisters|canmore/i, ["canmore"]],
  [/minnewanka/i, ["banff", "lake-minnewanka"]],
  [/prince[- ]of[- ]wales|waterton/i, ["waterton"]],
  [/gondola|sulphur|banff/i, ["banff"]],
  [/larch/i, ["banff"]],
];

const exists = (p) => fs.access(p).then(() => true, () => false);

function slugify(text) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** "68e75d2...e_Moraine-Lake-Perfect-Reflection.webp" → { name: "Moraine-Lake-Perfect-Reflection", ext: ".webp" } */
function webflowName(url) {
  const base = decodeURIComponent(url.split("?")[0].split("/").pop());
  const withoutId = base.replace(/^[0-9a-f]{24}_/, "");
  const ext = path.extname(withoutId).toLowerCase();
  return { name: withoutId.slice(0, withoutId.length - ext.length), ext };
}

function humanize(name) {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\s*\(\d+\)\s*/g, " ")
    .replace(/\b\d{3,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function classify(item, name, ext) {
  const pages = item.pages ?? [];
  if (pages.length > 0 && pages.every((p) => p === "blog")) return "blog";
  if (/^images 4|4a63d88a7f5330f9765fc|Horse Background|Horse-Rider/i.test(name)) return "brand";
  if (/tripadvisor|google logo|viator|get your guide|project-expedition|civitatis|expedia|klook|^frames$/i.test(name))
    return "badges";
  if (
    ext === ".svg" ||
    /icon|arrow|^vector|^group 1|^film|^user|^map$|briefcase|dollar-sign|^home|book-open|^watch$|checkmark|container|^close_|^title$|testimonial image|topo background|compass rose|2025-11-04T165713/i.test(
      name
    )
  )
    return "icons";
  return "site";
}

function placesFor(text) {
  const out = new Set();
  for (const [re, places] of PLACE_WORDS) if (re.test(text)) places.forEach((p) => out.add(p));
  return [...out];
}

async function writeImage(input, outPath, { keepFormat = false, maxEdge = MAX_EDGE } = {}) {
  if (!force && (await exists(outPath))) {
    const meta = await sharp(outPath).metadata();
    return { width: meta.width, height: meta.height };
  }
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  let pipeline = sharp(input, { animated: false }).rotate().resize({
    width: maxEdge,
    height: maxEdge,
    fit: "inside",
    withoutEnlargement: true,
  });
  if (outPath.endsWith(".webp")) pipeline = pipeline.webp({ quality: 78, effort: 5 });
  else if (outPath.endsWith(".png")) pipeline = pipeline.png({ compressionLevel: 9, palette: keepFormat });
  else if (outPath.endsWith(".jpg")) pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
  const info = await pipeline.toFile(outPath);
  return { width: info.width, height: info.height };
}

async function buildPhotos() {
  const catalog = JSON.parse(await fs.readFile(path.join(here, "photo-catalog.json"), "utf8"));
  const entries = [];
  for (const photo of catalog) {
    if (photo.exclude) continue;
    const src = path.join(photosDir, photo.file);
    const rel = `photos/${photo.id}.webp`;
    const outPath = path.join(mediaDir, rel);
    if (!(await exists(src)) && !(await exists(outPath))) {
      console.warn(`  missing source: ${photo.file}`);
      continue;
    }
    const size = await writeImage(src, outPath);
    entries.push({
      id: `photos/${photo.id}`,
      src: `/media/${rel}`,
      ...size,
      title: photo.title,
      alt: photo.alt,
      collection: "photos",
      kind: photo.kind,
      places: photo.places,
      tags: photo.tags,
      source: { origin: "vista-chase-photo-library", file: photo.file },
    });
  }
  console.log(`photos: ${entries.length}`);
  return entries;
}

async function download(url) {
  await fs.mkdir(cacheDir, { recursive: true });
  const cached = path.join(cacheDir, slugify(url) + path.extname(url.split("?")[0]).toLowerCase());
  if (await exists(cached)) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await fs.writeFile(cached, Buffer.from(await res.arrayBuffer()));
  return cached;
}

async function buildSite() {
  const items = JSON.parse(await fs.readFile(path.join(here, "live-site-images.json"), "utf8"));
  const entries = [];
  const used = new Set();
  const queue = [...items];
  const failures = [];

  async function worker() {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const { name, ext } = webflowName(item.url);
      const collection = classify(item, name, ext);
      let slug =
        NAME_OVERRIDES[name] ??
        (slugify(/^[0-9a-f]{20,}$/i.test(name) ? `photo-${name.slice(0, 12)}` : name) || "image");
      while (used.has(`${collection}/${slug}`)) slug += "-2";
      used.add(`${collection}/${slug}`);

      const keepFormat = collection !== "site" && collection !== "blog";
      const outExt = ext === ".svg" ? ".svg" : keepFormat ? ".png" : ".webp";
      const rel = `${collection}/${slug}${outExt}`;
      const outPath = path.join(mediaDir, rel);
      try {
        const file = await download(item.url);
        let size = {};
        if (outExt === ".svg") {
          if (force || !(await exists(outPath))) {
            await fs.mkdir(path.dirname(outPath), { recursive: true });
            await fs.copyFile(file, outPath);
          }
        } else {
          size = await writeImage(file, outPath, {
            keepFormat,
            maxEdge: keepFormat ? ICON_MAX_EDGE : collection === "blog" ? 1600 : MAX_EDGE,
          });
        }
        const title = humanize(name);
        entries.push({
          id: `${collection}/${slug}`,
          src: `/media/${rel}`,
          ...size,
          title,
          alt: item.alts?.[0] ?? (collection === "icons" ? "" : title),
          collection,
          kind: collection === "site" ? (/ellipse/i.test(name) ? "people" : "landscape") : collection,
          places: placesFor(`${name} ${(item.alts ?? []).join(" ")}`),
          tags: [],
          source: { origin: "vistachase.com", url: item.url, pages: item.pages },
        });
      } catch (error) {
        failures.push(`${item.url}: ${error.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: 6 }, worker));

  // The horse-and-rider mark on its own (no wordmark), cropped from the dark logo, for the nav bar.
  const logo = entries.find((e) => e.id === "brand/logo-dark");
  if (logo) {
    const rel = "brand/horse-mark.png";
    const outPath = path.join(mediaDir, rel);
    if (force || !(await exists(outPath))) {
      await sharp(path.join(mediaDir, "brand/logo-dark.png"))
        .extract({ left: 58, top: 0, width: 96, height: 76 })
        .png({ compressionLevel: 9 })
        .toFile(outPath);
    }
    entries.push({
      ...logo,
      id: "brand/horse-mark",
      src: `/media/${rel}`,
      width: 96,
      height: 76,
      title: "Horse-and-rider mark",
      alt: "",
      source: { ...logo.source, derived: "cropped from brand/logo-dark" },
    });
  }
  failures.forEach((f) => console.warn(`  failed: ${f}`));
  console.log(`live site: ${entries.length} (${failures.length} failed)`);
  return entries;
}

const manifestPath = path.join(mediaDir, "manifest.json");
const previous = (await exists(manifestPath)) ? JSON.parse(await fs.readFile(manifestPath, "utf8")).assets : [];
const keep = (collections) => previous.filter((a) => collections.includes(a.collection));

const photos = only === "site" ? keep(["photos"]) : await buildPhotos();
const site = only === "photos" ? keep(["brand", "badges", "icons", "site", "blog"]) : await buildSite();
const assets = [...photos, ...site].sort((a, b) => a.id.localeCompare(b.id));

await fs.writeFile(
  manifestPath,
  JSON.stringify({ generatedBy: "scripts/media/build-media.mjs", count: assets.length, assets }, null, 1) + "\n"
);
console.log(`manifest: ${assets.length} assets → ${path.relative(backendDir, manifestPath)}`);
