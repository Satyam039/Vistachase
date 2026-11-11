import { describe, expect, it } from "vitest";
import { staffInbox } from "@/lib/email/staff-inbox";
import { looksLikeBotName } from "@/modules/enquiries/spam";

describe("staff inbox", () => {
  it("never sends to the non-existent info@ mailbox", () => {
    expect(staffInbox("info@vistachase.com")).toBe("support@vistachase.com");
    expect(staffInbox(" INFO@vistachase.com ", undefined)).toBe("support@vistachase.com");
    expect(staffInbox(undefined, "")).toBe("support@vistachase.com");
  });
  it("uses the first real configured address", () => {
    expect(staffInbox("info@vistachase.com", "team@vistachase.com")).toBe("team@vistachase.com");
    expect(staffInbox("bookings@example.com")).toBe("bookings@example.com");
  });
});

describe("enquiry bot names", () => {
  it("flags random mixed-case strings from the bounced enquiries", () => {
    expect(looksLikeBotName("SpvViyvvcPmWsQsxlpooZFKu")).toBe(true);
    expect(looksLikeBotName("CaofZYGaiXmTqWb")).toBe(true);
    expect(looksLikeBotName("cHXwtVPyDCAWVGSEFGhh")).toBe(true);
  });
  it("lets real names through", () => {
    for (const name of ["Alyssa Beck", "McDonald", "DeShawn", "Jean-Luc Picard", "Nishika", "MacKenzieMcLeod", "O'Brien", "Christopher", "Satyanarayana", "VanDerBerg", "ALEXANDERSON"]) {
      expect(looksLikeBotName(name)).toBe(false);
    }
  });
});
