import { describe, it, expect } from "vitest";
import {
  isSyntheticBotName,
  isInvalidTripDate,
  isSpamMessage,
  isSpamBotEnquiry,
  isSuspiciousEmail,
  hasValidMxRecords,
} from "@/lib/security/spam-detector";

describe("Anti-Spam & Bot Detection Filter", () => {
  describe("isSyntheticBotName", () => {
    it("flags high-entropy single-token bot strings from spam logs", () => {
      expect(isSyntheticBotName("glZrgkquEiQCfXTR")).toBe(true);
      expect(isSyntheticBotName("AXaFtFEpdQ")).toBe(true);
      expect(isSyntheticBotName("AXaFTfE")).toBe(true);
      expect(isSyntheticBotName("qmthDEIps")).toBe(true);
      expect(isSyntheticBotName("qmthDEl")).toBe(true);
      expect(isSyntheticBotName("OvILdqz")).toBe(true);
      expect(isSyntheticBotName("gsXjSYTr")).toBe(true);
      expect(isSyntheticBotName("gsXjSYT")).toBe(true);
      expect(isSyntheticBotName("NuLBPir")).toBe(true);
      expect(isSyntheticBotName("UihzdGLr")).toBe(true);
      expect(isSyntheticBotName("cHXwtVPyDCAWVGSEFGhh")).toBe(true);
    });

    it("flags synthetic bot names even with multiple tokens", () => {
      expect(isSyntheticBotName("glZrgkquEi QCfXTR")).toBe(true);
      expect(isSyntheticBotName("NuLBPir Smith")).toBe(true);
    });

    it("allows legitimate customer names", () => {
      expect(isSyntheticBotName("Brandi Ferguson-Deitering")).toBe(false);
      expect(isSyntheticBotName("John Smith")).toBe(false);
      expect(isSyntheticBotName("Sarah Connor")).toBe(false);
      expect(isSyntheticBotName("Jean-Luc Picard")).toBe(false);
      expect(isSyntheticBotName("Satyam Pandey")).toBe(false);
      expect(isSyntheticBotName("Alice")).toBe(false);
      expect(isSyntheticBotName("Michael")).toBe(false);
    });
  });

  describe("isSuspiciousEmail", () => {
    it("flags dot-spam patterns and disposable email domains", () => {
      expect(isSuspiciousEmail("s.i.lb.iase@gmail.com")).toBe(true);
      expect(isSuspiciousEmail("spammer@mailinator.com")).toBe(true);
      expect(isSuspiciousEmail("bot@tempmail.com")).toBe(true);
      expect(isSuspiciousEmail("attacker@10minutemail.com")).toBe(true);
    });

    it("allows genuine customer email formats", () => {
      expect(isSuspiciousEmail("brandi@gmail.com")).toBe(false);
      expect(isSuspiciousEmail("john.smith@vistachase.com")).toBe(false);
      expect(isSuspiciousEmail("satyam.pandey@gmail.com")).toBe(false);
    });
  });

  describe("hasValidMxRecords", () => {
    it("handles test environment domain checks", async () => {
      expect(await hasValidMxRecords("nonexistent-test-domain.com")).toBe(false);
      expect(await hasValidMxRecords("gmail.com")).toBe(true);
    });
  });

  describe("isInvalidTripDate", () => {
    it("flags dates outside realistic travel windows such as Unix epoch 1970", () => {
      expect(isInvalidTripDate("1970-05-31")).toBe(true);
      expect(isInvalidTripDate("2010-01-01")).toBe(true);
      expect(isInvalidTripDate("2050-01-01")).toBe(true);
    });

    it("allows valid upcoming seasons", () => {
      expect(isInvalidTripDate("2026-07-15")).toBe(false);
      expect(isInvalidTripDate("2027-08-20")).toBe(false);
    });
  });

  describe("isSpamMessage", () => {
    it("flags pure numeric phone dumps", () => {
      expect(isSpamMessage("4154416877")).toBe(true);
      expect(isSpamMessage("+1 9460210696")).toBe(true);
    });

    it("allows legitimate questions and enquiries", () => {
      expect(isSpamMessage("Hi, we are a family of 4 looking to visit Lake Louise and Moraine Lake in July.")).toBe(false);
      expect(isSpamMessage("Can we arrange a private tour with airport pickup from Calgary?")).toBe(false);
    });
  });

  describe("isSpamBotEnquiry", () => {
    it("flags full bot payload matching the email bounce incident", () => {
      const spamPayload = {
        name: "glZrgkquEiQCfXTR",
        email: "s.i.lb.iase@gmail.com",
        phone: "+1 9460210696",
        date: "1970-05-31",
        toDate: "1970-05-31",
        guests: 49,
        message: "4154416877",
      };
      expect(isSpamBotEnquiry(spamPayload)).toBe(true);
    });

    it("flags honeypot submissions", () => {
      const honeypotPayload = {
        name: "John Smith",
        email: "john@example.com",
        message: "Legitimate looking inquiry text.",
        website: "https://spambot.com",
      };
      expect(isSpamBotEnquiry(honeypotPayload)).toBe(true);
    });

    it("passes legitimate customer enquiries", () => {
      const realPayload = {
        name: "Brandi Ferguson-Deitering",
        email: "brandi@example.com",
        phone: "+1 403 555 0199",
        date: "2026-07-20",
        toDate: "2026-07-22",
        guests: 4,
        message: "We would like to book a private tour for Banff and Yoho. Can you pick us up at The Malcolm Hotel?",
      };
      expect(isSpamBotEnquiry(realPayload)).toBe(false);
    });
  });
});
