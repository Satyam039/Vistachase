import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fixPattern, planBlogTextFixes, type TextFix } from "../src/modules/seo/blog-text-fixes";

const file = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../prisma/catalog/blog-fixes-2026-11.json"), "utf8")) as {
  posts: Record<string, TextFix[]>;
};

describe("blog text fixes", () => {
  it("replaces only the old passage and is safe to run twice", () => {
    const fixes = [{ from: "start from CAD $99 per person", to: "start from CAD $220 per person" }];
    const page = { body: "Intro.\n\nShared tours start from CAD $99 per person. Outro.", excerpt: "Unrelated" };
    const first = planBlogTextFixes(page, fixes);
    expect(first.data).toEqual({ body: "Intro.\n\nShared tours start from CAD $220 per person. Outro." });
    expect(first.missing).toEqual([]);
    const second = planBlogTextFixes({ ...page, ...first.data }, fixes);
    expect(second.data).toEqual({});
    expect(second.applied).toEqual([]);
    expect(second.missing).toEqual([]);
  });

  it("matches a link stored at its old address and writes the current one", () => {
    const fixes = [{ from: "Our [Heart of Banff Tour](/banff-highlights-tour) costs $99.", to: "Our [Banff & Yoho Discovery](/banff-highlights-tour) costs $220." }];
    const plan = planBlogTextFixes({ body: "A. Our [Heart of Banff Tour](https://www.vistachase.com/shared-tours-heart-of-banff) costs $99. B." }, fixes);
    expect(plan.data).toEqual({ body: "A. Our [Banff & Yoho Discovery](/banff-highlights-tour) costs $220. B." });
  });

  it("leaves a passage staff rewrote and reports it", () => {
    const fixes = [{ from: "capped at 12 guests", to: "run in small groups" }];
    const plan = planBlogTextFixes({ body: "Our tours are lovely." }, fixes);
    expect(plan.data).toEqual({});
    expect(plan.missing).toEqual(fixes);
  });

  it("fixes text inside FAQs and the unpublished draft", () => {
    const fixes = [{ from: "Heart of Banff", to: "Banff & Yoho Discovery" }];
    const plan = planBlogTextFixes({ faqs: [{ q: "Is the Heart of Banff tour good?", a: "Yes" }], draft: { body: "Heart of Banff" } }, fixes);
    expect(plan.data).toEqual({ faqs: [{ q: "Is the Banff & Yoho Discovery tour good?", a: "Yes" }], draft: { body: "Banff & Yoho Discovery" } });
  });

  it("catalog fixes never re-match their own replacement", () => {
    const all = Object.values(file.posts).flat();
    expect(all.length).toBeGreaterThan(50);
    for (const f of all) {
      expect(f.from.length).toBeGreaterThan(10);
      expect(f.to.includes(f.from)).toBe(false);
      expect(fixPattern(f.from).test(f.to)).toBe(false);
    }
  });

  it("catalog no longer mentions retired names, old prices or a 12-guest cap", () => {
    const text = Object.values(file.posts).flat().map((f) => f.to).join("\n");
    expect(text).not.toMatch(/Heart of Banff|Bestseller|\$(99|125|175|249|999|1,099|1,799)\b|maximum of 12|up to 12|Golden Hour shuttle/);
  });
});
