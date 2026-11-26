// Partner approval with a hand-set commission and products, the partner agreement (contract) sent on
// approval, the application PDF, and partner change requests (owner, 2026-11-26).

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken } from "@/lib/auth/auth";
import { applyAffiliate } from "@/modules/affiliates/affiliate.repository";
import { resolveRule } from "@/modules/affiliates/commission";
import { applicationRecord, encryptBankDetails } from "@/modules/affiliates/partner-application";

const app = createApp();
const unique = () => Math.random().toString(36).slice(2, 8);
let adminCookie = "";

const cookieFor = (u: { id: string; email: string; role: string; name: string }) => `vc_token=${signToken({ userId: u.id, email: u.email, role: u.role as never, name: u.name })}`;

async function applicant() {
  const id = unique();
  const email = `contract-${id}@example.com`;
  const r = await applyAffiliate({
    name: `Rockies Travel ${id}`,
    contactName: "Jordan Agent",
    email,
    password: "a-long-password",
    type: "AGENCY",
    phone: "+1 403 555 0199",
    application: applicationRecord(
      {
        contactRole: "Owner",
        mailingAddress: "100 Banff Ave, Banff AB",
        websiteOrReference: "rockiestravel.example",
        workMode: "BOTH",
        authorize: true,
        signatureName: "Jordan Agent",
        tradingName: "Rockies Travel",
        hostAgency: undefined,
        authorizedSigner: undefined,
        statementEmail: undefined,
      },
      "203.0.113.9",
    ),
    payoutDetails: encryptBankDetails({
      beneficiaryName: "Rockies Travel Ltd",
      beneficiaryAddress: "100 Banff Ave",
      currency: "CAD",
      bankName: "Bank of Banff",
      branchAddress: "1 Main St",
      location: "CANADA",
      institutionNumber: "001",
      transitNumber: "12345",
      accountNumber: "9876543210",
    }),
  });
  if (!r.success) throw new Error("apply failed");
  const affiliate = await prisma.affiliate.findUniqueOrThrow({ where: { code: r.affiliate.code }, include: { user: true } });
  return { affiliate, cookie: cookieFor(affiliate.user) };
}

const pdfBody = (res: request.Response) => Buffer.from(res.body as Buffer).subarray(0, 5).toString("latin1");

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  adminCookie = cookieFor(admin);
});

describe("partner approval and contract", () => {
  it("won't approve without a commission chosen by staff", async () => {
    const { affiliate } = await applicant();
    const res = await request(app).patch(`/api/affiliates/admin/${affiliate.id}`).set("Cookie", adminCookie).send({ status: "ACTIVE" });
    expect(res.status).toBe(409);
    expect((await prisma.affiliate.findUniqueOrThrow({ where: { id: affiliate.id } })).status).toBe("PENDING");

    const missing = await request(app).post(`/api/affiliates/admin/${affiliate.id}/approve`).set("Cookie", adminCookie).send({ products: { all: true } });
    expect(missing.status).toBe(400);
    const noProducts = await request(app).post(`/api/affiliates/admin/${affiliate.id}/approve`).set("Cookie", adminCookie).send({ commissionPercent: 12, products: { all: false, categories: [], tourSlugs: [] } });
    expect(noProducts.status).toBe(400);

    // Staff adding an active partner by hand must set the rate too.
    const add = await request(app)
      .post("/api/affiliates/admin")
      .set("Cookie", adminCookie)
      .send({ name: "Walk-in Hotel", contactName: "Sam Desk", email: `walkin-${unique()}@example.com`, password: "a-long-password", type: "HOTEL", status: "ACTIVE" });
    expect(add.status).toBe(400);
  });

  it("approves with commission on chosen products, saves rules and a contract, and the partner can download it", async () => {
    const { affiliate, cookie } = await applicant();
    const draft = await request(app)
      .post(`/api/affiliates/admin/${affiliate.id}/contract/preview`)
      .set("Cookie", adminCookie)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      })
      .send({});
    expect(draft.status).toBe(200);
    expect(draft.headers["content-type"]).toMatch(/application\/pdf/);
    expect(pdfBody(draft)).toBe("%PDF-");

    const shuttle = await prisma.tour.findFirstOrThrow({ where: { category: "SHUTTLE" } });
    const priv = await prisma.tour.findFirstOrThrow({ where: { category: "PRIVATE" } });
    const shared = await prisma.tour.findFirstOrThrow({ where: { category: "SHARED" } });
    const approved = await request(app)
      .post(`/api/affiliates/admin/${affiliate.id}/approve`)
      .set("Cookie", adminCookie)
      .send({ commissionPercent: 12.5, products: { all: false, categories: ["SHUTTLE"], tourSlugs: [priv.slug, shuttle.slug] }, extraTerms: "Invoices monthly." });
    expect(approved.status).toBe(201);
    expect(approved.body).toMatchObject({ version: 1, sentTo: affiliate.user.email });

    const after = await prisma.affiliate.findUniqueOrThrow({ where: { id: affiliate.id } });
    expect(after.status).toBe("ACTIVE");
    expect(after.commissionSetAt).not.toBeNull();
    expect(after.commissionRate).toBe(0);

    // Commission follows the contract: 12.5% on shuttles and the chosen private tour, 0% elsewhere.
    expect((await resolveRule(prisma, after, { id: shuttle.id, category: "SHUTTLE" })).percentBps).toBe(1250);
    expect((await resolveRule(prisma, after, { id: priv.id, category: "PRIVATE" })).percentBps).toBe(1250);
    expect((await resolveRule(prisma, after, { id: shared.id, category: "SHARED" })).percentBps).toBe(0);

    const list = await request(app).get("/api/affiliates/admin").set("Cookie", adminCookie);
    const row = list.body.affiliates.find((p: { id: string }) => p.id === affiliate.id);
    expect(row.contract).toMatchObject({ version: 1, commissionPercent: 12.5 });
    expect(row.contract.products).toEqual(["Shuttles (all)", priv.title]);

    const mine = await request(app).get("/api/affiliates/me/contracts").set("Cookie", cookie);
    expect(mine.body.contracts).toHaveLength(1);
    const pdf = await request(app).get("/api/affiliates/me/contracts/1/pdf").set("Cookie", cookie);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toMatch(/application\/pdf/);

    // Another partner can't download it (their own version 1 doesn't exist).
    const other = await applicant();
    expect((await request(app).get("/api/affiliates/me/contracts/1/pdf").set("Cookie", other.cookie)).status).toBe(404);

    // Approving twice is refused; a new agreement replaces the old rules.
    expect((await request(app).post(`/api/affiliates/admin/${affiliate.id}/approve`).set("Cookie", adminCookie).send({ commissionPercent: 5, products: { all: true } })).status).toBe(409);
    const v2 = await request(app).post(`/api/affiliates/admin/${affiliate.id}/contract`).set("Cookie", adminCookie).send({ commissionPercent: 8, products: { all: true } });
    expect(v2.status).toBe(201);
    expect(v2.body.version).toBe(2);
    const now = await prisma.affiliate.findUniqueOrThrow({ where: { id: affiliate.id } });
    expect(now.commissionRate).toBeCloseTo(0.08);
    expect((await resolveRule(prisma, now, { id: shared.id, category: "SHARED" })).percentBps).toBe(800);
    expect((await resolveRule(prisma, now, { id: shuttle.id, category: "SHUTTLE" })).percentBps).toBe(800);
    const v1 = await prisma.affiliateContract.findUniqueOrThrow({ where: { affiliateId_version: { affiliateId: affiliate.id, version: 1 } } });
    expect(await prisma.commissionRule.count({ where: { id: { in: v1.ruleIds }, active: true } })).toBe(0);

    // Partners can't use the admin routes.
    expect((await request(app).post(`/api/affiliates/admin/${affiliate.id}/contract`).set("Cookie", cookie).send({ commissionPercent: 50, products: { all: true } })).status).toBe(403);
  });

  it("gives the team the application as a PDF; full bank details only on request and audited", async () => {
    const { affiliate, cookie } = await applicant();
    const masked = await request(app).get(`/api/affiliates/admin/${affiliate.id}/application/pdf`).set("Cookie", adminCookie);
    expect(masked.status).toBe(200);
    expect(masked.headers["content-type"]).toMatch(/application\/pdf/);
    expect(masked.headers["content-disposition"]).toContain(`partner-application-${affiliate.code}.pdf`);
    const full = await request(app).get(`/api/affiliates/admin/${affiliate.id}/application/pdf?bank=1`).set("Cookie", adminCookie);
    expect(full.status).toBe(200);
    expect(await prisma.auditLog.count({ where: { entityId: affiliate.id, action: "PARTNER_BANK_DETAILS_VIEWED" } })).toBe(1);
    expect((await request(app).get(`/api/affiliates/admin/${affiliate.id}/application/pdf`).set("Cookie", cookie)).status).toBe(403);
  });
});

describe("partner change requests", () => {
  it("a partner sends a request, staff answer it, and only that partner sees it", async () => {
    const { affiliate, cookie } = await applicant();
    await prisma.affiliate.update({ where: { id: affiliate.id }, data: { status: "ACTIVE" } });
    const bad = await request(app).post("/api/affiliates/me/requests").set("Cookie", cookie).send({ category: "COUPON", subject: "Hi", details: "short" });
    expect(bad.status).toBe(400);
    const sent = await request(app)
      .post("/api/affiliates/me/requests")
      .set("Cookie", cookie)
      .send({ category: "COUPON", subject: "Coupon for our guests", details: "Could we get a 10% code for shared tours this winter?", bookingReference: "vc-2026-298f61bd" });
    expect(sent.status).toBe(201);
    expect(sent.body.request).toMatchObject({ status: "OPEN", bookingReference: "VC-2026-298F61BD", categoryLabel: "Coupon code" });

    const other = await applicant();
    expect((await request(app).get("/api/affiliates/me/requests").set("Cookie", other.cookie)).body.requests).toHaveLength(0);
    expect((await request(app).get("/api/affiliates/admin/requests").set("Cookie", cookie)).status).toBe(403);

    const staffList = await request(app).get("/api/affiliates/admin/requests?status=OPEN").set("Cookie", adminCookie);
    const row = staffList.body.requests.find((r: { id: string }) => r.id === sent.body.request.id);
    expect(row.partner).toMatchObject({ id: affiliate.id, code: affiliate.code });

    const done = await request(app).patch(`/api/affiliates/admin/requests/${row.id}`).set("Cookie", adminCookie).send({ status: "DONE", staffNote: "WINTER10 is in your Coupons tab." });
    expect(done.status).toBe(200);
    const mine = await request(app).get("/api/affiliates/me/requests").set("Cookie", cookie);
    expect(mine.body.requests[0]).toMatchObject({ status: "DONE", staffNote: "WINTER10 is in your Coupons tab." });
    expect(mine.body.requests[0].resolvedAt).not.toBeNull();
  });
});
