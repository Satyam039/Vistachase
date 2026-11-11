// Fix recheck, 10 Nov 2026: renamed blog images redirect, and the website's own server isn't
// rate limited on the public SEO API (R1).
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app";
import { RENAMED_MEDIA } from "@/modules/media/renamed-media";

const MEDIA = path.resolve(__dirname, "../media");

describe("renamed blog images (N10)", () => {
  it("names every former ChatGPT image after a post, and the new file exists", () => {
    const entries = Object.entries(RENAMED_MEDIA);
    expect(entries.length).toBe(51);
    for (const [from, to] of entries) {
      expect(from).toMatch(/^\/media\/blog\/chatgpt-image-/);
      expect(to).not.toMatch(/chatgpt/i);
      expect(fs.existsSync(path.join(MEDIA, to.replace(/^\/media\//, "")))).toBe(true);
    }
    expect(new Set(Object.values(RENAMED_MEDIA)).size).toBe(entries.length);
  });

  it("301s the old address to the new file", async () => {
    const [from, to] = Object.entries(RENAMED_MEDIA)[0];
    const res = await request(createApp()).get(from);
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe(to);
  });
});
