import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  processBanffEliteEnquiry,
  clearBanffEliteSubmissionCache,
  BANFF_ELITE_SUCCESS_MESSAGE,
  BANFF_ELITE_FAILURE_MESSAGE,
  BANFF_ELITE_RECIPIENTS,
} from "@/modules/enquiries/banff-elite-enquiry";
import * as emailProviderModule from "@/lib/email/email.provider";

describe("Banff Elite Enquiry Handler", () => {
  beforeEach(() => {
    clearBanffEliteSubmissionCache();
    vi.restoreAllMocks();
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
});
