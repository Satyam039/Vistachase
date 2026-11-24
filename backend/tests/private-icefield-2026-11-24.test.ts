import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import { createBooking } from "@/modules/bookings/booking.repository";
import { activitiesSummary } from "@/modules/bookings/package-activities";
import { activityParticipantsError, combinedAddOnNote } from "@/modules/bookings/activity-add-ons";
import { partySizeError } from "@/modules/pricing/departure-pricing";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

// Private Columbia Icefield Adventure (owner's checklist, 2026-11-24): up to 14 guests, and Ice
// Explorer + Skywalk as one combined ticket request for a number of participants, summer only,
// recorded for staff and invoiced separately (never added to the tour payment).

async function departure(slug: string, date: string, price = 175000) {
  const tour = await prisma.tour.findUniqueOrThrow({ where: { slug } });
  return prisma.tourDeparture.create({
    data: { inventorySource: "LOCAL", tourId: tour.id, date: dateOnly(date), departureTime: timeOfDay("08:00"), capacityTotal: 13, capacityBooked: 0, capacityHeld: 0, price, status: "ACTIVE" },
  });
}

const guest = (email: string, departureId: string, extra: Record<string, unknown> = {}) => ({
  departureId,
  customerName: "Icefield Group",
  customerEmail: email,
  customerPhone: "+1 403 555 0177",
  adultsCount: 14,
  childrenCount: 0,
  infantsCount: 0,
  ...extra,
});

describe("Private Columbia Icefield Adventure", () => {
  it("takes up to 14 guests in the van; other private day tours keep their seats", () => {
    const dep = (slug: string) => ({ price: 1, capacityTotal: 13, tour: { category: "PRIVATE", slug } });
    expect(partySizeError(dep("icefields-jasper-private-tour"), 14)).toBeNull();
    expect(partySizeError(dep("icefields-jasper-private-tour"), 15)).toMatch(/up to 14/);
    expect(partySizeError(dep("banff-private-tour"), 14)).toMatch(/up to 13/);
  });

  it("checks the participant count against the group size", () => {
    expect(activityParticipantsError(["ice-explorer-skywalk"], undefined, 6)).toMatch(/how many guests/);
    expect(activityParticipantsError(["ice-explorer-skywalk"], 7, 6)).toMatch(/up to 6 guests/);
    expect(activityParticipantsError(["ice-explorer-skywalk"], 6, 6)).toBeNull();
    expect(activityParticipantsError([], undefined, 6)).toBeNull();
    expect(combinedAddOnNote("ice-explorer-skywalk", 4, 9)).toMatch(/^TICKET REQUEST \(not a confirmed reservation\): Ice Explorer \+ Skywalk .* for 4 of 9 guests\. .*separate invoice/);
  });

  it("books 14 guests and records the combined ticket request for staff, not charged", async () => {
    const dep = await departure("icefields-jasper-private-tour", "2029-07-14");
    const result = await createBooking(
      guest("pcia.request@example.com", dep.id, { activityAddOns: ["ice-explorer-skywalk"], activityParticipants: 5 }),
    );
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    const booking = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: result.booking.bookingReference } });
    expect(booking.totalSeats).toBe(14);
    expect(booking.totalAmount).toBe(175000); // the van price only: tickets are invoiced separately
    expect(booking.specialRequests).toContain("TICKET REQUEST (not a confirmed reservation): Ice Explorer + Skywalk (combined experience) for 5 of 14 guests");
    const snap = booking.priceSnapshot as { activityAddOns: { id: string; status: string; participants: number; invoicedSeparately: boolean; priceCents: null }[] };
    expect(snap.activityAddOns).toEqual([
      { id: "ice-explorer-skywalk", name: "Ice Explorer + Skywalk (combined experience)", priceCents: null, status: "REQUESTED", participants: 5, invoicedSeparately: true },
    ]);
    expect(activitiesSummary(booking.priceSnapshot)).toBe(
      "Ice Explorer + Skywalk (combined experience): ticket request for 5 guests (not yet a confirmed reservation; tickets invoiced separately)",
    );
  });

  it("refuses more participants than the group, separate attractions, winter dates and a 15th guest", async () => {
    const summer = await departure("icefields-jasper-private-tour", "2029-07-21");
    const tooMany = await createBooking(guest("pcia.too.many@example.com", summer.id, { adultsCount: 4, activityAddOns: ["ice-explorer-skywalk"], activityParticipants: 5 }));
    expect(tooMany.error).toMatch(/up to 4 guests/);
    const separate = await createBooking(guest("pcia.separate@example.com", summer.id, { activityAddOns: ["ice-explorer"] }));
    expect(separate.error).toMatch(/can't be added/);
    const fifteen = await createBooking(guest("pcia.fifteen@example.com", summer.id, { adultsCount: 15 }));
    expect(fifteen.error).toMatch(/up to 14 guests/);
    const winter = await departure("icefields-jasper-private-tour", "2029-01-20", 124000);
    const winterRequest = await createBooking(guest("pcia.winter@example.com", winter.id, { activityAddOns: ["ice-explorer-skywalk"], activityParticipants: 2 }));
    expect(winterRequest.error).toMatch(/can't be added/);
  });
});
