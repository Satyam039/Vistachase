// Bókun refuses a main-contact phone it can't read; bookings send E.164 or none.
import { describe, expect, it } from "vitest";
import { toE164 } from "@/lib/utils/phone-country";

describe("toE164", () => {
  it("cleans numbers that already have a country code", () => {
    expect(toE164("+1 213-278-8225")).toBe("+12132788225");
    expect(toE164("+91 (98765) 43210")).toBe("+919876543210");
    expect(toE164("0044 7700 900123")).toBe("+447700900123");
  });
  it("adds the guest's country code to a local number", () => {
    expect(toE164("098765 43210", "IN")).toBe("+919876543210");
    expect(toE164("07700 900123", "GB")).toBe("+447700900123");
    expect(toE164("919876543210", "IN")).toBe("+919876543210");
    expect(toE164("403 555 0100")).toBe("+14035550100");
  });
  it("drops the local 0 a guest types after the country code the checkout adds", () => {
    expect(toE164("+44 07700 900123", "GB")).toBe("+447700900123");
    expect(toE164("+91 09876543210", "IN")).toBe("+919876543210");
    expect(toE164("+61 0412 345 678")).toBe("+61412345678");
    expect(toE164("+49 0151 23456789", "DE")).toBe("+4915123456789");
    expect(toE164("+1 1 403 555 0100", "CA")).toBe("+14035550100");
    expect(toE164("+39 06 1234 5678", "IT")).toBe("+390612345678");
  });
  it("takes every country's code", () => {
    expect(toE164("+971 50 123 4567", "AE")).toBe("+971501234567");
    expect(toE164("+86 138 0013 8000", "CN")).toBe("+8613800138000");
    expect(toE164("+234 803 123 4567", "NG")).toBe("+2348031234567");
    expect(toE164("+55 11 91234 5678", "BR")).toBe("+5511912345678");
    expect(toE164("+299 32 1000")).toBe("+299321000"); // Greenland, not in the country list
  });
  it("gives up on what can't be a phone number", () => {
    expect(toE164("12345")).toBeNull();
    expect(toE164("")).toBeNull();
    expect(toE164("abc")).toBeNull();
    expect(toE164("98765")).toBeNull();
  });
});
