import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setBokunClientForTests, type BokunApi } from "@/modules/bokun/config";
import { getBokunBookingDetails, getBokunTourDetails } from "@/modules/bokun/bokun-concierge";
import { getMasterKnowledgeBase, syncMasterKnowledgeBase, crawlLiveWebsiteKnowledge } from "@/lib/ai/knowledge.sync";
import { renderCatalogKnowledge, tourDetail, tourCard } from "@/lib/ai/knowledge/catalog-live";
import { catalogEntry } from "@/lib/ai/knowledge/website-catalog";

class MockBokunApi {
  calls: { method: string; path: string; body?: any }[] = [];
  bookings: Record<string, any> = {};
  activities: Record<string, any> = {};

  api(): BokunApi {
    return {
      getAvailabilities: async () => [],
      fetch: async (method: string, path: string, body?: any) => {
        this.calls.push({ method, path, body });
        if (path.startsWith("/booking.json/booking-search")) {
          const ref = body?.externalBookingReference;
          const match = Object.values(this.bookings).find((b: any) => b.externalBookingReference === ref);
          return match ? { results: [match] } : { results: [] };
        }
        if (path.startsWith("/booking.json/booking/")) {
          const code = decodeURIComponent(path.split("/").pop()!);
          return this.bookings[code] ?? null;
        }
        if (path.startsWith("/activity.json/search")) {
          return { items: [{ id: 796650, title: "Banff & Yoho Discovery" }] };
        }
        if (path.startsWith("/activity.json/")) {
          const id = path.split("/")[2]?.split("?")[0];
          return this.activities[id] ?? null;
        }
        return null;
      },
    } as unknown as BokunApi;
  }
}

describe("Bókun Concierge Integration", () => {
  let mock: MockBokunApi;

  beforeEach(() => {
    mock = new MockBokunApi();
    setBokunClientForTests(mock.api());
  });

  afterEach(() => {
    setBokunClientForTests(null);
  });

  it("fetches booking details directly from Bókun by Bókun confirmation code", async () => {
    const code = "VistaChase-108972148";
    mock.bookings[code] = {
      confirmationCode: code,
      externalBookingReference: "VC-2026-D818D10B",
      status: "CONFIRMED",
      totalPrice: 440.0,
      currency: "CAD",
      customer: {
        firstName: "Satyam",
        lastName: "Pandey",
        email: "satyam@example.com",
        phoneNumber: "+18257349456",
      },
      activityBookings: [
        {
          title: "Banff & Yoho Discovery",
          status: "CONFIRMED",
          startDate: "2026-11-25",
          startTime: "08:00",
          totalParticipants: 2,
          pricingCategoryBookings: [
            {
              pricingCategory: { id: 1, title: "Adults" },
              bookedSeats: 2,
            },
          ],
          pickupPlace: {
            title: "Fairmont Banff Springs Hotel",
            address: "405 Spray Ave, Banff, AB T1L 1J4",
          },
          pickupPlaceDescription: "Main Lobby Entrance",
          pickupTime: "08:00",
          notes: "Guest requested front seats if possible.",
        },
      ],
    };

    const booking = await getBokunBookingDetails(code, "satyam@example.com", mock.api());
    expect(booking).not.toBeNull();
    expect(booking?.confirmationCode).toBe("VistaChase-108972148");
    expect(booking?.bookingReference).toBe("VC-2026-D818D10B");
    expect(booking?.status).toBe("CONFIRMED");
    expect(booking?.tourTitle).toBe("Banff & Yoho Discovery");
    expect(booking?.customerName).toBe("Satyam Pandey");
    expect(booking?.customerEmail).toBe("satyam@example.com");
    expect(booking?.departureDate).toBe("2026-11-25");
    expect(booking?.departureTime).toBe("08:00");
    expect(booking?.totalSeats).toBe(2);
    expect(booking?.passengerBreakdown).toContain("2 Adults");
    expect(booking?.pickupLocation).toContain("Main Lobby Entrance");
    expect(booking?.notes).toContain("front seats");
    expect(booking?.totalAmount).toBe(440);
    expect(booking?.source).toBe("BOKUN");
  });

  it("finds Bókun booking by VC- external reference via booking search", async () => {
    const vcRef = "VC-2026-D818D10B";
    const bokunCode = "VistaChase-998877";
    mock.bookings[bokunCode] = {
      confirmationCode: bokunCode,
      externalBookingReference: vcRef,
      status: "CONFIRMED",
      totalPrice: 199.0,
      currency: "CAD",
      customer: {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
      },
      activityBookings: [
        {
          title: "Winter Special Shared Tour",
          status: "CONFIRMED",
          startDate: "2026-12-15",
          startTime: "08:00",
          totalParticipants: 1,
          pickupPlace: { title: "Mount Royal Hotel" },
        },
      ],
    };

    const booking = await getBokunBookingDetails(vcRef, "jane@example.com", mock.api());
    expect(booking).not.toBeNull();
    expect(booking?.confirmationCode).toBe("VistaChase-998877");
    expect(booking?.bookingReference).toBe("VC-2026-D818D10B");
    expect(booking?.tourTitle).toBe("Winter Special Shared Tour");
  });

  it("refuses booking details when customer email does not match", async () => {
    const code = "VistaChase-108972148";
    mock.bookings[code] = {
      confirmationCode: code,
      customer: { email: "owner@example.com" },
      activityBookings: [{ title: "Private Tour" }],
    };

    const booking = await getBokunBookingDetails(code, "stranger@example.com", mock.api());
    expect(booking).toBeNull();
  });

  it("fetches tour activity details directly from Bókun API", async () => {
    const bokunId = "796650";
    mock.activities[bokunId] = {
      id: 796650,
      title: "Banff & Yoho Discovery Day Tour",
      excerpt: "Top rated small group Canadian Rockies tour.",
      description: "Full day tour including Lake Louise, Moraine Lake and Emerald Lake.",
      durationHours: 10,
      inclusions: ["Professional local guide", "Moraine Lake access", "Bottled water"],
      exclusions: ["Lunch", "Gratuities"],
      pricingCategories: [
        { id: 1, title: "Adult", minAge: 14 },
        { id: 2, title: "Child", minAge: 1, maxAge: 13 },
      ],
      bookingQuestions: [
        { id: "dietary", question: "Dietary restrictions", required: false },
        { id: "pickup_hotel", question: "Hotel Pickup Location", required: true },
      ],
      pickupPlaces: [{ title: "Banff Station" }, { title: "Fairmont Banff Springs" }],
      agendaItems: [{ title: "Lake Louise" }, { title: "Moraine Lake" }, { title: "Emerald Lake" }],
    };

    const tour = await getBokunTourDetails(bokunId, mock.api());
    expect(tour).not.toBeNull();
    expect(tour?.title).toBe("Banff & Yoho Discovery Day Tour");
    expect(tour?.duration).toBe("10 hours");
    expect(tour?.inclusions).toContain("Moraine Lake access");
    expect(tour?.exclusions).toContain("Lunch");
    expect(tour?.pricingCategories).toHaveLength(2);
    expect(tour?.bookingQuestions.some((q) => q.label === "Hotel Pickup Location")).toBe(true);
    expect(tour?.pickupPlaces).toContain("Banff Station");
    expect(tour?.stops).toContain("Lake Louise");
  });

  it("enriches tourDetail with live Bókun activity data", async () => {
    mock.activities["796650"] = {
      id: 796650,
      title: "Banff & Yoho Discovery",
      inclusions: ["Live Bókun Guide", "Moraine Lake Entry", "Cleats in Winter"],
      exclusions: ["Lunch"],
      pickupPlaces: [{ title: "Banff Station" }, { title: "Canmore Coast Hotel" }],
    };

    const detail = await tourDetail("banff-highlights-tour");
    expect(detail).not.toBeNull();
    expect(detail?.included).toContain("Live Bókun Guide");
    expect(detail?.pickup).toContain("Banff Station");
  });

  it("includes live booking fields, form requirements and mode changes in master knowledge base", async () => {
    const kb = await getMasterKnowledgeBase();
    expect(kb).toContain("Live Website Booking Fields & Form Requirements");
    expect(kb).toContain("Airport Transfers (Private Journeys & Multi-Day Packages)");
    expect(kb).toContain("Activity Add-Ons");
    expect(kb).toContain("Promo Codes & Vouchers");
    expect(kb).toContain("Payment Options");
    expect(kb).toContain("Lead Guest Information");
    expect(kb).toContain("Party Breakdown & Passenger Ages");
    expect(kb).toContain("All ages are welcome; there is NO minimum age restriction");
  });

  it("crawls live website knowledge or fallback with verified booking facts and lunch stops", async () => {
    const crawl = await crawlLiveWebsiteKnowledge();
    expect(crawl.crawledCount).toBeGreaterThan(0);
    expect(crawl.text).toContain("Banff & Yoho Discovery");
    expect(crawl.text).toContain("60-minute lunch stop");
  });
});
