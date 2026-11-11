// Post-migration technical audit fixes (9 Nov 2026): migration redirects (retired tours to the
// closest single tour, removed tickets, /guides), the last Webflow-hosted blog images served from
// their copy here, nofollow links left out of the crawl, and the shorter titles/descriptions file.

import fs from "node:fs";
import path from "node:path";
import { cleanBody } from "@/modules/seo/seo.public";
import { BUILT_IN_REDIRECTS, resolveChains } from "@/modules/seo/seo.redirects";
import { parseHtml } from "@/modules/seo/seo.audit";
import { webflowLocalMap } from "@/modules/seo/portal/images";
import { RETIRED_TOUR_SLUGS, REMOVED_TOUR_SLUGS } from "@/modules/tours/product-map";
import { MEDIA_DIR } from "@/modules/media/media.repository";

describe("migration redirects", () => {
  it("cover every retired tour and removed ticket, never through a category page or a chain", () => {
    for (const slug of [...RETIRED_TOUR_SLUGS, ...REMOVED_TOUR_SLUGS]) expect(BUILT_IN_REDIRECTS[`/${slug}`]).toBeTruthy();
    for (const slug of RETIRED_TOUR_SLUGS) expect(["/private-tours", "/shared-tours"]).not.toContain(BUILT_IN_REDIRECTS[`/${slug}`]);
    const chains = resolveChains(Object.entries(BUILT_IN_REDIRECTS).map(([fromPath, toPath]) => ({ fromPath, toPath })));
    expect(chains.filter((c) => c.loop || c.hops > 1)).toEqual([]);
  });

  it("send /partners to the merged affiliate page, and leave the partner portal alone", () => {
    expect(BUILT_IN_REDIRECTS["/partners"]).toBe("/affiliates");
    expect(BUILT_IN_REDIRECTS["/partners/login"]).toBeUndefined();
    expect(BUILT_IN_REDIRECTS["/partners/dashboard"]).toBeUndefined();
  });

  it("send the empty guides index to the blog", () => {
    expect(BUILT_IN_REDIRECTS["/guides"]).toBe("/blog");
  });
});

describe("Webflow images in blog posts", () => {
  const url = "https://cdn.prod.website-files.com/69187ef01b4c08ab157e43aa/698db8c504b90fcf48129e60_0a53995c.jpeg";

  it("have a local copy listed in the media manifest, and the file exists", () => {
    const local = webflowLocalMap().get(url);
    expect(local?.src).toBe("/media/blog/banff-february-lake-louise-chateau.webp");
    expect(fs.existsSync(path.join(MEDIA_DIR, "blog", "banff-february-lake-louise-chateau.webp"))).toBe(true);
  });

  it("are served from the copy, and an alt that is only a web address gets the copy's alt", () => {
    const body = `![https://www.chateau-lake-louise.com/x.jpg](${url})\n\n![Lake Louise in winter](${url} "Winter")\n\n![kept](https://example.com/a.jpg)`;
    const out = cleanBody(body, {}, webflowLocalMap())!.split("\n\n");
    expect(out[0]).toMatch(/^!\[Fairmont Chateau Lake Louise[^\]]*\]\(\/media\/blog\/banff-february-lake-louise-chateau\.webp\)$/);
    expect(out[1]).toBe('![Lake Louise in winter](/media/blog/banff-february-lake-louise-chateau.webp "Winter")');
    expect(out[2]).toBe("![kept](https://example.com/a.jpg)");
  });
});

describe("image alt text in post bodies", () => {
  it("gives an image with no alt (or only a web address) the post's name, and keeps real alts", () => {
    const body = "![](/media/uploads/a.png)\n\n![https://x.test/b.png](/media/b.png \"t\")\n\n![Moraine Lake](/media/c.png)";
    const out = cleanBody(body, {}, new Map(), "Banff [in] Winter")!.split("\n\n");
    expect(out[0]).toBe("![Banff in Winter](/media/uploads/a.png)");
    expect(out[1]).toBe('![Banff in Winter](/media/b.png "t")');
    expect(out[2]).toBe("![Moraine Lake](/media/c.png)");
  });
});

describe("audit crawl", () => {
  it("doesn't follow rel=nofollow links (My trips)", () => {
    const html = '<html><head><title>t</title></head><body><a href="/account/trips" rel="nofollow">My trips</a><a href="/faq">FAQ</a></body></html>';
    expect(parseHtml(html, "https://www.vistachase.com/").links).toEqual(["/faq"]);
  });
});

describe("shorter titles and descriptions (prisma/catalog/seo-fixes-2026-11.json)", () => {
  const fixes = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../prisma/catalog/seo-fixes-2026-11.json"), "utf8")) as {
    titles: Record<string, { from: string; to: string }>;
    descriptions: Record<string, { from: string | string[]; to: string }>;
  };
  it("keeps titles to 60 characters and descriptions to 160", () => {
    for (const f of Object.values(fixes.titles)) expect(f.to.length).toBeLessThanOrEqual(60);
    for (const f of Object.values(fixes.descriptions)) expect(f.to.length).toBeLessThanOrEqual(160);
  });
});
