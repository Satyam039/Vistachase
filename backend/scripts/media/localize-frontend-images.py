"""
One-off: point every hard-coded external image in frontend/src at its backend copy (/media/...).

- Current vistachase.com (Webflow) images → their downloaded copy, via media/manifest.json
  (the photo library's copy wins when it is the same photo).
- Images from the older Webflow project (403 now) and Unsplash stand-ins → the library photo
  that shows what the surrounding copy describes (CONTEXT_RULES, first match wins).

  python3 backend/scripts/media/localize-frontend-images.py [--write]
"""
import json, os, re, sys, glob
from urllib.parse import unquote

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
manifest = json.load(open(os.path.join(ROOT, "backend/media/manifest.json")))["assets"]
by_id = {a["id"]: a for a in manifest}
by_url = {a["source"]["url"]: a for a in manifest if a["source"].get("url")}

def stem(name):
    name = unquote(name.split("?")[0].split("/")[-1])
    name = re.sub(r"^[0-9a-f]{24}_", "", name)
    name = re.sub(r"\.[a-z0-9]+$", "", name, flags=re.I)
    return re.sub(r"[^a-z0-9]+", "", name.lower())

library_by_stem = {stem(a["source"]["file"]): a for a in manifest if a["collection"] == "photos"}

# (pattern in the nearby copy, media id). Checked against the text just before the URL.
CONTEXT_RULES = [
    (r"openGraph|og:image|Vista Chase .{0,40}Canadian Rockies Tours", "site/hero-background-image-3"),
    (r"Ten Peaks iconic mirror|Valley of the Ten Peaks iconic", "photos/moraine-lake-perfect-reflection"),
    (r"Morant", "photos/morants-curve-summer"),
    (r"mountain guide", "photos/guide-with-guests"),
    (r"canoes[^\n]{0,40}Moraine", "photos/moraine-lake-canoes"),
    (r"alpenglow[^\n]{0,40}Ten Peaks|Ten Peaks rockpile", "photos/moraine-lake-reflection-morning"),
    (r"Lake Louise morning", "photos/lake-louise-sunrise"),
    (r"Bow Valley alpine twilight", "photos/aurora-vermilion-lakes"),
    (r"Bow Falls", "photos/bow-falls"),
    (r"Johnston", "photos/johnston-canyon"),
    (r"Natural Bridge", "photos/natural-bridge"),
    (r"Peyto", "photos/peyto-lake"),
    (r"Columbia Icefield|Athabasca Glacier", "photos/athabasca-glacier"),
    (r"Emerald|Yoho", "photos/emerald-lake-island"),
    (r"Lake Louise", "photos/lake-louise-red-canoes"),
    (r"Moraine", "photos/moraine-lake-perfect-reflection"),
    (r"mountain highways|Icefields Parkway|Icefields", "photos/icefields-parkway-crowfoot"),
    (r"Canada's first national park|Banff", "photos/vermilion-lakes-mount-rundle"),
]

URL = re.compile(r"https://(?:cdn\.prod\.website-files\.com|images\.unsplash\.com)/[^\"'`\s]+")

def resolve(url, text, start, end):
    before = text[:start]
    asset = by_url.get(url)
    if asset:
        return library_by_stem.get(stem(url), asset)["src"], "live"
    if "website-files.com" in url and library_by_stem.get(stem(url)):
        return library_by_stem[stem(url)]["src"], "library"
    # The object literal around the URL (its caption / name / description) first, then the
    # text just before it, widening until something matches.
    obj = text[text.rfind("{", 0, start) : text.find("}", end) + 1]
    for window in (obj, before[-160:], before[-400:], before[-900:]):
        for pattern, media_id in CONTEXT_RULES:
            if re.search(pattern, window, re.I):
                return by_id[media_id]["src"], f"context:{pattern[:24]}"
    return None, "unresolved"

write = "--write" in sys.argv
files = glob.glob(os.path.join(ROOT, "frontend/src/**/*.ts*"), recursive=True)
unresolved = 0
for path in sorted(files):
    text = open(path, encoding="utf-8").read()
    out, last, changed = [], 0, []
    for m in URL.finditer(text):
        src, how = resolve(m.group(0), text, m.start(), m.end())
        if not src:
            unresolved += 1
            print(f"UNRESOLVED {os.path.relpath(path, ROOT)}: {m.group(0)}")
            continue
        out.append(text[last : m.start()] + src)
        last = m.end()
        changed.append((m.group(0), src, how))
    if changed:
        rel = os.path.relpath(path, ROOT)
        for url, src, how in changed:
            print(f"{rel}: {unquote(url.split('/')[-1])[:48]:48} → {src}  ({how})")
        if write:
            open(path, "w", encoding="utf-8").write("".join(out) + text[last:])
print(f"{'wrote' if write else 'dry run'}; unresolved: {unresolved}")
