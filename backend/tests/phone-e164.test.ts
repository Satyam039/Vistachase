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
  it("gives up on what can't be a phone number", () => {
    expect(toE164("12345")).toBeNull();
    expect(toE164("")).toBeNull();
    expect(toE164("abc")).toBeNull();
    expect(toE164("98765")).toBeNull();
  });
});
