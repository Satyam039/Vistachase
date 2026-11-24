import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { issueFormToken } from "@/modules/enquiries/spam";
import {
  processBanffEliteEnquiry,
  clearBanffEliteSubmissionCache,
  BANFF_ELITE_SUCCESS_MESSAGE,
  BANFF_ELITE_FAILURE_MESSAGE,
  BANFF_ELITE_RECIPIENTS,
} from "@/modules/enquiries/banff-elite-enquiry";
import * as emailProviderModule from "@/lib/email/email.provider";

describe("Banff Elite Enquiry Handler", () => {
  const savedEnv = { provider: process.env.EMAIL_PROVIDER, key: process.env.RESEND_API_KEY };
  beforeEach(() => {
    clearBanffEliteSubmissionCache();
    vi.restoreAllMocks();
    // A real provider is configured (the email itself is mocked below).
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test";
  });
  afterEach(() => {
    process.env.EMAIL_PROVIDER = savedEnv.provider;
    process.env.RESEND_API_KEY = savedEnv.key;
    if (savedEnv.provider === undefined) delete process.env.EMAIL_PROVIDER;
    if (savedEnv.key === undefined) delete process.env.RESEND_API_KEY;
  });

  it("validates required contact information: name, email, and phone with country code", async () => {
    // Missing all fields
    const res1 = await processBanffEliteEnquiry({});
    expect(res1.success).toBe(false);
    expect(res1.status).toBe(400);
    expect(res1.fields).toHaveProperty("name");
    expect(res1.fields).toHaveProperty("email");
    expect(res1.fields).toHaveProperty("phone");

    // Invalid email
    const res2 = await processBanffEliteEnquiry({
      name: "John Doe",
      email: "not-an-email",
      phone: "+1 403 555 1234",
    });
    expect(res2.success).toBe(false);
    expect(res2.fields).toHaveProperty("email");

    // Phone without enough digits
    const res3 = await processBanffEliteEnquiry({
      name: "John Doe",
      email: "john@example.com",
      phone: "123",
    });
    expect(res3.success).toBe(false);
    expect(res3.fields).toHaveProperty("phone");
  });

  it("successfully processes valid enquiry and dispatches email to both Vista Chase and Banff Elite", async () => {
    const mockSendEmail = vi.fn().mockResolvedValue({ success: true, id: "email-test-123" });
    vi.spyOn(emailProviderModule, "getEmailProvider").mockReturnValue({
      sendEmail: mockSendEmail,
    } as any);

    const payload = {
      name: "Elizabeth Bennet",
      email: "elizabeth@example.com",
      phone: "+1 (825) 555-0199",
      guests: 4,
      travelDates: "July 15 - July 20, 2027",
      tourDays: 3,
      placesOfInterest: "Lake Louise, Moraine Lake, Icefields Parkway",
      preferredVehicle: "luxury SUV",
      paceAndRequests: "Relaxed photography pace, travelling with elderly parents.",
    };

    const result = await processBanffEliteEnquiry(payload);
    expect(result.success).toBe(true);
    expect(result.message).toBe(BANFF_ELITE_SUCCESS_MESSAGE);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const emailArgs = mockSendEmail.mock.calls[0][0];
    expect(emailArgs.to).toEqual(BANFF_ELITE_RECIPIENTS);
    expect(emailArgs.replyTo).toBe("elizabeth@example.com");
    expect(emailArgs.subject).toContain("Elizabeth Bennet");
    expect(emailArgs.text).toContain("Elizabeth Bennet");
    expect(emailArgs.text).toContain("luxury SUV");
    expect(emailArgs.text).toContain("Scope is tours only; hotels and restaurants are not arranged.");
  });

  it("handles duplicate submissions within deduplication window", async () => {
    const mockSendEmail = vi.fn().mockResolvedValue({ success: true, id: "email-test-123" });
    vi.spyOn(emailProviderModule, "getEmailProvider").mockReturnValue({
      sendEmail: mockSendEmail,
    } as any);

    const payload = {
      name: "Mr. Darcy",
      email: "darcy@example.com",
      phone: "+44 20 7946 0991",
      preferredVehicle: "luxury van",
    };

    const first = await processBanffEliteEnquiry(payload);
    expect(first.success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    // Second submission with same details
    const second = await processBanffEliteEnquiry(payload);
    expect(second.success).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(second.message).toBe(BANFF_ELITE_SUCCESS_MESSAGE);
    // Should not send email twice
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("returns failure message if email service fails", async () => {
    const mockSendEmail = vi.fn().mockResolvedValue({ success: false });
    vi.spyOn(emailProviderModule, "getEmailProvider").mockReturnValue({
      sendEmail: mockSendEmail,
    } as any);

    const payload = {
      name: "Jane Bennet",
      email: "jane@example.com",
      phone: "+1 825 555 0100",
    };

    const result = await processBanffEliteEnquiry(payload);
    expect(result.success).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBe(BANFF_ELITE_FAILURE_MESSAGE);
  });

  it("never says 'sent' when no email provider is set up (the console provider only logs)", async () => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;
    const mockSendEmail = vi.fn().mockResolvedValue({ success: true });
    vi.spyOn(emailProviderModule, "getEmailProvider").mockReturnValue({ sendEmail: mockSendEmail } as any);
    const result = await processBanffEliteEnquiry({ name: "Anne Shirley", email: `anne.${Date.now()}@example.com`, phone: "+1 902 555 0101" });
    expect(result.success).toBe(false);
    expect(result.error).toBe(BANFF_ELITE_FAILURE_MESSAGE);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("still spots a repeat after the API restarts (saved enquiry), and ignores a new client key per click", async () => {
    const mockSendEmail = vi.fn().mockResolvedValue({ success: true });
    vi.spyOn(emailProviderModule, "getEmailProvider").mockReturnValue({ sendEmail: mockSendEmail } as any);
    const payload = { name: "Gilbert Blythe", email: `gilbert.${Date.now()}@example.com`, phone: "+1 902 555 0102", travelDates: "August 2027" };
    const first = await processBanffEliteEnquiry({ ...payload, idempotencyKey: "be_1" });
    expect(first.success).toBe(true);
    clearBanffEliteSubmissionCache(); // what a restart does to the in-memory cache
    const again = await processBanffEliteEnquiry({ ...payload, idempotencyKey: "be_2" });
    expect(again).toMatchObject({ success: true, duplicate: true, message: BANFF_ELITE_SUCCESS_MESSAGE, enquiryId: first.enquiryId });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(await prisma.enquiry.count({ where: { email: payload.email } })).toBe(1);
  });

  it("sends a double click once, but changed details as a new enquiry", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const mockSendEmail = vi.fn().mockImplementation(async () => {
      await gate;
      return { success: true };
    });
    vi.spyOn(emailProviderModule, "getEmailProvider").mockReturnValue({ sendEmail: mockSendEmail } as any);
    const payload = { name: "Diana Barry", email: `diana.${Date.now()}@example.com`, phone: "+1 902 555 0103" };
    const a = processBanffEliteEnquiry(payload);
    const b = processBanffEliteEnquiry(payload);
    release();
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.success && rb.success).toBe(true);
    expect(rb.duplicate).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const changed = await processBanffEliteEnquiry({ ...payload, guests: 6 });
    expect(changed.duplicate).toBeUndefined();
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
  });

  describe("website form spam guard (POST /api/enquiries/banff-elite)", () => {
    const app = createApp();
    const ip = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
    const post = (body: Record<string, unknown>) => request(app).post("/api/enquiries/banff-elite").set("X-Forwarded-For", ip()).send(body);
    const guest = () => ({ name: "Marilla Cuthbert", email: `marilla.${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.com`, phone: "+1 902 555 0104" });
    const oldToken = () => issueFormToken(Date.now() - 5_000);

    it("sends a real enquiry that has the form's token", async () => {
      const mockSendEmail = vi.fn().mockResolvedValue({ success: true });
      vi.spyOn(emailProviderModule, "getEmailProvider").mockReturnValue({ sendEmail: mockSendEmail } as any);
      const res = await post({ ...guest(), formToken: oldToken() });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, message: BANFF_ELITE_SUCCESS_MESSAGE });
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });

    it("quietly drops bots: no token, forged token, honeypot filled, random name", async () => {
      const mockSendEmail = vi.fn().mockResolvedValue({ success: true });
      vi.spyOn(emailProviderModule, "getEmailProvider").mockReturnValue({ sendEmail: mockSendEmail } as any);
      for (const body of [
        { ...guest() },
        { ...guest(), formToken: "123.forged" },
        { ...guest(), formToken: oldToken(), website: "http://spam.example" },
        { ...guest(), name: "xKqTzWvBnRmLp", formToken: oldToken() },
      ]) {
        const res = await post(body);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      }
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("asks a person who was too quick to try again", async () => {
      const mockSendEmail = vi.fn().mockResolvedValue({ success: true });
      vi.spyOn(emailProviderModule, "getEmailProvider").mockReturnValue({ sendEmail: mockSendEmail } as any);
      const res = await post({ ...guest(), formToken: issueFormToken() });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, error: BANFF_ELITE_FAILURE_MESSAGE, retry: true });
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("still reports field errors for a real person", async () => {
      const res = await post({ name: "Matthew Cuthbert", email: "not-an-email", phone: "1", formToken: oldToken() });
      expect(res.status).toBe(400);
      expect(res.body.fields).toHaveProperty("email");
      expect(res.body.fields).toHaveProperty("phone");
    });
  });
});
