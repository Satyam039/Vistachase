// Blog posts with retired tour names, old prices and group sizes (owner, 2026-11-13): the deploy
// script replaces each listed phrase where a post still has it, and nothing else.

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { applyTextFixes, applyTextFixesDeep, phrasePattern, type TextFix } from "@/modules/seo/content-fixes";

const file = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../prisma/catalog/blog-content-fixes-2026-11.json"), "utf8")) as {
  posts: Record<string, TextFix[]>;
};

describe("blog content fixes", () => {
  it("lists the 20 posts from the site audit", () => {
    expect(Object.keys(file.posts)).toHaveLength(20);
    for (const p of Object.keys(file.posts)) expect(p.startsWith("/blog-post/")).toBe(true);
  });

  it("never puts a phrase back that it removes, so a rerun changes nothing", () => {
    for (const list of Object.values(file.posts)) {
      for (const fix of list) {
        const once = applyTextFixes(`x ${fix.from} y`, list).text;
        expect(applyTextFixes(once, list).replaced).toBe(0);
      }
    }
  });

  it("leaves out retired names and old prices in the new wording", () => {
    const all = Object.values(file.posts).flat().map((f) => f.to).join("\n");
    expect(all).not.toMatch(/Heart of Banff|Bestseller|\$99\b|\$249|\$999|\$1,099|\b12 guests/);
  });

  it("matches through line-break, stray joiner and full-URL differences", () => {
    const fixes = [{ from: "Our [Heart of Banff Tour](/banff-highlights-tour) is great", to: "Our [Banff & Yoho Discovery tour](/banff-highlights-tour) is great" }];
    const saved = "Our [Heart‍ of Banff\nTour](https://www.vistachase.com/banff-highlights-tour) is  great.";
    const r = applyTextFixes(saved, fixes);
    expect(r.replaced).toBe(1);
    expect(r.text).toBe("Our [Banff & Yoho Discovery tour](/banff-highlights-tour) is great.");
  });

  it("leaves text staff already reworded", () => {
    expect(applyTextFixes("Shared tours start from CAD $230 per person.", file.posts["/blog-post/are-banff-tours-worth"]).replaced).toBe(0);
  });

  it("fixes FAQ answers and drafts too", () => {
    const fixes = [{ from: "up to 12 guests", to: "up to 15 guests" }];
    const r = applyTextFixesDeep([{ question: "How big?", answer: "A group of up to 12 guests." }], fixes);
    expect(r.replaced).toBe(1);
    expect(r.value[0].answer).toBe("A group of up to 15 guests.");
  });

  it("escapes prices and punctuation", () => {
    expect(phrasePattern("CAD $99 (from)").test("CAD $99 (from)")).toBe(true);
    expect(phrasePattern("CAD $99").test("CAD 99")).toBe(false);
  });
});
