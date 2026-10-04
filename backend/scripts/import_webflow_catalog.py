"""
One-off import of the live vistachase.com (Webflow) product pages into the new catalog.

Reads saved HTML for each product page, extracts the content blocks the live tour
template uses (facts row, Overview / Inclusions / Itinerary / Seasonal / FAQ tabs,
price card, cross-sells, images) and writes backend/prisma/catalog/products.json.

Usage:
  python3 backend/scripts/import_webflow_catalog.py <dir-with-saved-html>
Saved files are named after the URL slug, e.g. banff-highlights-tour.html.
"""
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from minidom import parse  # noqa: E402

# Live URL slug → catalog settings the page itself doesn't state (category, destination,
# booking mode, Bokun ID), from the product mapping table.
MAP_FILE = os.path.join(os.path.dirname(__file__), "..", "prisma", "catalog", "product-map.json")
with open(MAP_FILE, encoding="utf-8") as _f:
    PRODUCTS = {p["slug"]: p for p in json.load(_f)["products"]}


def cls(name):
    return lambda n: name in n.classes


def first_text(node, name):
    found = node.find(cls(name)) if node else None
    return found.text() if found else ""


def money(text):
    m = re.search(r"\$\s?([\d,]+(?:\.\d\d)?)", text or "")
    return float(m.group(1).replace(",", "")) if m else None


def paragraphs(node):
    """Body paragraphs that are not list-item duplicates."""
    out = []
    for p in node.find_all(lambda n: n.tag == "p"):
        if any(a.tag == "li" for a in ancestors(p)):
            continue
        t = p.text()
        if t:
            out.append(t)
    return out


def ancestors(node):
    while node.parent is not None:
        node = node.parent
        yield node


def list_after(heading):
    """The first <ul>/<ol> that follows a heading inside the same container."""
    container = heading.parent
    seen = False
    for n in container.find_all(lambda x: x.tag in ("h2", "ul", "ol")):
        if n is heading:
            seen = True
        elif seen and n.tag in ("ul", "ol"):
            return [li.text() for li in n.by_tag("li") if li.text()]
        elif seen and n.tag == "h2":
            break
    return []


def sections(pane):
    """Split a tab pane into (heading, paragraphs, list items) groups by its h2s."""
    groups, cur = [], None
    for n in pane.find_all(lambda x: x.tag in ("h2", "p", "li")):
        if n.tag == "h2":
            cur = {"heading": n.text(), "paragraphs": [], "items": []}
            groups.append(cur)
            continue
        if cur is None:
            cur = {"heading": "", "paragraphs": [], "items": []}
            groups.append(cur)
        if n.tag == "li":
            if n.text():
                cur["items"].append(n.text())
        elif not any(a.tag == "li" for a in ancestors(n)) and n.text():
            if "tab-bold-text" in n.classes:
                cur["paragraphs"].append({"time": n.text()})
            else:
                cur["paragraphs"].append(para_text(n))
    return groups


def flatten(node, in_strong=False, in_em=False):
    """(kind, text) runs of a paragraph: kind is "name" inside <strong>, "label" for <strong><em>, else "text"."""
    for c in node.children:
        if isinstance(c, str):
            if c.strip():
                yield ("label" if in_em else "name" if in_strong else "text", c)
        elif c.tag == "br":
            yield ("br", "")
        else:
            yield from flatten(c, in_strong or c.tag in ("strong", "b"), in_em or (in_strong and c.tag == "em"))


def para_text(p):
    """Paragraph text keeping the live page's <br> line breaks as newlines."""
    lines, cur = [], []
    for kind, text in flatten(p):
        if kind == "br":
            lines.append("".join(cur))
            cur = []
        else:
            cur.append(text)
    lines.append("".join(cur))
    lines = [re.sub(r"\s+", " ", line.replace("\u200d", "")).strip() for line in lines]
    return "\n".join(line for line in lines if line)


def stops(p):
    """Stop list from a "What you'll see" paragraph: a line that is all <strong> names a stop,
    the plain lines after it describe it. Inline bold inside a sentence is ignored."""
    lines, cur = [], []
    for kind, text in flatten(p):
        if kind == "br":
            lines.append(cur)
            cur = []
        else:
            cur.append((kind, re.sub(r"\s+", " ", text.replace("\u200d", ""))))
    lines.append(cur)

    out = []
    for line in lines:
        runs = [(k, t) for k, t in line if t.strip()]
        if not runs:
            continue
        joined = "".join(t for _, t in runs).strip()
        if all(k == "name" for k, _ in runs):
            out.append({"name": re.sub(r"\s*[;:]\s*$", "", joined), "text": ""})
        elif all(k in ("name", "label") for k, _ in runs):
            continue  # group label such as "Jasper National Park Highlights"
        elif runs[0][0] == "name" and re.match(r"^[^.]{2,80}?:\s", joined):
            # "<strong>Lake Louise:</strong> Admire …" — name and description on one line
            name, rest = joined.split(":", 1)
            out.append({"name": name.strip(), "text": rest.strip()})
        elif out:
            out[-1]["text"] = (out[-1]["text"] + " " + joined).strip()
    return [st for st in out if st["text"]]


def itinerary_steps(paras):
    steps, note = [], None
    pending_time = None
    for p in paras:
        if isinstance(p, dict):
            pending_time = p["time"]
        elif pending_time:
            steps.append({"time": pending_time, "text": p})
            pending_time = None
        elif p.lower().startswith("note"):
            note = re.sub(r"^note:\s*", "", p, flags=re.I)
        elif steps:
            steps[-1]["text"] += " " + p
        else:
            steps.append({"time": "", "text": p})
    return steps, note


def img_src(n):
    src = n.attrs.get("src") or ""
    return src if src.startswith("http") else None


def extract(slug, source):
    root = parse(source)
    conf = PRODUCTS[slug]
    title_tag = re.search(r"<title>(.*?)</title>", source, re.S)
    meta_desc = re.search(r'<meta content="([^"]*)" name="description"', source) or re.search(
        r'name="description" content="([^"]*)"', source
    )

    main = root.find(cls("main-wrap")) or root
    hero = main.find(cls("tours-overview-section")) or main
    facts = [
        {"label": first_text(d, "date-title"), "value": first_text(d, "date-sun-text")}
        for d in hero.by_class("date-item")
    ]
    facts = [f for f in facts if f["label"] or f["value"]]

    price_card = main.find(cls("tab-price-card"))
    price_text = price_card.text() if price_card else ""
    unit = "group" if re.search(r"per\s+(group|vehicle)", price_text, re.I) else "person"
    price_from = money(price_text)
    if price_from is None:
        ld = re.search(r'"price":\s*"?([\d.]+)', source)
        price_from = float(ld.group(1)) if ld else None
    if price_from is None:
        fact_price = next((f["value"] for f in facts if f["label"].lower().startswith("price")), "")
        price_from = money(fact_price)
        if re.search(r"group", fact_price, re.I):
            unit = "group"

    price_fact = next((f["value"] for f in facts if f["label"].lower().startswith("price")), "")
    if re.search(r"group|vehicle", price_fact, re.I) or conf["category"] in ("PRIVATE", "MULTIDAY"):
        unit = "group"

    panes, pane_order = {}, []
    for pane in main.by_class("w-tab-pane"):
        label = pane.attrs.get("data-w-tab") or ""
        panes[label.lower()] = sections(pane)
        pane_order.append((label, panes[label.lower()]))

    overview = panes.get("overview", [])
    includes, excludes, why, intro = [], [], None, None
    for g in overview:
        h = g["heading"].lower()
        if "price includes" in h and not includes:
            includes = g["items"]
        elif "price excludes" in h or ("price includes" in h and includes):
            excludes = g["items"]
        elif "why trav" in h:
            why = {"heading": g["heading"], "paragraphs": [p for p in g["paragraphs"] if isinstance(p, str)]}
        elif intro is None:
            intro = {"heading": g["heading"], "paragraphs": [p for p in g["paragraphs"] if isinstance(p, str)]}

    # Structured stops for the "What you'll see" style blocks (names are <strong> in the live HTML).
    stop_lists = {}
    for pane in main.by_class("w-tab-pane"):
        if (pane.attrs.get("data-w-tab") or "").lower() not in ("inclusions", "selection"):
            continue
        for p in pane.find_all(lambda n: n.tag == "p" and n.find(lambda x: x.tag in ("strong", "b"))):
            found = stops(p)
            # Irregular blocks (sub-lists of "-" hikes, very long names) stay as plain body text.
            if len(found) >= 2 and all(len(st["name"]) <= 120 and not st["text"].startswith("-") for st in found):
                heading = None
                for n in pane.find_all(lambda x: x.tag in ("h2", "p")):
                    if n is p:
                        break
                    if n.tag == "h2":
                        heading = n.text()
                stop_lists[heading] = found

    tabs = []
    for label, groups in pane_order:
        if label.lower().startswith("faq"):
            continue
        out_sections = []
        for g in groups:
            steps, note = itinerary_steps(g["paragraphs"]) if any(isinstance(p, dict) for p in g["paragraphs"]) else ([], None)
            body = [] if steps else [p for p in g["paragraphs"] if isinstance(p, str)]
            section_stops = stop_lists.get(g["heading"], [])
            if section_stops:
                body = []
            if g["heading"] or body or g["items"] or steps or section_stops:
                out_sections.append(
                    {"heading": g["heading"], "body": body, "items": g["items"], "steps": steps, "stops": section_stops, "note": note}
                )
        tabs.append({"label": label, "sections": out_sections})

    highlights = [
        {"heading": g["heading"], "paragraphs": [p for p in g["paragraphs"] if isinstance(p, str)], "items": g["items"]}
        for g in panes.get("inclusions", [])
        if g["heading"] or g["paragraphs"] or g["items"]
    ]

    itinerary = None
    for g in panes.get("itinerary", []):
        steps, note = itinerary_steps(g["paragraphs"])
        if steps or g["items"]:
            itinerary = {"heading": g["heading"], "steps": steps, "items": g["items"], "note": note}
            break

    seasonal = [
        {"heading": g["heading"], "paragraphs": [p for p in g["paragraphs"] if isinstance(p, str)], "items": g["items"]}
        for g in panes.get("seasonal", [])
        if g["heading"] or g["paragraphs"] or g["items"]
    ]

    faqs = []
    for acc in main.by_class("faq1_accordion"):
        q = first_text(acc, "faq1_question") or first_text(acc, "faq-heading-text")
        a = " ".join(p.text() for p in acc.find_all(lambda n: n.tag == "p" and "faq-paragraph" in n.classes))
        if q:
            faqs.append({"question": q, "answer": a or first_text(acc, "faq1_answer")})

    explore = main.find(cls("explore-more-section"))
    cross = []
    if explore:
        for a in explore.find_all(lambda n: n.tag == "a"):
            href = (a.attrs.get("href") or "").replace("https://www.vistachase.com", "")
            s = href.strip("/").split("?")[0]
            if s in PRODUCTS and s != slug and s not in cross:
                cross.append(s)

    images = []
    hero_img = hero.find(lambda n: n.tag == "img" and "tours-overview-image" in n.classes)
    for n in ([hero_img] if hero_img else []) + main.find_all(lambda n: n.tag == "img"):
        src = img_src(n)
        if not src or src in images or explore and n in explore.find_all(lambda x: x.tag == "img"):
            continue
        # PNGs on these pages are decorative template graphics (frames, badges, title art).
        if re.search(r"\.(svg|png)($|\?)", src, re.I) or "icon" in src.lower():
            continue
        images.append(src)

    rating_text = first_text(hero, "tours-overview-text")
    rating = re.match(r"([\d.]+)\s*\(([\d,]+)(\+?)\)", rating_text)
    title = hero.find(lambda n: n.tag == "h1")

    return {
        "slug": slug,
        "category": conf["category"],
        "destination": conf["destination"],
        "bokunId": conf["bokunId"],
        "bookingMode": conf["bookingMode"],
        "title": title.text() if title else slug,
        "metaTitle": html.unescape(re.sub(r"\s+", " ", title_tag.group(1)).strip()) if title_tag else None,
        "metaDescription": html.unescape(meta_desc.group(1)) if meta_desc else None,
        "rating": float(rating.group(1)) if rating else None,
        "reviewCountLabel": f"{rating.group(2)}{rating.group(3)}" if rating else None,
        "facts": facts,
        "priceFrom": price_from,
        "priceUnit": unit,
        "overview": intro,
        "includes": includes,
        "excludes": excludes,
        "whyTravelersLove": why,
        "highlights": highlights,
        "stops": [st for lst in stop_lists.values() for st in lst],
        "itinerary": itinerary,
        "seasonal": seasonal,
        "tabs": tabs,
        "faqs": faqs,
        "crossSells": cross,
        "images": images[:8],
    }


def main():
    src_dir = sys.argv[1]
    out = []
    for slug in PRODUCTS:
        with open(os.path.join(src_dir, f"{slug}.html"), encoding="utf-8") as f:
            out.append(extract(slug, f.read()))
    dest = os.path.join(os.path.dirname(__file__), "..", "prisma", "catalog", "products.json")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {len(out)} products to {os.path.relpath(dest)}")


if __name__ == "__main__":
    main()
