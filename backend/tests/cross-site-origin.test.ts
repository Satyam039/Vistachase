// The CSRF origin check in app.ts. The frontend proxies /api/* to the backend (Next rewrites), so
// the browser's Origin reaches Express with the site's host in X-Forwarded-Host. A request from
// the site itself must pass even when its address (bare IP, new domain) isn't in CORS_ORIGINS;
// a request from any other site must still be refused.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { isAllowedOrigin, normalizeOrigin } from "@/lib/security/origin-check";

const saved = { CORS_ORIGINS: process.env.CORS_ORIGINS, FRONTEND_URL: process.env.FRONTEND_URL };

beforeEach(() => {
  // Production-like config: the domain is configured, the bare IP the site is reached on is not.
  process.env.CORS_ORIGINS = "https://www.vistachase.com";
  delete process.env.FRONTEND_URL;
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

// A request body the hold route rejects with 400, so a pass through the origin check never touches seats.
const incompleteHold = { departureId: "" };

describe("cross-site request check", () => {
  it("lets the seat hold through when the page and the proxied request share a host (bare IP over http)", async () => {
    const res = await request(createApp())
      .post("/api/reservations/hold")
      .set("Origin", "http://13.50.3.165")
      .set("X-Forwarded-Host", "13.50.3.165")
      .send(incompleteHold);
    expect(res.status).toBe(400);
    expect(res.body.error).not.toBe("Cross-site request refused");
  });

  it("refuses a hold posted from another site, even through the proxy", async () => {
    const res = await request(createApp())
      .post("/api/reservations/hold")
      .set("Origin", "https://evil.example")
      .set("X-Forwarded-Host", "13.50.3.165")
      .send(incompleteHold);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Cross-site request refused");
  });

  it("refuses another site whose name only contains the site's host", async () => {
    const res = await request(createApp())
      .post("/api/reservations/hold")
      .set("Origin", "http://13.50.3.165.evil.example")
      .set("X-Forwarded-Host", "13.50.3.165")
      .send(incompleteHold);
    expect(res.status).toBe(403);
  });

  it("still allows configured origins, with or without a trailing slash in the setting", async () => {
    process.env.CORS_ORIGINS = "https://www.vistachase.com/, http://13.50.3.165/";
    const res = await request(createApp())
      .post("/api/reservations/hold")
      .set("Origin", "http://13.50.3.165")
      .send(incompleteHold);
    expect(res.status).toBe(400);
  });

  it("leaves safe methods and requests without an Origin alone", async () => {
    const app = createApp();
    expect((await request(app).post("/api/reservations/hold").send(incompleteHold)).status).toBe(400);
    expect((await request(app).get("/api/reservations/hold").set("Origin", "https://evil.example")).status).toBe(400);
  });
});

describe("isAllowedOrigin", () => {
  const allowed = ["https://www.vistachase.com"];

  it("accepts a configured origin", () => {
    expect(isAllowedOrigin("https://www.vistachase.com", undefined, allowed)).toBe(true);
  });

  it("accepts the site's own origin from the forwarded host", () => {
    expect(isAllowedOrigin("http://13.50.3.165", "13.50.3.165", allowed)).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000", "localhost:3000", allowed)).toBe(true);
    // Only the first host counts when proxies append to the header.
    expect(isAllowedOrigin("http://13.50.3.165", "13.50.3.165, 127.0.0.1:3000", allowed)).toBe(true);
  });

  it("refuses other sites and unreadable origins", () => {
    expect(isAllowedOrigin("https://evil.example", "13.50.3.165", allowed)).toBe(false);
    expect(isAllowedOrigin("http://13.50.3.165:8080", "13.50.3.165", allowed)).toBe(false);
    expect(isAllowedOrigin("null", "13.50.3.165", allowed)).toBe(false);
    expect(isAllowedOrigin("https://evil.example", undefined, allowed)).toBe(false);
  });

  it("normalizes configured origins", () => {
    expect(normalizeOrigin(" https://WWW.vistachase.com/ ")).toBe("https://www.vistachase.com");
    expect(normalizeOrigin("http://13.50.3.165:80")).toBe("http://13.50.3.165");
  });
});
