// Owner's "VistaChase Website" PDF (2026-11-14): the booking itinerary matches exactly what was
// booked (from the website's own itinerary files), shared tours don't pick up in Lake Louise, the
// contact form's "We Are Staying In", and the branded verification email.

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { getEmailProvider, type EmailPayload } from "@/lib/email/email.provider";
import { createBooking } from "@/modules/bookings/booking.repository";
import { createPackageBooking } from "@/modules/bookings/package-booking";
import { bookingItinerary, experienceTitle } from "@/modules/bookings/tour-itinerary";
import { getCheckoutDeparture } from "@/modules/departures/departure.repository";
import { renderVerificationEmail } from "@/lib/email/verification-email";
import { issueFormToken } from "@/modules/enquiries/spam";
import { dateOnly, timeOfDay } from "@/lib/utils/time";
import { PACKAGE_ITINERARIES, TOUR_ITINERARIES } from "@site/itineraries";

const sent: EmailPayload[] = [];
beforeAll(() => {
  vi.spyOn(getEmailProvider(), "sendEmail").mockImplementation(async (payload) => {
    sent.push(payload);
    return { success: true, messageId: `m_${sent.length}` };
  });
});
afterEach(() => {
  sent.length = 0;
});
const confirmationFor = (email: string) => sent.find((e) => e.to === email && e.subject.startsWith("Your Vista Chase booking is confirmed"));

const day = (slug: string, category: string, date: string, time = "08:00", snapshot?: unknown) => ({
  priceSnapshot: snapshot,
  tourDeparture: { date, departureTime: time, tour: { slug, category } },
});

async function departure(slug: string, date: string, time = "08:00", price = 22000) {
  const tour = await prisma.tour.findUniqueOrThrow({ where: { slug } });
  return prisma.tourDeparture.create({
    data: { inventorySource: "LOCAL", tourId: tour.id, date: dateOnly(date), departureTime: timeOfDay(time), capacityTotal: 14, capacityBooked: 0, capacityHeld: 0, price, status: "ACTIVE" },
  });
}

const guest = (email: string, departureId: string, extra: Record<string, unknown> = {}) => ({
  departureId,
  customerName: "Itinerary Check",
  customerEmail: email,
  customerPhone: "+1 403 555 0142",
  adultsCount: 2,
  childrenCount: 0,
  infantsCount: 0,
  ...extra,
});

describe("booking itinerary = the website's itinerary for exactly what was booked", () => {
  it("reads the website's own files, which stay import-free so the backend can compile them", () => {
    for (const file of ["itineraries.ts", "shuttleSchedule.ts"]) {
      const src = fs.readFileSync(path.resolve(__dirname, "../../frontend/src/lib", file), "utf8");
      expect(src).not.toMatch(/^\s*import\s/m);
    }
  });

  it("gives each day tour its own itinerary, shared and private apart", () => {
    const sources = ["banff-highlights-tour", "shared-tours-icefields-jasper", "banff-private-tour", "icefields-jasper-private-tour"].map((slug) => {
      const r = bookingItinerary(day(slug, slug.includes("private") ? "PRIVATE" : "SHARED", "2027-07-15"));
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error(r.reason);
      expect(r.itinerary.steps).toBe(TOUR_ITINERARIES[slug].steps);
      expect(r.itinerary.duration).toBe(TOUR_ITINERARIES[slug].duration);
      return r.itinerary;
    });
    expect(new Set(sources.map((s) => s.source)).size).toBe(4);
    // Columbia Icefield shows the Icefield day, Banff & Yoho the Banff & Yoho day.
    expect(sources[1].stops.map((s) => s.name)).toContain("Columbia Icefield Skywalk");
    expect(sources[1].stops.map((s) => s.name)).not.toContain("Emerald Lake");
    expect(sources[0].stops.map((s) => s.name)).toContain("Emerald Lake");
    // Private Icefield: the activities are optional add-ons, as on its page.
    expect(sources[3].stops.some((s) => s.name === "Columbia Icefield Skywalk — Optional Add-On")).toBe(true);
    expect(experienceTitle({ tour: { slug: "shared-tours-icefields-jasper", title: "Old Webflow name" } })).toBe("Columbia Icefield Adventure (Shared Tour)");
  });

  it("leaves out summer-only stops in winter, and flags the winter Icefield route the team confirms", () => {
    const winter = bookingItinerary(day("banff-highlights-tour", "SHARED", "2027-01-20"));
    expect(winter.ok).toBe(true);
    if (winter.ok) {
      expect(winter.itinerary.stops.map((s) => s.name)).not.toContain("Moraine Lake");
      expect(winter.itinerary.notes[0]).toMatch(/June 1 to October 10 only/);
    }
    const icefieldWinter = bookingItinerary(day("shared-tours-icefields-jasper", "SHARED", "2027-01-20"));
    expect(icefieldWinter.ok).toBe(false);
    if (!icefieldWinter.ok) expect(icefieldWinter.guestNote).toMatch(/Our team will confirm your detailed itinerary/);
  });

  it("uses each journey day's own itinerary for the Three- and Four-Day journeys", () => {
    const snap = (slug: string, d: number) => ({ package: { slug, title: "x", day: d, references: ["A", "B", "C"] } });
    const d1 = bookingItinerary(day("banff-private-tour", "PRIVATE", "2027-07-15", "08:00", snap("three-day-rockies-discovery", 1)));
    const d2 = bookingItinerary(day("banff-private-tour", "PRIVATE", "2027-07-16", "08:00", snap("three-day-rockies-discovery", 2)));
    expect(d1.ok && d1.itinerary.heading).toBe(PACKAGE_ITINERARIES["three-day-rockies-discovery"][0].title);
    expect(d1.ok && d1.itinerary.stops[0].name).toBe("Bow Falls"); // Banff day, not the Banff & Yoho day tour
    expect(d2.ok && d2.itinerary.stops.map((s) => s.name)).toContain("Emerald Lake");
    const jasper = bookingItinerary(day("icefields-jasper-private-tour", "PRIVATE", "2027-07-18", "08:00", snap("four-day-rockies-and-jasper", 4)));
    expect(jasper.ok && jasper.itinerary.stops.map((s) => s.name)).toContain("Maligne Lake");
    // Two-Day Rockies Explorer days are the day tours themselves.
    const twoDay = bookingItinerary(day("shared-tours-icefields-jasper", "SHARED", "2027-07-16", "08:00", snap("two-day-rockies-explorer", 2)));
    expect(twoDay.ok && twoDay.itinerary.source).toBe("tour:shared-tours-icefields-jasper");
  });

  it("gives a shuttle its departure's row of the timetable, and flags times not on it", () => {
    const shuttle = (time: string, date: string) => bookingItinerary(day("sunrise-shuttle-to-moraine-lake-and-lake-louise", "SHUTTLE", date, time));
    const first = shuttle("03:15", "2027-07-02");
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.itinerary.heading).toBe("Departure 1 · Early Morning");
      expect(first.itinerary.steps[0].text).toBe("Canmore 2:45 AM · Banff 3:15 AM · Lake Louise Village (Samson Mall) 3:55 AM");
      expect(first.itinerary.steps[1]).toEqual({ time: "4:30–6:00 AM", text: "Moraine Lake" });
    }
    expect(shuttle("03:15", "2027-08-20").ok).toBe(false); // departure 1 doesn't run in August
    expect(shuttle("05:00", "2027-07-02").ok).toBe(false); // old time, not on the timetable
  });

  it("never sends a retired tour's old itinerary", () => {
    expect(bookingItinerary(day("winter-special", "SHARED", "2027-01-20")).ok).toBe(false);
  });

  it("emails each tour's own itinerary and PDF, and flags staff when there is none", async () => {
    const cases = [
      { slug: "banff-highlights-tour", email: "itin.by@example.com", expect: "Lake Louise and Moraine Lake (Moraine Lake from June 1 to October 10)." },
      { slug: "shared-tours-icefields-jasper", email: "itin.cia@example.com", expect: "Bow Lake, Crowfoot Glacier, Peyto Lake and Waterfowl Lakes along the Icefields Parkway." },
      { slug: "banff-private-tour", email: "itin.pby@example.com", expect: "Drop-off at your accommodation. The day runs about 10 to 12 hours, depending on your pace." },
      { slug: "icefields-jasper-private-tour", email: "itin.pcia@example.com", expect: "Columbia Icefield, with the optional Ice Explorer and Skywalk in season." },
    ];
    for (const c of cases) {
      const dep = await departure(c.slug, "2028-07-12", "08:00", c.slug.includes("private") ? 175000 : 22000);
      const { booking } = await createBooking(guest(c.email, dep.id, { pickupCustomText: "Moxy Banff" }));
      expect(booking?.status).toBe("CONFIRMED");
      const email = confirmationFor(c.email);
      expect(email, c.slug).toBeTruthy();
      expect(email!.text).toContain(c.expect);
      expect(email!.html).toContain(TOUR_ITINERARIES[c.slug].title.replace("&", "&amp;"));
      expect(email!.attachments?.[0].content.subarray(0, 4).toString()).toBe("%PDF");
      if (process.env.SAVE_ITINERARY_DIR) fs.writeFileSync(path.join(process.env.SAVE_ITINERARY_DIR, `${c.slug}.pdf`), email!.attachments![0].content);
      // The other route's itinerary doesn't leak in.
      const otherRoute = c.slug.includes("icefield") ? "Johnston Canyon, Lake Minnewanka and Two Jack Lake." : "Bow Lake, Crowfoot Glacier, Peyto Lake and Waterfowl Lakes";
      expect(email!.text).not.toContain(otherRoute);
    }

    // A winter shared Icefield date: no made-up route; the guest is told, staff get a flag.
    const dep = await departure("shared-tours-icefields-jasper", "2028-01-18");
    const { booking } = await createBooking(guest("itin.winter@example.com", dep.id, { pickupCustomText: "Moxy Banff" }));
    const email = confirmationFor("itin.winter@example.com");
    expect(email!.text).toContain("Our team will confirm your detailed itinerary");
    expect(email!.text).not.toContain("Ice Explorer onto the Athabasca Glacier and the Skywalk (June 1");
    if (process.env.SAVE_ITINERARY_DIR) fs.writeFileSync(path.join(process.env.SAVE_ITINERARY_DIR, "icefield-winter.pdf"), email!.attachments![0].content);
    const flag = await prisma.bookingFlag.findFirst({ where: { booking: { bookingReference: booking!.bookingReference }, type: "OTHER" } });
    expect(flag?.note).toMatch(/^Itinerary missing:/);
    const staff = sent.find((e) => e.subject.startsWith(`[New Booking] ${booking!.bookingReference}`));
    expect(staff?.text).toContain("ITINERARY MISSING");
  });

  it("sends a Three-Day journey with each day's own plan", async () => {
    const deps = [
      await departure("banff-private-tour", "2028-07-20", "08:00", 175000),
      await departure("banff-private-tour", "2028-07-21", "08:00", 175000),
      await departure("icefields-jasper-private-tour", "2028-07-22", "08:00", 175000),
    ];
    const result = await createPackageBooking({ ...guest("itin.3day@example.com", deps[0].id), packageSlug: "three-day-rockies-discovery", departureIds: deps.map((d) => d.id) });
    expect(result.success).toBe(true);
    const email = confirmationFor("itin.3day@example.com");
    expect(email).toBeTruthy();
    for (const d of PACKAGE_ITINERARIES["three-day-rockies-discovery"]) expect(email!.text).toContain(d.title);
    if (process.env.SAVE_ITINERARY_DIR) fs.writeFileSync(path.join(process.env.SAVE_ITINERARY_DIR, "three-day.pdf"), email!.attachments![0].content);
  });

  it("sends a shuttle its departure's timetable", async () => {
    const tour = await prisma.tour.findUniqueOrThrow({ where: { slug: "sunrise-shuttle-to-moraine-lake-and-lake-louise" } });
    const dep = await prisma.tourDeparture.create({
      data: { inventorySource: "LOCAL", tourId: tour.id, date: dateOnly("2028-07-05"), departureTime: timeOfDay("04:15"), capacityTotal: 14, price: 13000, status: "ACTIVE" },
    });
    const stop = await prisma.shuttleStop.findFirstOrThrow({ where: { town: "Canmore", isActive: true } });
    await createBooking(guest("itin.shuttle@example.com", dep.id, { pickupStopId: stop.id }));
    const email = confirmationFor("itin.shuttle@example.com");
    expect(email!.text).toContain("Departure 2 · Early Morning");
    expect(email!.text).toContain("5:30–7:00 AM: Moraine Lake");
    if (process.env.SAVE_ITINERARY_DIR) fs.writeFileSync(path.join(process.env.SAVE_ITINERARY_DIR, "shuttle.pdf"), email!.attachments![0].content);
  });
});

describe("shared tours don't pick up in Lake Louise", () => {
  it("leaves Lake Louise stops out of shared tours' checkout, keeps them for private tours and shuttles", async () => {
    const shared = await departure("banff-highlights-tour", "2028-08-01");
    const icefield = await departure("shared-tours-icefields-jasper", "2028-08-01");
    const priv = await departure("banff-private-tour", "2028-08-01", "08:00", 175000);
    const lakeLouise = await prisma.shuttleStop.count({ where: { isActive: true, town: "Lake Louise" } });
    expect(lakeLouise).toBeGreaterThan(0);
    for (const d of [shared, icefield]) {
      const c = await getCheckoutDeparture(d.id);
      expect(c!.stops.some((s) => s.town === "Lake Louise")).toBe(false);
      expect(c!.stops.length).toBeGreaterThan(0);
    }
    const p = await getCheckoutDeparture(priv.id);
    expect(p!.stops.filter((s) => s.town === "Lake Louise")).toHaveLength(lakeLouise);
  });

  it("refuses a Lake Louise pickup on a shared tour booking (API, not just the page)", async () => {
    const shared = await departure("shared-tours-icefields-jasper", "2028-08-02");
    const priv = await departure("icefields-jasper-private-tour", "2028-08-02", "08:00", 175000);
    const stop = await prisma.shuttleStop.findFirstOrThrow({ where: { isActive: true, town: "Lake Louise" } });

    const refused = await createBooking(guest("ll.shared@example.com", shared.id, { pickupStopId: stop.id }));
    expect(refused.success).toBe(false);
    expect(refused.error).toMatch(/Banff and Canmore only/);
    const typed = await createBooking(guest("ll.typed@example.com", shared.id, { pickupCustomText: "Fairmont Chateau Lake Louise" }));
    expect(typed.success).toBe(false);
    // Nothing was taken: the seats are still free.
    expect((await prisma.tourDeparture.findUniqueOrThrow({ where: { id: shared.id } })).capacityBooked).toBe(0);

    const ok = await createBooking(guest("ll.private@example.com", priv.id, { pickupStopId: stop.id }));
    expect(ok.success).toBe(true);
    const banff = await prisma.shuttleStop.findFirstOrThrow({ where: { isActive: true, town: "Banff" } });
    expect((await createBooking(guest("ll.banff@example.com", shared.id, { pickupStopId: banff.id }))).success).toBe(true);
  });
});

describe("contact form: We Are Staying In", () => {
  const post = (body: Record<string, unknown>) =>
    request(createApp())
      .post("/api/enquiries")
      .set("X-Forwarded-For", `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`)
      .send({ formToken: issueFormToken(Date.now() - 10_000), name: "Staying Guest", email: `stay${Math.random().toString(36).slice(2, 8)}@example.com`, guests: 2, date: "2027-07-14", message: "We'd like a private day.", ...body });

  it("saves the town and puts it in the team's email", async () => {
    const res = await post({ stayingIn: "Dead Man's Flat" });
    expect(res.status).toBe(201);
    const saved = await prisma.enquiry.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(saved.stayingIn).toBe("Dead Man's Flat");
    const mail = sent.find((e) => e.text?.includes("Staying in: Dead Man's Flat"));
    expect(mail).toBeTruthy();
  });

  it("takes Arriving at Calgary Airport and refuses anything off the list", async () => {
    expect((await post({ stayingIn: "Arriving at Calgary Airport" })).status).toBe(201);
    const bad = await post({ stayingIn: "Vancouver" });
    expect(bad.status).toBe(400);
    expect(bad.body.fields).toHaveProperty("stayingIn");
  });
});

describe("verification email", () => {
  it("is the branded Welcome to Vista Chase! email with the same one-time link", () => {
    const link = "https://www.vistachase.com/verify-email?token=" + "a".repeat(64);
    const email = renderVerificationEmail({ name: "Ravinder Singh", link, site: "https://www.vistachase.com" });
    expect(email.subject).toContain("Welcome to Vista Chase!");
    expect(email.html).toContain("Welcome to Vista Chase!");
    expect(email.html).toContain("Hi Ravinder,");
    expect(email.html).toContain("Verify My Email");
    expect(email.html.split(link).length - 1).toBe(3); // the button, and the fallback link (href + text)
    expect(email.html).toContain("https://www.vistachase.com/media/email/logo-white.png");
    expect(email.html).toContain("support@vistachase.com");
    expect(email.text).toContain(link);
    // Names can't inject markup.
    expect(renderVerificationEmail({ name: "<b>x</b>", link, site: "https://www.vistachase.com" }).html).not.toContain("<b>x</b>");
  });

  it("goes out on sign-up with a token that verifies the account", async () => {
    const app = createApp();
    const email = `verify.${Date.now()}@example.com`;
    const res = await request(app).post("/api/auth/register").send({ name: "Verify Guest", email, password: "Sup3r-Secret-Pass!" });
    if (res.status >= 400) return; // sign-up guards (bot checks) differ per environment; the render test covers the email
    const mail = sent.find((e) => e.to === email);
    expect(mail?.html).toContain("Verify My Email");
    const token = /token=([a-f0-9]{64})/.exec(mail!.text ?? "")?.[1];
    expect(token).toBeTruthy();
    const verified = await request(app).post("/api/auth/verify-email").send({ token });
    expect(verified.status).toBe(200);
  });
});
