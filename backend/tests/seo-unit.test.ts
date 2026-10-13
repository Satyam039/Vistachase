// SEO helpers that need no database: URL rules, redirect loops, CSV, HTML reading, field checks.

import { describe, it, expect, afterEach } from "vitest";
import { checkCanonical, checkImageRef, checkLink, isReservedPath, normalizeKeyword, normalizePath, slugify } from "@/modules/seo/paths";
import { findRedirectLoop, resolveChains } from "@/modules/seo/seo.redirects";
import { csvCell, parseCsv, toCsv } from "@/modules/seo/seo.csv";
import { parseHtml } from "@/modules/seo/seo.audit";
import { checkPage, completeness, pageUpdateSchema } from "@/modules/seo/seo.validation";

const savedSite = process.env.SITE_URL;
afterEach(() => {
  process.env.SITE_URL = savedSite;
});

describe("paths", () => {
  it("normalises site paths and refuses anything else", () => {
    expect(normalizePath("/private-tours/")).toBe("/private-tours");
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("/a//b")).toBe("/a/b");
    for (const bad of ["//evil.com", "https://evil.com", "/a/../admin", "/x?y=1", "/x#y", "javascript:alert(1)", "/a b", "/a\\b", "relative"]) {
      expect(normalizePath(bad), bad).toBeNull();
    }
  });

  it("keeps redirects away from app internals and signed-in areas", () => {
    expect(isReservedPath("/admin/seo")).toBe(true);
    expect(isReservedPath("/api/x")).toBe(true);
    expect(isReservedPath("/book")).toBe(true);
    expect(isReservedPath("/bookings-guide")).toBe(false);
    expect(isReservedPath("/old-tour")).toBe(false);
  });

  it("only accepts canonicals on this site", () => {
    process.env.SITE_URL = "https://www.vistachase.com";
    expect(checkCanonical("/private-tours")).toEqual({ ok: true, value: "/private-tours" });
    expect(checkCanonical("https://vistachase.com/private-tours").ok).toBe(true);
    expect(checkCanonical("https://evil.example/private-tours").ok).toBe(false);
    expect(checkCanonical("https://www.vistachase.com/x?utm=1").ok).toBe(false);
    expect(checkCanonical("javascript:alert(1)").ok).toBe(false);
  });

  it("refuses script and data links and non-media images", () => {
    expect(checkLink("javascript:alert(1)").ok).toBe(false);
    expect(checkLink("data:text/html,hi").ok).toBe(false);
    expect(checkLink("//evil.com").ok).toBe(false);
    expect(checkLink("/contact-us?utm_source=guide").ok).toBe(true);
    expect(checkLink("https://wa.me/18257349456").ok).toBe(true);
    expect(checkImageRef("/media/photos/a.webp").ok).toBe(true);
    expect(checkImageRef("/etc/passwd").ok).toBe(false);
    expect(checkImageRef("http://insecure.example/a.jpg").ok).toBe(false);
  });

  it("slugifies and normalises keywords", () => {
    expect(slugify("Lake Louise & Moraine Lake!")).toBe("lake-louise-and-moraine-lake");
    expect(normalizeKeyword("  Moraine   LAKE Shuttle ")).toBe("moraine lake shuttle");
  });
});

describe("redirect loops", () => {
  const active = [
    { fromPath: "/a", toPath: "/b" },
    { fromPath: "/b", toPath: "/c" },
  ];
  it("detects a loop and allows a straight redirect", () => {
    expect(findRedirectLoop("/c", "/a", active)).toBe(true);
    expect(findRedirectLoop("/x", "/x", [])).toBe(true);
    expect(findRedirectLoop("/d", "/a", active)).toBe(false);
  });
  it("resolves chains and marks loops", () => {
    const chains = resolveChains([...active, { fromPath: "/l1", toPath: "/l2" }, { fromPath: "/l2", toPath: "/l1" }]);
    expect(chains.find((c) => c.fromPath === "/a")).toMatchObject({ finalPath: "/c", hops: 2, loop: false });
    expect(chains.find((c) => c.fromPath === "/l1")?.loop).toBe(true);
  });
});

describe("csv", () => {
  it("parses quotes, commas, newlines and CRLF", () => {
    const rows = parseCsv('keyword,notes\r\n"moraine lake","says ""hi"", twice"\r\nlake louise,"two\nlines"\r\n');
    expect(rows).toEqual([
      ["keyword", "notes"],
      ["moraine lake", 'says "hi", twice'],
      ["lake louise", "two\nlines"],
    ]);
    expect(() => parseCsv('a,"b\n')).toThrow();
  });
  it("guards formulas on export", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(toCsv(["k"], [["@x"]])).toBe("k\r\n'@x\r\n");
  });
});

describe("html reading", () => {
  it("reads the metadata and same-site links of a page", () => {
    const html = `<!doctype html><html><head><title>Banff Tours &amp; Shuttles</title>
      <meta name="description" content="Small-group tours.">
      <meta name="robots" content="index, follow">
      <link rel="canonical" href="https://www.vistachase.com/shared-tours">
      <meta property="og:image" content="/media/a.webp"></head>
      <body><h1>Shared <em>tours</em></h1><script>var x = "<h1>not me</h1>";</script>
      <a href="/private-tours">Private</a><a href="/shuttles?x=1#top">S</a><a href="https://other.example/x">ext</a>
      <a href="mailto:a@b.c">m</a><a href="/api/tours">api</a><a href="/media/x.jpg">img</a></body></html>`;
    const page = parseHtml(html, "https://www.vistachase.com/shared-tours");
    expect(page.title).toBe("Banff Tours & Shuttles");
    expect(page.description).toBe("Small-group tours.");
    expect(page.canonical).toBe("https://www.vistachase.com/shared-tours");
    expect(page.robots).toBe("index, follow");
    expect(page.h1).toEqual(["Shared tours"]);
    expect(page.links.sort()).toEqual(["/private-tours", "/shuttles"]);
  });
});

describe("field checks", () => {
  const base = {
    source: "CMS",
    pageType: "GUIDE",
    important: false,
    seoTitle: null,
    metaDescription: null,
    h1: null,
    focusKeyword: null,
    canonicalUrl: null,
    robotsIndex: true,
    ogImage: null,
    featuredImage: null,
    featuredImageAlt: null,
    answerSnippet: null,
    body: null,
    faqs: [],
  };
  it("blocks publishing a guide without title, description, H1 and real content", () => {
    const errors = checkPage(base).filter((c) => c.level === "error").map((c) => c.field);
    expect(errors.sort()).toEqual(["body", "h1", "metaDescription", "seoTitle"]);
  });
  it("advises on lengths, focus keyword and noindex without blocking", () => {
    const checks = checkPage({ ...base, source: "TOUR", pageType: "TOUR", important: true, seoTitle: "Short", metaDescription: "Too short", focusKeyword: "moraine lake", robotsIndex: false });
    expect(checks.some((c) => c.level === "error")).toBe(false);
    expect(checks.map((c) => c.field)).toEqual(expect.arrayContaining(["seoTitle", "metaDescription", "robotsIndex"]));
    expect(completeness({ ...base, seoTitle: "x", metaDescription: "y" })).toBe(33);
  });
  it("refuses unknown fields and unsafe values in page edits", () => {
    expect(pageUpdateSchema.safeParse({ status: "PUBLISHED" }).success).toBe(false);
    expect(pageUpdateSchema.safeParse({ path: "/admin" }).success).toBe(false);
    expect(pageUpdateSchema.safeParse({ ctaUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(pageUpdateSchema.safeParse({ ogImage: "https://x.example/a.jpg", seoTitle: "" }).data).toEqual({ ogImage: "https://x.example/a.jpg", seoTitle: null });
  });
});
