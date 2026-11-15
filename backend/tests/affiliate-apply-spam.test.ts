// Partner applications are guarded like account signup (owner, 2026-11-15: fake partner signups sent
// "application received" emails): the page's signed form token, a hidden `fax` field, random names,
// throwaway emails and domains without a mail server. A quiet drop saves nothing.

import { describe, it, expect } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { issueFormToken } from "@/modules/enquiries/spam";

const app = createApp();
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const ip = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const oldToken = () => issueFormToken(Date.now() - 5_000);
const apply = (body: Record<string, unknown>) => request(app).post("/api/affiliates/apply").set("X-Forwarded-For", ip()).send(body);
const base = (email: string) => ({ name: "Rundlestone Lodge", contactName: "Priya Sharma", email, password: "a-long-password", type: "HOTEL" });

describe("partner application spam guard", () => {
  it("accepts a real application with the page's form token", async () => {
    const email = `partner.${unique()}@example.com`;
    const res = await apply({ ...base(email), website: "https://rundlestone.example.com", formToken: oldToken() });
    expect(res.status).toBe(201);
    expect(res.body.affiliate.code).toMatch(/^[A-Z0-9]+$/);
    expect(await prisma.user.findUnique({ where: { email } })).not.toBeNull();
  });

  it("refuses an application without a token or sent the moment the page opened", async () => {
    const email = `partner.${unique()}@example.com`;
    expect((await apply(base(email))).status).toBe(400);
    expect((await apply({ ...base(email), formToken: issueFormToken() })).status).toBe(400);
    expect((await apply({ ...base(email), formToken: "123.forged" })).status).toBe(400);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it("quietly drops a filled hidden field, random names, throwaway emails and dead domains", async () => {
    const cases = [
      { ...base(`hp.${unique()}@example.com`), fax: "555-0100" },
      { ...base(`rnd.${unique()}@example.com`), name: "glZrgkquEiQCfXTR", contactName: "cHXwtVPyDCAWVGSEFGhh" },
      { ...base(`throwaway.${unique()}@mailinator.com`) },
      { ...base(`dead.${unique()}@nonexistent-domain.example`) },
    ];
    for (const body of cases) {
      const res = await apply({ ...body, formToken: oldToken() });
      expect(res.status).toBe(201);
      expect(res.body.affiliate.code).toBe("");
      expect(await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } })).toBeNull();
    }
  });

  it("keeps odd-looking real business names", async () => {
    const email = `bnb.${unique()}@example.com`;
    const res = await apply({ ...base(email), name: "BanffTravelHQ", formToken: oldToken() });
    expect(res.status).toBe(201);
    expect(res.body.affiliate.code).not.toBe("");
  });
});
