// Package deals: several day tours booked and paid together, with a package discount. The shared
// Two-Day Rockies Explorer (Banff & Yoho Discovery + Columbia Icefield Adventure, 10% off), and the
// private Two-Day, Three-Day and Four-Day journeys (owner 2026-11-06: booked like a private tour,
// not requested), each day a private day tour on a date the guest picks (owner's doc Pricing:
// CAD 1,575 a day in summer = the private day price 1,750 less 10%; 1,240 a day in winter = the
// winter day price; Three- and Four-Day run June 1 to October 10 only).
//
// A package is ordinary bookings, one per day, so seats, manifests, vouchers, check-in, cancellation
// and refunds work exactly as for a single tour. Each booking is priced with the package discount and
// both are paid with ONE PaymentIntent for their sum: the first booking's Payment row holds the intent
// id, the second's the same id with ":2" (Payment.transactionId is unique; the payment provider strips
// the suffix). Each payment row carries its own booking's amount, so a guest can cancel one day and
// get that day's money back. The Stripe webhook confirms both when Stripe reports the full sum
// (metadata.kind PACKAGE, metadata.packageRefs). No schema change: the link between the two bookings
// is kept in each booking's price snapshot and staff notes.

import prisma from "@/lib/db/prisma";
import { getPaymentProvider } from "@/lib/payment/payment.provider";
import { bookingClosedError } from "@/modules/departures/booking-window";
import { firstChargeCents } from "@/modules/bookings/deposit";
import { lookupPromo, type ResolvedPromo } from "@/modules/pricing/promo-codes";
import { pricePackageActivities, type PackageActivityInput } from "@/modules/bookings/package-activities";
import {
  bookingDto,
  confirmPaidBooking,
  createBooking,
  failPendingBooking,
  flagBooking,
  nextStepFor,
  type BookingResult,
  type CreateBookingInput,
  type NextStep,
} from "@/modules/bookings/booking.repository";

export interface TourPackage {
  slug: string;
  title: string;
  /** The tours in the package, one booking each, in the order the guest sees them (Day 1, Day 2). */
  tourSlugs: string[];
  /** Package discount; for a day from October 11 to May 31, `winterDiscountPercent` when set. */
  discountPercent: number;
  winterDiscountPercent?: number;
  /** Every day must be June 1 to October 10. */
  summerOnly?: boolean;
  /**
   * The guest may pay a 20% deposit now and the rest later (owner, 2026-11-11: private tours of two
   * or more days get "continue booking with 20% payment" beside full payment). Each day keeps its
   * own deposit and balance (deposit.ts); every day's balance is due 7 days before the package's
   * FIRST tour day (owner, 2026-11-18), so the guest pays the whole rest once.
   */
  depositAllowed?: boolean;
  /** Each tour's name, for messages (default "Day N"). */
  dayTitles?: string[];
  /** Pairs of tours [i, j] that must run on consecutive dates (tour j the day after tour i). */
  consecutive?: [number, number][];
  /** Most guests in the private vehicle when more than the departure's seats (Four-Day: 14). */
  maxGuests?: number;
  /** Tours (0-based) whose pickup must be in Banff or Canmore, never Lake Louise. */
  banffCanmorePickupDays?: number[];
  /** Airport transfers priced online only to Banff or Canmore; Lake Louise goes through Special Requests (Three-Day, 2026-11-24). */
  banffCanmoreTransferOnly?: boolean;
}

export const PACKAGES: TourPackage[] = [
  {
    slug: "two-day-rockies-explorer",
    title: "Two-Day Rockies Explorer",
    tourSlugs: ["banff-highlights-tour", "shared-tours-icefields-jasper"],
    discountPercent: 10,
  },
  // Private journeys, per vehicle. The days follow each page's itinerary: Banff & Yoho days are the
  // private Banff & Yoho Discovery, Icefields Parkway / Jasper days the private Columbia Icefield tour.
  {
    slug: "two-day-rockies-explorer-private",
    title: "Private Two-Day Rockies Explorer",
    tourSlugs: ["banff-private-tour", "icefields-jasper-private-tour"],
    discountPercent: 10,
    depositAllowed: true,
    winterDiscountPercent: 0,
  },
  {
    slug: "three-day-rockies-discovery",
    title: "Three-Day Rockies Discovery",
    // Three private tours (owner, 2026-11-24), named by tour, not Day 1-3: on three different dates in
    // any order, June 1 - October 10. Up to 14 guests. Pickups in Banff or Canmore (each tour may use
    // its own address); Lake Louise airport transfers are requested through Special Requests.
    tourSlugs: ["banff-private-tour", "banff-private-tour", "icefields-jasper-private-tour"],
    dayTitles: ["Banff Lakes & Viewpoints", "Lake Louise, Moraine Lake & Yoho", "Icefields Parkway & Columbia Icefield"],
    maxGuests: 14,
    banffCanmorePickupDays: [0, 1, 2],
    banffCanmoreTransferOnly: true,
    discountPercent: 10,
    depositAllowed: true,
    summerOnly: true,
  },
  {
    slug: "four-day-rockies-and-jasper",
    title: "Four-Day Rockies & Jasper",
    // Four private tours (owner, 2026-11-24): Banff Lakes & Viewpoints and Lake Louise, Moraine Lake &
    // Yoho on any free dates; Icefields Parkway to Jasper and Jasper Highlights & Return on consecutive
    // dates (Jasper overnight between them); all four dates differ. Up to 14 guests. Pickups for the
    // three outbound tours in Banff or Canmore; the return tour picks up in Jasper.
    tourSlugs: ["banff-private-tour", "banff-private-tour", "icefields-jasper-private-tour", "icefields-jasper-private-tour"],
    dayTitles: ["Banff Lakes & Viewpoints", "Lake Louise, Moraine Lake & Yoho", "Icefields Parkway to Jasper", "Jasper Highlights & Return"],
    consecutive: [[2, 3]],
    maxGuests: 14,
    banffCanmorePickupDays: [0, 1, 2],
    discountPercent: 10,
    depositAllowed: true,
    summerOnly: true,
  },
];

export const findPackage = (slug: string) => PACKAGES.find((p) => p.slug === slug) ?? null;

/** "Icefields Parkway to Jasper", or "Day 3" for a package without tour names. */
export const packageDayName = (pkg: Pick<TourPackage, "dayTitles">, index: number) => pkg.dayTitles?.[index] ?? `Day ${index + 1}`;

/** The day after a YYYY-MM-DD date. */
const nextDay = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/** Why these dates (one per tour, YYYY-MM-DD, in package order) break the package's date rules, or null. */
export function packageDateRuleError(pkg: TourPackage, dates: string[]): string | null {
  if (new Set(dates).size !== dates.length) {
    return pkg.dayTitles ? `Each of the ${dates.length} tours needs a different date.` : "The tours are full-day trips, so they need to be on different days.";
  }
  for (const [a, b] of pkg.consecutive ?? []) {
    if (dates[a] && dates[b] && nextDay(dates[a]) !== dates[b]) {
      return `${packageDayName(pkg, b)} must be the day after ${packageDayName(pkg, a)}, with your overnight stay in Jasper between them. Please choose consecutive dates.`;
    }
  }
  return null;
}

/** Each day's tour category (SHARED / PRIVATE), for a coupon's "Where does it apply". */
export async function packageCategories(pkg: Pick<TourPackage, "tourSlugs">): Promise<(string | null)[]> {
  const tours = await prisma.tour.findMany({ where: { slug: { in: pkg.tourSlugs } }, select: { slug: true, category: true } });
  return pkg.tourSlugs.map((slug) => tours.find((t) => t.slug === slug)?.category ?? null);
}

/** June 1 to October 10, for a YYYY-MM-DD date (same season as the departure prices). */
const inSummer = (date: string) => {
  const md = date.slice(5, 10);
  return md >= "06-01" && md <= "10-10";
};

/** The package discount for a day on `date`. */
export function packageDiscountFor(pkg: TourPackage, date: string) {
  return inSummer(date) ? pkg.discountPercent : (pkg.winterDiscountPercent ?? pkg.discountPercent);
}

export interface CreatePackageInput extends Omit<CreateBookingInput, "departureId" | "holdToken" | "promoCode" | "paymentPlan" | "addOns" | "idempotencyKey" | "activityAddOns" | "packageActivities" | "promoCode"> {
  packageSlug: string;
  /** FULL (default) or a 20% DEPOSIT, for packages with `depositAllowed`. */
  paymentPlan?: "FULL" | "DEPOSIT";
  /** One departure per tour in the package, in the package's order. */
  departureIds: string[];
  idempotencyKey?: string;
  day4JasperPickup?: string;
  dayPickups?: { pickupStopId?: string; pickupCustomText?: string }[];
  /** A promo code, taken off on top of the package price (owner, 2026-11-20). */
  promoCode?: string;
  /** Private journeys: the activities the guest ticked, and who joins each (package-activities.ts). */
  packageActivities?: PackageActivityInput[];
  /** Four-Day: where the return tour finishes (Banff, Canmore or Lake Louise included; Calgary extra). */
  finalDestination?: { area: "BANFF" | "CANMORE" | "LAKE_LOUISE" | "CALGARY" | "CALGARY_AIRPORT"; address?: string };
}

const FINAL_AREA_LABEL: Record<NonNullable<CreatePackageInput["finalDestination"]>["area"], string> = {
  BANFF: "Banff (included)",
  CANMORE: "Canmore (included)",
  LAKE_LOUISE: "Lake Louise (included)",
  CALGARY: "Calgary (extra-cost request: price and timing to be confirmed by our team)",
  CALGARY_AIRPORT: "Calgary Airport (extra-cost request: price and flight timing to be confirmed by our team)",
};

/** "Final drop-off: Canmore (included), 123 Main St." for the return tour's special requests. */
export function finalDestinationLine(f: CreatePackageInput["finalDestination"]): string | null {
  if (!f) return null;
  return `Final drop-off: ${FINAL_AREA_LABEL[f.area]}${f.address?.trim() ? `, ${f.address.trim()}` : ""}.`;
}

export interface PackageResult {
  success: boolean;
  bookings?: NonNullable<BookingResult["booking"]>[];
  /** What the package costs in all (dollars). */
  totalAmount?: number;
  /** What the guest pays now (dollars): the total, or the deposits of every day. */
  amountDueNow?: number;
  currency?: string;
  payment?: { provider: string; clientSecret: string; amount: number; currency: string };
  nextStep?: NextStep;
  replayed?: boolean;
  error?: string;
}

const dayKey = (key: string | undefined, day: number) => (key ? `${key}.d${day}` : undefined);

/** Payment row id for the n-th booking of a package (0-based). */
export const packageTransactionId = (intentId: string, index: number) => (index === 0 ? intentId : `${intentId}:${index + 1}`);

/** A retried checkout (same Idempotency-Key) gets back the package its first attempt made. */
async function replayPackage(input: CreatePackageInput): Promise<PackageResult | null> {
  if (!input.idempotencyKey) return null;
  const keys = input.departureIds.map((_, i) => dayKey(input.idempotencyKey, i + 1)!);
  const found = await prisma.booking.findMany({ where: { idempotencyKey: { in: keys } }, include: { payments: true } });
  if (found.length === 0) return null;
  const bookings = keys.map((k) => found.find((b) => b.idempotencyKey === k));
  const same = bookings.every((b, i) => b && b.tourDepartureId === input.departureIds[i] && b.customerEmail.toLowerCase() === input.customerEmail.toLowerCase());
  if (!same) return { success: false, error: "This checkout was already used for a different booking. Please reload the page and try again." };
  const all = bookings as NonNullable<(typeof bookings)[number]>[];
  const total = all.reduce((n, b) => n + b.totalAmount, 0);
  const dueNow = all.reduce((n, b) => n + firstChargeCents(b), 0);
  const status = all.every((b) => b.status === all[0].status) ? all[0].status : "MIXED";

  let payment: PackageResult["payment"];
  if (status === "PENDING_PAYMENT" && dueNow > 0) {
    const pending = all[0].payments.find((p) => p.status === "PENDING");
    const provider = getPaymentProvider();
    const intent = pending && provider.retrievePaymentIntent ? await provider.retrievePaymentIntent(pending.transactionId).catch(() => null) : null;
    if (!intent?.clientSecret || intent.paid) return { success: false, error: "Your booking is still being set up. Please wait a moment and try again." };
    payment = { provider: provider.name, clientSecret: intent.clientSecret, amount: dueNow / 100, currency: all[0].currency };
  }
  return {
    success: true,
    bookings: all.map((b) => bookingDto(b, b.payments)),
    totalAmount: total / 100,
    amountDueNow: dueNow / 100,
    currency: all[0].currency,
    payment,
    nextStep: status === "MIXED" ? "START_AGAIN" : nextStepFor(status),
    replayed: true,
  };
}

/** Checks the departures belong to the package's tours, in order, on different days (and consecutive where required), and are open with enough seats. */
async function packageError(pkg: TourPackage, departureIds: string[], party?: { adults: number; children: number; infants: number }): Promise<string | null> {
  if (departureIds.length !== pkg.tourSlugs.length) return `Choose a date for each of the ${pkg.tourSlugs.length} tours.`;
  if (new Set(departureIds).size !== departureIds.length) return "Choose a different departure for each tour.";
  const departures = await prisma.tourDeparture.findMany({ where: { id: { in: departureIds } }, include: { tour: { select: { slug: true, title: true } } } });
  const dates: string[] = [];
  const isPrivate = pkg.slug.includes("private") || Boolean(pkg.depositAllowed);
  for (const [i, id] of departureIds.entries()) {
    const name = packageDayName(pkg, i);
    const d = departures.find((x) => x.id === id);
    if (!d || d.tour?.slug !== pkg.tourSlugs[i]) return `${name}: that departure isn't part of the ${pkg.title}. Please choose the date again.`;
    const closed = bookingClosedError(d);
    if (closed) return `${pkg.dayTitles ? name : `${name} (${d.tour.title})`}: ${closed}`;
    const day = d.date.toISOString().slice(0, 10);
    if (pkg.summerOnly && !inSummer(day)) return `${name}: the ${pkg.title} runs from June 1 to October 10 only.`;
    if (party) {
      const seatsAvailable = Math.max(0, d.capacityTotal - d.capacityBooked - d.capacityHeld);
      const seatsNeeded = isPrivate ? d.capacityTotal : party.adults + party.children + (d.infantPrice != null ? party.infants : 0);
      if (seatsAvailable < seatsNeeded) {
        return isPrivate
          ? `${name}: the private vehicle is no longer free on that date. Please choose another date for ${name}.`
          : `${pkg.dayTitles ? name : `${name} (${d.tour?.title ?? pkg.title})`} only has ${seatsAvailable} seats available, but your party requires ${seatsNeeded}.`;
      }
    }
    dates.push(day);
  }
  return packageDateRuleError(pkg, dates);
}

/**
 * Books every day of a package and starts one payment for all of them. If any day can't be booked
 * (sold out, closed), the days already taken are released again and nothing is charged.
 */
export async function createPackageBooking(input: CreatePackageInput): Promise<PackageResult> {
  const pkg = findPackage(input.packageSlug);
  if (!pkg) return { success: false, error: "This package isn't available." };

  const replay = await replayPackage(input);
  if (replay) return replay;

  const invalid = await packageError(pkg, input.departureIds, { adults: input.adultsCount, children: input.childrenCount, infants: input.infantsCount });
  if (invalid) return { success: false, error: invalid };
  const partySize = input.adultsCount + input.childrenCount + input.infantsCount;
  if (pkg.maxGuests && partySize > pkg.maxGuests) return { success: false, error: `The ${pkg.title} takes up to ${pkg.maxGuests} guests.` };
  if (pkg.banffCanmorePickupDays?.length) {
    const stopIds = pkg.banffCanmorePickupDays.map((i) => input.dayPickups?.[i]?.pickupStopId ?? input.pickupStopId).filter((x): x is string => Boolean(x));
    if (stopIds.length > 0) {
      const lakeLouise = await prisma.shuttleStop.findFirst({ where: { id: { in: stopIds }, town: { contains: "Lake Louise", mode: "insensitive" } }, select: { id: true } });
      if (lakeLouise) {
        return {
          success: false,
          error:
            pkg.slug === "four-day-rockies-and-jasper"
              ? "Pickups for the Banff, Lake Louise/Yoho and Icefields-to-Jasper tours are from Banff or Canmore. Please choose a Banff or Canmore hotel."
              : `Pickups for all ${pkg.tourSlugs.length === 3 ? "three" : pkg.tourSlugs.length} tours are from Banff or Canmore. Please choose a Banff or Canmore hotel.`,
        };
      }
    }
  }
  if (pkg.banffCanmoreTransferOnly && input.airportTransfer?.area === "LAKE_LOUISE") {
    return { success: false, error: `Airport transfers with the ${pkg.title} are booked online to Banff or Canmore. For Lake Louise, add it in Special requests or contact our team to confirm.` };
  }
  if (pkg.dayTitles && pkg.slug === "four-day-rockies-and-jasper" && !input.finalDestination) {
    return { success: false, error: "Choose where your Jasper Highlights & Return tour finishes: Banff, Canmore or Lake Louise (included), or Calgary (extra cost)." };
  }
  const plan = input.paymentPlan === "DEPOSIT" ? "DEPOSIT" : "FULL";
  if (plan === "DEPOSIT" && !pkg.depositAllowed) return { success: false, error: `The ${pkg.title} is paid in full at booking.` };
  const departureDates = new Map(
    (await prisma.tourDeparture.findMany({ where: { id: { in: input.departureIds } }, select: { id: true, date: true } })).map((d) => [d.id, d.date.toISOString().slice(0, 10)]),
  );

  let activities: ReturnType<typeof pricePackageActivities> = [];
  try {
    activities = pricePackageActivities(pkg.slug, input.packageActivities ?? [], { adults: input.adultsCount, children: input.childrenCount, infants: input.infantsCount });
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }

  // A promo code from the admin list (or PROMO_CODES): checked once here, and again with Day 1 under
  // the code's lock. A partner's voucher code takes nothing off; it only credits the partner.
  let packagePromo: ResolvedPromo | null = null;
  if (input.promoCode?.trim()) {
    const found = await lookupPromo(input.promoCode, prisma, new Date(), await packageCategories(pkg));
    if (found.ok) packagePromo = found.promo;
    else if (found.reason !== "unknown") return { success: false, error: `${found.error} Please remove it and try again.` };
  }

  const made: NonNullable<BookingResult["booking"]>[] = [];
  const release = async (reason: string) => {
    for (const b of made) await failPendingBooking(b.bookingReference, reason);
  };
  for (const [i, departureId] of input.departureIds.entries()) {
    const dayPickup = input.dayPickups?.[i];
    const pickupStopId = dayPickup?.pickupStopId ?? (i === 3 && input.day4JasperPickup ? undefined : input.pickupStopId);
    const pickupCustomText = dayPickup?.pickupCustomText ?? (i === 3 && input.day4JasperPickup ? input.day4JasperPickup : input.pickupCustomText);

    const result = await createBooking(
      {
        customerId: input.customerId,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        customerCountry: input.customerCountry,
        pickupStopId,
        pickupCustomText,
        adultsCount: input.adultsCount,
        childrenCount: input.childrenCount,
        infantsCount: input.infantsCount,
        // The final drop-off goes with the last tour (the Four-Day's Jasper Highlights & Return).
        specialRequests:
          i === input.departureIds.length - 1 && input.finalDestination
            ? [input.specialRequests, finalDestinationLine(input.finalDestination)].filter(Boolean).join("\n")
            : input.specialRequests,
        affiliateCode: input.affiliateCode,
        departureId,
        idempotencyKey: dayKey(input.idempotencyKey, i + 1),
        paymentPlan: plan,
        // A private journey's airport transfer (both ways) is booked once, with Day 1.
        airportTransfer: i === 0 ? input.airportTransfer : undefined,
        // So are its activities, priced on the server (package-activities.ts).
        packageActivities: i === 0 && activities.length > 0 ? activities : undefined,
      },
      {
        deferPayment: true,
        discount: { percent: packageDiscountFor(pkg, departureDates.get(departureId) ?? ""), label: pkg.title.toUpperCase() },
        ...(pkg.maxGuests ? { vehicleMaxGuests: pkg.maxGuests } : {}),
        ...(packagePromo ? { packagePromo: { promo: packagePromo, countsUse: i === 0 } } : {}),
      },
    );
    if (!result.success || !result.booking) {
      await release(`${pkg.title}: ${packageDayName(pkg, i)} could not be booked`);
      return { success: false, error: `${packageDayName(pkg, i)}: ${result.error ?? "this departure can't be booked."}` };
    }
    made.push(result.booking);
  }

  // Link the days: in the price snapshot (what the guest bought) and in the notes staff read.
  const references = made.map((b) => b.bookingReference);
  const stored = await prisma.booking.findMany({ where: { bookingReference: { in: references } } });
  for (const [i, ref] of references.entries()) {
    const b = stored.find((x) => x.bookingReference === ref)!;
    const others = references.filter((r) => r !== ref).join(", ");
    await prisma.booking.update({
      where: { id: b.id },
      data: {
        priceSnapshot: { ...(b.priceSnapshot as object), package: { slug: pkg.slug, title: pkg.title, day: i + 1, references, discountPercent: packageDiscountFor(pkg, departureDates.get(input.departureIds[i]) ?? "") } },
        adminNotes: [b.adminNotes, `${pkg.title}, ${pkg.dayTitles ? `${packageDayName(pkg, i)} (tour ${i + 1} of ${references.length})` : `day ${i + 1} of ${references.length}`}: booked and paid together with ${others}.`].filter(Boolean).join("\n"),
      },
    });
  }

  // Deposit: every day's balance is due with the first day's (7 days before the first tour day).
  if (plan === "DEPOSIT") {
    const dues = stored.map((b) => b.balanceDueAt?.getTime()).filter((t): t is number => t != null);
    if (dues.length > 0) {
      const firstDue = new Date(Math.min(...dues));
      await prisma.booking.updateMany({ where: { bookingReference: { in: references }, paymentPlan: "DEPOSIT" }, data: { balanceDueAt: firstDue } });
      for (const b of stored) if (b.paymentPlan === "DEPOSIT") b.balanceDueAt = firstDue;
    }
  }

  const ordered = references.map((ref) => stored.find((x) => x.bookingReference === ref)!);
  const totalCents = ordered.reduce((n, b) => n + b.totalAmount, 0);
  // With a deposit, each day is charged its deposit now (firstChargeCents) and its balance later.
  const dueNowCents = ordered.reduce((n, b) => n + firstChargeCents(b), 0);
  const currency = ordered[0].currency;
  const provider = getPaymentProvider();

  let intent: Awaited<ReturnType<typeof provider.createPaymentIntent>> | null = null;
  if (dueNowCents > 0) {
    try {
      intent = await provider.createPaymentIntent({
        amount: dueNowCents,
        currency,
        bookingReference: references[0],
        customerEmail: input.customerEmail,
        metadata: { kind: "PACKAGE", package: pkg.slug, packageRefs: references.join(","), plan },
        idempotencyKey: `package-${references.join("-")}`,
      });
    } catch (error) {
      console.error("Package payment could not be started:", (error as Error).message);
      await release("payment could not be started");
      return { success: false, error: "We couldn't start the payment. Please try again." };
    }
    for (const [i, b] of ordered.entries()) {
      const charge = firstChargeCents(b);
      if (charge <= 0) continue;
      await prisma.payment.create({
        data: { bookingId: b.id, amount: charge, currency, provider: provider.name, transactionId: packageTransactionId(intent.intentId, i), kind: b.paymentPlan === "DEPOSIT" ? "DEPOSIT" : "FULL", status: "PENDING" },
      });
    }
  }

  const paidNow = !intent || intent.paid;
  if (paidNow) await confirmPackagePayment(references);
  const final = await prisma.booking.findMany({ where: { bookingReference: { in: references } }, include: { payments: true } });
  const finalOrdered = references.map((ref) => final.find((x) => x.bookingReference === ref)!);
  return {
    success: true,
    bookings: finalOrdered.map((b) => bookingDto(b, b.payments)),
    totalAmount: totalCents / 100,
    amountDueNow: dueNowCents / 100,
    currency,
    payment: intent && !paidNow ? { provider: provider.name, clientSecret: intent.clientSecret, amount: dueNowCents / 100, currency } : undefined,
    nextStep: nextStepFor(finalOrdered[0].status),
  };
}

/**
 * Confirms every booking of a paid package. With `verified` (the Stripe webhook), Stripe's amount
 * must equal what the bookings charge at checkout together (totals, or deposits); otherwise nothing is confirmed and each booking is
 * flagged for staff, as for a single booking whose payment doesn't match.
 */
export async function confirmPackagePayment(references: string[], verified?: { amount: number; currency: string; transactionId: string }) {
  const found = await prisma.booking.findMany({ where: { bookingReference: { in: references } } });
  const bookings = references.map((ref) => found.find((b) => b.bookingReference === ref)).filter((b): b is NonNullable<typeof b> => Boolean(b));
  if (bookings.length === 0) return;
  const expected = bookings.reduce((n, b) => n + firstChargeCents(b), 0);
  if (verified && (bookings.length !== references.length || verified.amount !== expected || verified.currency.toUpperCase() !== bookings[0].currency.toUpperCase())) {
    for (const b of bookings) {
      if (b.status !== "PENDING_PAYMENT") continue;
      await flagBooking(
        b.id,
        "PAYMENT_AMOUNT_MISMATCH",
        `Package payment ${verified.transactionId} of ${verified.amount} ${verified.currency.toUpperCase()} doesn't match the package total ${expected} ${bookings[0].currency} (${references.join(", ")}); not confirmed.`,
        b.adminNotes,
      );
    }
    return;
  }
  for (const [i, b] of bookings.entries()) {
    await confirmPaidBooking(
      b.bookingReference,
      verified ? { amount: firstChargeCents(b), currency: verified.currency, transactionId: packageTransactionId(verified.transactionId, i) } : undefined,
    );
  }
}

/** The package's payment failed or was cancelled: release every day's seats. */
/** Cancels a package's unpaid bookings; true when any of them was still waiting for payment. */
export async function failPackagePayment(references: string[], reason: string) {
  let ended = false;
  for (const ref of references) if (await failPendingBooking(ref, reason)) ended = true;
  return ended;
}

/** "VC-1,VC-2" from the intent's metadata, at most a handful of well-formed references. */
export function packageReferences(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter((r) => /^VC-\d{4}-[A-F0-9]{8}$/.test(r))
    .slice(0, 5);
}
