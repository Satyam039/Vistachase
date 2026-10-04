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
// 3. Videos: the business's video clips (repo-root Videos/ and "Videos 2/" by default), described in
//    scripts/media/video-catalog.json. Each becomes a muted H.264 MP4 for the web (720p, about
//    2.5 Mbit/s, trimmed to its loop), a 1080p version when it is a hero clip, and a WebP poster.
//    Encoding uses AVFoundation through scripts/media/transcode-video.swift (macOS).
// 4. media/manifest.json lists every file with its size, alt text, places and tags,
//    plus the original source (file name or Webflow URL) so content can be remapped.
//
// Re-running is incremental: existing outputs are reused unless --force is passed.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";

const run = promisify(execFile);

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
const videosRoot = path.resolve(arg("--videos") ?? path.join(backendDir, ".."));
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
    // Browser icons from the gold horse emblem (square), on the brand's Obsidian background.
    const emblem = path.join(mediaDir, "brand/horse-emblem-gold.png");
    for (const [name, size] of [["favicon-32", 32], ["icon-192", 192], ["apple-touch-icon", 180]]) {
      const iconPath = path.join(mediaDir, `brand/${name}.png`);
      if (force || !(await exists(iconPath))) {
        const inner = Math.round(size * 0.8);
        const mark = await sharp(emblem).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
        await sharp({ create: { width: size, height: size, channels: 4, background: "#1c1f23" } })
          .composite([{ input: mark, gravity: "center" }])
          .png({ compressionLevel: 9 })
          .toFile(iconPath);
      }
      entries.push({
        ...logo,
        id: `brand/${name}`,
        src: `/media/brand/${name}.png`,
        width: size,
        height: size,
        title: `Browser icon ${size}px`,
        alt: "",
        source: { ...logo.source, derived: "horse emblem on Obsidian Black" },
      });
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

async function transcoder() {
  const source = path.join(here, "transcode-video.swift");
  const binary = path.join(cacheDir, "transcode-video");
  const [src, bin] = await Promise.all([fs.stat(source), fs.stat(binary).catch(() => null)]);
  if (!bin || bin.mtimeMs < src.mtimeMs) {
    await fs.mkdir(cacheDir, { recursive: true });
    console.log("compiling transcode-video.swift…");
    await run("swiftc", ["-O", "-suppress-warnings", source, "-o", binary]);
  }
  return binary;
}

async function buildVideos() {
  const catalog = JSON.parse(await fs.readFile(path.join(here, "video-catalog.json"), "utf8"));
  const binary = await transcoder();
  const entries = [];
  for (const video of catalog) {
    if (video.exclude) continue;
    const src = path.join(videosRoot, video.file);
    const rel = `videos/${video.id}.mp4`;
    const relHd = `videos/${video.id}-1080.mp4`;
    const relPoster = `videos/${video.id}-poster.webp`;
    await fs.mkdir(path.join(mediaDir, "videos"), { recursive: true });
    const encode = async (out, width, bitrate) => {
      const poster = path.join(cacheDir, `${video.id}-${width}.jpg`);
      const { stdout } = await run(binary, [
        src, out, poster,
        "--width", String(width), "--bitrate", String(bitrate),
        "--start", String(video.start ?? 0), "--duration", String(video.duration ?? 12), "--poster-at", "1",
      ]);
      return { ...JSON.parse(stdout.trim().split("\n").pop()), poster };
    };
    const outPath = path.join(mediaDir, rel);
    let info;
    if (force || !(await exists(outPath))) {
      if (!(await exists(src))) {
        console.warn(`  missing source: ${video.file}`);
        continue;
      }
      info = await encode(outPath, 1280, 2_500_000);
      const hd = video.hero ? await encode(path.join(mediaDir, relHd), 1920, 5_000_000) : null;
      // Poster: the sharpest frame available, as WebP.
      await sharp((hd ?? info).poster).webp({ quality: 78 }).toFile(path.join(mediaDir, relPoster));
    } else {
      const previous = (await exists(manifestPath))
        ? JSON.parse(await fs.readFile(manifestPath, "utf8")).assets.find((a) => a.id === `videos/${video.id}`)
        : null;
      info = previous ?? (await sharp(path.join(mediaDir, relPoster)).metadata());
    }
    entries.push({
      id: `videos/${video.id}`,
      src: `/media/${rel}`,
      ...(video.hero ? { srcHd: `/media/${relHd}` } : {}),
      poster: `/media/${relPoster}`,
      width: info.width,
      height: info.height,
      duration: info.duration ?? video.duration,
      title: video.title,
      alt: video.alt,
      collection: "videos",
      kind: "video",
      places: video.places,
      tags: video.tags,
      source: { origin: "vista-chase-video-library", file: video.file },
    });
    console.log(`  ${video.id}`);
  }
  console.log(`videos: ${entries.length}`);
  return entries;
}

const manifestPath = path.join(mediaDir, "manifest.json");
const previous = (await exists(manifestPath)) ? JSON.parse(await fs.readFile(manifestPath, "utf8")).assets : [];
const keep = (collections) => previous.filter((a) => collections.includes(a.collection));

const photos = only && only !== "photos" ? keep(["photos"]) : await buildPhotos();
const site = only && only !== "site" ? keep(["brand", "badges", "icons", "site", "blog"]) : await buildSite();
const videos = only && only !== "videos" ? keep(["videos"]) : await buildVideos();
const assets = [...photos, ...site, ...videos].sort((a, b) => a.id.localeCompare(b.id));

await fs.writeFile(
  manifestPath,
  JSON.stringify({ generatedBy: "scripts/media/build-media.mjs", count: assets.length, assets }, null, 1) + "\n"
);
console.log(`manifest: ${assets.length} assets → ${path.relative(backendDir, manifestPath)}`);
