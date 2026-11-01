// Package deals: several day tours booked and paid together, with a package discount. Today there is
// one, the Two-Day Rockies Explorer (Banff & Yoho Discovery + Columbia Icefield Adventure, 10% off),
// from the owner's "Update Vista Chase web" doc.
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
  discountPercent: number;
}

export const PACKAGES: TourPackage[] = [
  {
    slug: "two-day-rockies-explorer",
    title: "Two-Day Rockies Explorer",
    tourSlugs: ["banff-highlights-tour", "shared-tours-icefields-jasper"],
    discountPercent: 10,
  },
];

export const findPackage = (slug: string) => PACKAGES.find((p) => p.slug === slug) ?? null;

export interface CreatePackageInput extends Omit<CreateBookingInput, "departureId" | "holdToken" | "promoCode" | "paymentPlan" | "addOns" | "idempotencyKey"> {
  packageSlug: string;
  /** One departure per tour in the package, in the package's order. */
  departureIds: string[];
  idempotencyKey?: string;
}

export interface PackageResult {
  success: boolean;
  bookings?: NonNullable<BookingResult["booking"]>[];
  /** What the guest pays for the whole package (dollars). */
  totalAmount?: number;
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
  const status = all.every((b) => b.status === all[0].status) ? all[0].status : "MIXED";

  let payment: PackageResult["payment"];
  if (status === "PENDING_PAYMENT" && total > 0) {
    const pending = all[0].payments.find((p) => p.status === "PENDING");
    const provider = getPaymentProvider();
    const intent = pending && provider.retrievePaymentIntent ? await provider.retrievePaymentIntent(pending.transactionId).catch(() => null) : null;
    if (!intent?.clientSecret || intent.paid) return { success: false, error: "Your booking is still being set up. Please wait a moment and try again." };
    payment = { provider: provider.name, clientSecret: intent.clientSecret, amount: total / 100, currency: all[0].currency };
  }
  return {
    success: true,
    bookings: all.map((b) => bookingDto(b, b.payments)),
    totalAmount: total / 100,
    currency: all[0].currency,
    payment,
    nextStep: status === "MIXED" ? "START_AGAIN" : nextStepFor(status),
    replayed: true,
  };
}

/** Checks the departures belong to the package's tours, in order, on different days, and are open. */
async function packageError(pkg: TourPackage, departureIds: string[]): Promise<string | null> {
  if (departureIds.length !== pkg.tourSlugs.length) return `Choose a date for each of the ${pkg.tourSlugs.length} tours.`;
  if (new Set(departureIds).size !== departureIds.length) return "Choose a different departure for each tour.";
  const departures = await prisma.tourDeparture.findMany({ where: { id: { in: departureIds } }, include: { tour: { select: { slug: true, title: true } } } });
  const dates = new Set<string>();
  for (const [i, id] of departureIds.entries()) {
    const d = departures.find((x) => x.id === id);
    if (!d || d.tour?.slug !== pkg.tourSlugs[i]) return `Day ${i + 1}: that departure isn't part of the ${pkg.title}. Please choose the date again.`;
    const closed = bookingClosedError(d);
    if (closed) return `Day ${i + 1} (${d.tour.title}): ${closed}`;
    dates.add(d.date.toISOString().slice(0, 10));
  }
  if (dates.size !== departureIds.length) return "The two tours are full-day trips, so they need to be on different days.";
  return null;
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

  const invalid = await packageError(pkg, input.departureIds);
  if (invalid) return { success: false, error: invalid };

  const made: NonNullable<BookingResult["booking"]>[] = [];
  const release = async (reason: string) => {
    for (const b of made) await failPendingBooking(b.bookingReference, reason);
  };
  for (const [i, departureId] of input.departureIds.entries()) {
    const result = await createBooking(
      {
        customerId: input.customerId,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        pickupStopId: input.pickupStopId,
        pickupCustomText: input.pickupCustomText,
        adultsCount: input.adultsCount,
        childrenCount: input.childrenCount,
        infantsCount: input.infantsCount,
        specialRequests: input.specialRequests,
        affiliateCode: input.affiliateCode,
        departureId,
        idempotencyKey: dayKey(input.idempotencyKey, i + 1),
        paymentPlan: "FULL",
      },
      { deferPayment: true, discount: { percent: pkg.discountPercent, label: pkg.title.toUpperCase() } },
    );
    if (!result.success || !result.booking) {
      await release(`${pkg.title}: day ${i + 1} could not be booked`);
      return { success: false, error: `Day ${i + 1}: ${result.error ?? "this departure can't be booked."}` };
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
        priceSnapshot: { ...(b.priceSnapshot as object), package: { slug: pkg.slug, title: pkg.title, day: i + 1, references, discountPercent: pkg.discountPercent } },
        adminNotes: [b.adminNotes, `${pkg.title}, day ${i + 1} of ${references.length}: booked and paid together with ${others}.`].filter(Boolean).join("\n"),
      },
    });
  }

  const ordered = references.map((ref) => stored.find((x) => x.bookingReference === ref)!);
  const totalCents = ordered.reduce((n, b) => n + b.totalAmount, 0);
  const currency = ordered[0].currency;
  const provider = getPaymentProvider();

  let intent: Awaited<ReturnType<typeof provider.createPaymentIntent>> | null = null;
  if (totalCents > 0) {
    try {
      intent = await provider.createPaymentIntent({
        amount: totalCents,
        currency,
        bookingReference: references[0],
        customerEmail: input.customerEmail,
        metadata: { kind: "PACKAGE", package: pkg.slug, packageRefs: references.join(",") },
        idempotencyKey: `package-${references.join("-")}`,
      });
    } catch (error) {
      console.error("Package payment could not be started:", (error as Error).message);
      await release("payment could not be started");
      return { success: false, error: "We couldn't start the payment. Please try again." };
    }
    for (const [i, b] of ordered.entries()) {
      if (b.totalAmount <= 0) continue;
      await prisma.payment.create({
        data: { bookingId: b.id, amount: b.totalAmount, currency, provider: provider.name, transactionId: packageTransactionId(intent.intentId, i), kind: "FULL", status: "PENDING" },
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
    currency,
    payment: intent && !paidNow ? { provider: provider.name, clientSecret: intent.clientSecret, amount: totalCents / 100, currency } : undefined,
    nextStep: nextStepFor(finalOrdered[0].status),
  };
}

/**
 * Confirms every booking of a paid package. With `verified` (the Stripe webhook), Stripe's amount
 * must equal the bookings' combined total; otherwise nothing is confirmed and each booking is
 * flagged for staff, as for a single booking whose payment doesn't match.
 */
export async function confirmPackagePayment(references: string[], verified?: { amount: number; currency: string; transactionId: string }) {
  const found = await prisma.booking.findMany({ where: { bookingReference: { in: references } } });
  const bookings = references.map((ref) => found.find((b) => b.bookingReference === ref)).filter((b): b is NonNullable<typeof b> => Boolean(b));
  if (bookings.length === 0) return;
  const expected = bookings.reduce((n, b) => n + b.totalAmount, 0);
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
      verified ? { amount: b.totalAmount, currency: verified.currency, transactionId: packageTransactionId(verified.transactionId, i) } : undefined,
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
