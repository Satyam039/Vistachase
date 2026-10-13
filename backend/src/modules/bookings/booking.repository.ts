// Bookings: create (seats taken, payment started), confirm once paid, fail when payment fails or
// expires, cancel with the refund the policy allows.
//
// Flow: createBooking saves the booking as PENDING_PAYMENT and takes its seats in one transaction,
// then starts a payment for the server-computed total. The mock provider pays at once and the
// booking is confirmed straight away; with Stripe the guest pays in the browser and the Stripe
// webhook calls confirmPaidBooking after checking the amount. Seats are counted only in this
// database (TourDeparture capacity and reservation holds, changed only through
// modules/departures/inventory.ts); no external booking system is called. Status moves go
// through booking-status.ts. All amounts are whole cents. No sales tax is added.
//
// Idempotency: the checkout sends an Idempotency-Key per attempt. A retry with the same key
// (refresh, double-click, dropped response) returns the booking already made instead of a second.

import crypto from "node:crypto";
import QRCode from "qrcode";
import { Prisma, type Booking, type Payment } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { formatDateOnly, formatTimeOfDay, getMountainTimeInstant } from "@/lib/utils/time";
import { bookingClosedError } from "@/modules/departures/booking-window";
import { endBooking, freeExpiredSeats, inventoryError, PENDING_PAYMENT_MINUTES, takeBookedSeats } from "@/modules/departures/inventory";
import { transitionBooking } from "@/modules/bookings/booking-status";
import { getPaymentProvider } from "@/lib/payment/payment.provider";
import { getEmailProvider } from "@/lib/email/email.provider";
import { isVehicleDeparture, partySizeError, seatsToReserve } from "@/modules/pricing/departure-pricing";
import { priceBooking, type AddOnChoice } from "@/modules/pricing/booking-pricing";
import { referringAffiliateId } from "@/modules/affiliates/affiliate.repository";
import { earnCommission, reverseCommissionForRefund } from "@/modules/affiliates/commission";
import { sendCommissionEarnedEmail } from "@/modules/affiliates/partner-emails";
import { checkinLink, signBookingLink, voucherLink } from "@/lib/security/signed-links";

export interface CreateBookingInput {
  holdToken?: string;
  departureId: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupStopId?: string;
  pickupCustomText?: string;
  pickupTime?: string;
  adultsCount: number;
  childrenCount: number;
  infantsCount: number;
  specialRequests?: string;
  /** Add-ons chosen by id (or stored name). Any price sent by a client is ignored. */
  addOns?: AddOnChoice[];
  promoCode?: string;
  /** Referral code from the vc_ref cookie; credited only to an ACTIVE partner. */
  affiliateCode?: string;
  /** Client-generated key for this checkout attempt; a retry with it returns the same booking. */
  idempotencyKey?: string;
}

/** What the checkout should do next. */
export type NextStep = "PAY" | "CONFIRMED" | "START_AGAIN";

/** Payment state derived from the booking's payment records. */
export type PaymentState = "NOT_REQUIRED" | "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export interface BookingResult {
  success: boolean;
  booking?: {
    id: string;
    bookingReference: string;
    voucherCode: string;
    totalAmount: number; // dollars, for display
    currency: string;
    status: string;
    paymentStatus: PaymentState;
    qrCodeUrl: string | null;
    /** Signed link to the voucher page (also emailed), and its token for API calls. */
    voucherUrl: string;
    voucherToken: string;
  };
  /** Present when the guest still has to pay in the browser (Stripe Payment Element). */
  payment?: { provider: string; clientSecret: string; amount: number; currency: string };
  nextStep?: NextStep;
  /** True when this answered a retry with the booking an earlier request made. */
  replayed?: boolean;
  error?: string;
}

function newReference() {
  return `VC-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function newVoucherCode() {
  return `VOUCH-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

/** A reason to refuse the booking, thrown inside the transaction so everything rolls back. */
class BookingRefused extends Error {}

export function paymentState(booking: { totalAmount: number }, payments: Pick<Payment, "status">[]): PaymentState {
  if (payments.some((p) => p.status === "REFUNDED")) return "REFUNDED";
  if (payments.some((p) => p.status === "SUCCEEDED")) return "PAID";
  if (payments.some((p) => p.status === "PENDING")) return "PENDING";
  if (payments.some((p) => p.status === "FAILED")) return "FAILED";
  return booking.totalAmount === 0 ? "NOT_REQUIRED" : "PENDING";
}

function nextStepFor(status: string): NextStep {
  if (status === "CONFIRMED" || status === "PAID_UNSYNCED" || status === "COMPLETED") return "CONFIRMED";
  if (status === "PENDING_PAYMENT") return "PAY";
  return "START_AGAIN";
}

function bookingDto(booking: Booking, payments: Pick<Payment, "status">[]) {
  return {
    id: booking.id,
    bookingReference: booking.bookingReference,
    voucherCode: booking.voucherCode,
    totalAmount: booking.totalAmount / 100,
    currency: booking.currency,
    status: booking.status,
    paymentStatus: paymentState(booking, payments),
    qrCodeUrl: booking.qrCodeUrl,
    voucherUrl: voucherLink(booking.bookingReference),
    voucherToken: signBookingLink(booking.bookingReference, "voucher"),
  };
}

/**
 * Answers a retried submission with the booking its first attempt made. A key reused for a
 * different booking (other departure, guest or party) is refused.
 */
async function replayBooking(key: string, input: CreateBookingInput): Promise<BookingResult | null> {
  // A twin request may still be starting its payment; give it a moment to settle (double-click).
  for (let attempt = 0; ; attempt++) {
    const existing = await prisma.booking.findUnique({ where: { idempotencyKey: key }, include: { payments: true } });
    if (!existing) return null;
    const same =
      existing.tourDepartureId === input.departureId &&
      existing.customerEmail.toLowerCase() === input.customerEmail.toLowerCase() &&
      existing.adultsCount === input.adultsCount &&
      existing.childrenCount === input.childrenCount &&
      existing.infantsCount === input.infantsCount;
    if (!same) return { success: false, error: "This checkout was already used for a different booking. Please reload the page and try again." };

    let payment: BookingResult["payment"];
    if (existing.status === "PENDING_PAYMENT" && existing.totalAmount > 0) {
      const pending = existing.payments.find((p) => p.status === "PENDING");
      const provider = getPaymentProvider();
      const intent = pending && provider.retrievePaymentIntent ? await provider.retrievePaymentIntent(pending.transactionId) : null;
      if (!intent?.clientSecret || intent.paid) {
        if (attempt < 15) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          continue;
        }
        return { success: false, error: "Your booking is still being set up. Please wait a moment and try again." };
      }
      payment = { provider: provider.name, clientSecret: intent.clientSecret, amount: existing.totalAmount / 100, currency: existing.currency };
    }
    return { success: true, booking: bookingDto(existing, existing.payments), payment, nextStep: nextStepFor(existing.status), replayed: true };
  }
}

function isUniqueViolation(error: unknown, field: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    JSON.stringify(error.meta?.target ?? "").includes(field)
  );
}

/** Staff bookings (Quick Book, modules/admin/booking-admin.ts): paid outside the online checkout. */
export interface CreateBookingOptions {
  /** Don't start an online payment: the caller records how the guest paid, then confirms. */
  offlinePayment?: boolean;
  /** Staff may still book after online booking closes, up to the departure time. */
  allowAfterCutoff?: boolean;
}

export async function createBooking(input: CreateBookingInput, options: CreateBookingOptions = {}): Promise<BookingResult> {
  const totalSeats = input.adultsCount + input.childrenCount;
  if (input.adultsCount < 1) return { success: false, error: "At least one adult is required." };

  if (input.idempotencyKey) {
    const replay = await replayBooking(input.idempotencyKey, input);
    if (replay) return replay;
  }

  // Seats from expired holds and unpaid bookings on this departure come back first.
  await freeExpiredSeats({ departureId: input.departureId });

  let booking: Booking;
  try {
    booking = await prisma.$transaction(async (tx) => {
      const now = new Date();
      let holdRecord = null;
      if (input.holdToken) {
        holdRecord = await tx.reservationHold.findUnique({ where: { holdToken: input.holdToken } });
        if (!holdRecord || holdRecord.status !== "ACTIVE" || holdRecord.expiresAt < now) {
          throw new BookingRefused("Reservation hold expired. Please select your seats again.");
        }
        if (holdRecord.tourDepartureId !== input.departureId) {
          throw new BookingRefused("This reservation hold is for a different departure.");
        }
      }

      const departure = await tx.tourDeparture.findUnique({
        where: { id: input.departureId },
        include: { tour: true, shuttleRoute: true },
      });
      if (!departure || departure.status !== "ACTIVE") throw new BookingRefused("Departure not found");
      const notSellable = inventoryError(departure);
      if (notSellable) throw new BookingRefused(notSellable);
      const closed = options.allowAfterCutoff
        ? getMountainTimeInstant(departure.date, departure.departureTime) <= now && "This departure has already left."
        : bookingClosedError(departure);
      if (closed) throw new BookingRefused(closed);
      if (departure.tour?.bookingMode === "ENQUIRY") {
        throw new BookingRefused("This experience is booked on request. Please send us an enquiry.");
      }

      const partyError = partySizeError(departure, totalSeats);
      if (partyError) throw new BookingRefused(partyError);

      // Capacity: shared departures take one seat per guest, private ones the whole vehicle
      const isVehicle = isVehicleDeparture(departure);
      const reservedSeats = seatsToReserve(departure, totalSeats);

      // The hold is claimed once: a second request with the same hold finds it no longer ACTIVE.
      if (holdRecord) {
        const claimed = await tx.reservationHold.updateMany({
          where: { id: holdRecord.id, status: "ACTIVE", expiresAt: { gte: now } },
          data: { status: "CONVERTED" },
        });
        if (claimed.count === 0) throw new BookingRefused("Reservation hold expired. Please select your seats again.");
      }
      if (!(await takeBookedSeats(tx, departure.id, reservedSeats, holdRecord?.seatsCount ?? 0))) {
        const fresh = await tx.tourDeparture.findUniqueOrThrow({ where: { id: departure.id } });
        const available = fresh.capacityTotal - (fresh.capacityBooked + Math.max(0, fresh.capacityHeld - (holdRecord?.seatsCount ?? 0)));
        throw new BookingRefused(
          isVehicle
            ? "This private vehicle is already booked for this departure."
            : `Requested ${totalSeats} seats, but only ${Math.max(0, available)} seats are available.`,
        );
      }

      const totals = priceBooking(departure, { adults: input.adultsCount, children: input.childrenCount }, input.addOns, input.promoCode);
      const bookingReference = newReference();
      // Exactly what the booking was priced with, so later price changes never alter it.
      const priceSnapshot = {
        version: 1,
        pricedAt: now.toISOString(),
        currency: departure.currency,
        pricing: isVehicle ? "PER_VEHICLE" : "PER_GUEST",
        adultUnitCents: departure.price,
        childUnitCents: isVehicle ? null : (departure.childPrice ?? departure.price),
        party: { adults: input.adultsCount, children: input.childrenCount, infants: input.infantsCount },
        fareCents: totals.fareCents,
        promo: totals.discountPercent > 0 ? { code: input.promoCode?.trim().toUpperCase(), percent: totals.discountPercent } : null,
        discountCents: totals.discountCents,
        addOns: totals.addOns,
        addOnsCents: totals.addOnsCents,
        taxCents: 0,
        totalCents: totals.totalCents,
        inventorySource: departure.inventorySource,
      };

      const created = await tx.booking.create({
        data: {
          bookingReference,
          idempotencyKey: input.idempotencyKey,
          customerId: input.customerId,
          affiliateId: await referringAffiliateId(input.affiliateCode, { customerId: input.customerId, customerEmail: input.customerEmail }),
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          tourDepartureId: input.departureId,
          pickupStopId: input.pickupStopId,
          pickupCustomText: input.pickupCustomText,
          pickupTime: input.pickupTime,
          adultsCount: input.adultsCount,
          childrenCount: input.childrenCount,
          infantsCount: input.infantsCount,
          totalSeats,
          subtotal: totals.fareCents - totals.discountCents,
          tax: 0,
          addOnsTotal: totals.addOnsCents,
          totalAmount: totals.totalCents,
          currency: departure.currency,
          status: "PENDING_PAYMENT",
          priceSnapshot,
          paymentExpiresAt: new Date(now.getTime() + PENDING_PAYMENT_MINUTES * 60_000),
          specialRequests: input.specialRequests,
          voucherCode: newVoucherCode(),
          // Staff scan this to check the guest in; it carries a signature, not the guest's details.
          qrCodeUrl: await QRCode.toDataURL(checkinLink(bookingReference), { margin: 1, width: 300 }),
          items: { create: totals.addOns.map((a) => ({ name: a.name, price: a.priceCents, quantity: a.quantity })) },
        },
      });

      if (holdRecord) await tx.reservationHold.update({ where: { id: holdRecord.id }, data: { bookingId: created.id } });
      await tx.auditLog.create({
        data: {
          action: "BOOKING_CREATED",
          entityType: "Booking",
          entityId: created.id,
          details: { status: "PENDING_PAYMENT", totalCents: totals.totalCents, seats: reservedSeats, viaHold: Boolean(holdRecord) },
        },
      });
      return created;
    });
  } catch (error) {
    // A twin request with the same key won the race (or claimed the hold first): answer with its booking.
    if (input.idempotencyKey && (error instanceof BookingRefused || isUniqueViolation(error, "idempotencyKey"))) {
      const replay = await replayBooking(input.idempotencyKey, input);
      if (replay) return replay;
    }
    if (error instanceof BookingRefused) return { success: false, error: error.message };
    throw error;
  }

  if (options.offlinePayment) return { success: true, booking: bookingDto(booking, []), nextStep: "PAY" };

  // Start the payment outside the transaction (network call). Free bookings (100% promo) skip it.
  const provider = getPaymentProvider();
  let intent: Awaited<ReturnType<typeof provider.createPaymentIntent>> | null = null;
  if (booking.totalAmount > 0) {
    try {
      intent = await provider.createPaymentIntent({
        amount: booking.totalAmount,
        currency: booking.currency,
        bookingReference: booking.bookingReference,
        customerEmail: booking.customerEmail,
      });
    } catch (error) {
      console.error("Payment could not be started:", (error as Error).message);
      await failPendingBooking(booking.bookingReference, "payment could not be started");
      return { success: false, error: "We couldn't start the payment. Please try again." };
    }
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: booking.totalAmount,
        currency: booking.currency,
        provider: provider.name,
        transactionId: intent.intentId,
        status: "PENDING",
      },
    });
  }

  // Only a completed payment (instant mock, or nothing to pay) confirms here; Stripe confirms via its webhook.
  const paidNow = !intent || intent.paid;
  const finalBooking = paidNow ? (await confirmPaidBooking(booking.bookingReference)) ?? booking : booking;
  const payments = await prisma.payment.findMany({ where: { bookingId: booking.id }, select: { status: true } });

  return {
    success: true,
    booking: bookingDto(finalBooking, payments),
    payment:
      intent && !paidNow
        ? { provider: provider.name, clientSecret: intent.clientSecret, amount: booking.totalAmount / 100, currency: booking.currency }
        : undefined,
    nextStep: nextStepFor(finalBooking.status),
  };
}

export interface VerifiedPayment {
  /** Amount the provider says was paid, in cents. */
  amount: number;
  currency: string;
  /** The provider's payment (intent) id. */
  transactionId?: string;
}

/**
 * Marks a paid booking confirmed (idempotent) and emails the voucher. Called right after an
 * instant payment, or by the Stripe webhook with the amount Stripe reports. A payment that
 * doesn't match the booking's total, or that arrives after the booking expired or was cancelled,
 * never confirms it: it is recorded and flagged for staff (nightly reconciliation lists it).
 */
export async function confirmPaidBooking(reference: string, verified?: VerifiedPayment) {
  const booking = await prisma.booking.findUnique({
    where: { bookingReference: reference },
    include: { tourDeparture: { include: { tour: true, shuttleRoute: true } }, pickupStop: true },
  });
  if (!booking) return null;
  const transactionId = verified?.transactionId;
  if (!["PENDING_PAYMENT", "EXPIRED", "CANCELLED"].includes(booking.status)) return booking; // already handled (webhook retries)

  if (verified && (verified.amount !== booking.totalAmount || verified.currency.toUpperCase() !== booking.currency.toUpperCase())) {
    await flagBooking(booking.id, "PAYMENT_AMOUNT_MISMATCH", `Payment ${transactionId ?? ""} of ${verified.amount} ${verified.currency.toUpperCase()} doesn't match the total ${booking.totalAmount} ${booking.currency}; not confirmed.`, booking.adminNotes);
    return booking;
  }

  if (booking.status === "EXPIRED" || booking.status === "CANCELLED") {
    if (!transactionId) return booking;
    // Money arrived for a booking whose seats were already released: keep the record true and
    // leave it to staff to refund or rebook by hand.
    const recorded = await prisma.payment.updateMany({
      where: { bookingId: booking.id, transactionId, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "SUCCEEDED" },
    });
    if (recorded.count > 0) {
      await flagBooking(booking.id, "LATE_PAYMENT", `Payment ${transactionId} succeeded after the booking was ${booking.status.toLowerCase()}; seats were released. Refund or rebook by hand.`, booking.adminNotes);
    }
    return booking;
  }

  const confirmedNow = await prisma.$transaction(async (tx) => {
    const moved = await transitionBooking(tx, booking.id, ["PENDING_PAYMENT"], "CONFIRMED", { transactionId: transactionId ?? null });
    if (!moved) return null;
    await tx.payment.updateMany({
      where: { bookingId: booking.id, status: "PENDING" },
      data: { status: "SUCCEEDED", ...(transactionId ? { transactionId } : {}) },
    });
    // Partner commission is earned only here, on a verified payment, in the same transaction.
    return { commission: await earnCommission(tx, booking.id, verified?.amount ?? booking.totalAmount) };
  });
  const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
  if (!confirmedNow) return updated; // a concurrent call confirmed (and emailed) it
  if (confirmedNow.commission) notifyCommissionEarned(confirmedNow.commission.affiliateId, booking.bookingReference, confirmedNow.commission.amountCents, booking.currency);

  const tour = booking.tourDeparture.tour;

  const title = tour?.title || booking.tourDeparture.shuttleRoute?.name || "Vista Chase experience";
  const when = `${formatDateOnly(booking.tourDeparture.date)} at ${formatTimeOfDay(booking.tourDeparture.departureTime)}`;
  const total = `$${(booking.totalAmount / 100).toFixed(2)} ${booking.currency}`;
  const link = voucherLink(booking.bookingReference);
  getEmailProvider()
    .sendEmail({
      to: booking.customerEmail,
      subject: `Your Vista Chase booking is confirmed: ${booking.bookingReference}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1c1f23;">
          <h2>Your booking is confirmed</h2>
          <p>Hi ${escapeHtml(booking.customerName)}, thank you for booking with Vista Chase.</p>
          <div style="border: 1px solid #e1e1db; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p><strong>Booking reference:</strong> ${booking.bookingReference}</p>
            <p><strong>Experience:</strong> ${escapeHtml(title)}</p>
            <p><strong>Date and time:</strong> ${when} (Mountain Time)</p>
            <p><strong>Total paid:</strong> ${total}</p>
          </div>
          <p><a href="${link}" style="color: #257780; font-weight: bold;">Open your voucher</a> and show it to your guide at pickup.</p>
          <p style="color: #5d6168; font-size: 13px;">Free cancellation up to 72 hours before departure. Questions? Reply to this email or call +1 (825) 734-9456.</p>
        </div>`,
      text: `Your Vista Chase booking ${booking.bookingReference} is confirmed.\n${title}, ${when} (Mountain Time).\nTotal paid: ${total}.\nVoucher: ${link}\nFree cancellation up to 72 hours before departure.`,
    })
    .catch((e) => console.error("Confirmation email failed:", (e as Error).message));

  return updated;
}

/** Notes a problem on the booking for staff, in the audit log and as an open flag (Admin → Bookings → Flags). */
async function flagBooking(bookingId: string, action: "PAYMENT_AMOUNT_MISMATCH" | "LATE_PAYMENT", note: string, existingNotes: string | null) {
  console.warn(`Booking ${bookingId} flagged: ${action}`);
  await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { adminNotes: [existingNotes, note].filter(Boolean).join("\n") } }),
    prisma.auditLog.create({ data: { action, entityType: "Booking", entityId: bookingId, details: { note } } }),
    prisma.bookingFlag.create({ data: { bookingId, type: action, note } }),
  ]);
}

/** Payment failed or was never completed: cancel the pending booking and release its seats (once). */
export async function failPendingBooking(reference: string, reason: string) {
  const booking = await prisma.booking.findUnique({ where: { bookingReference: reference } });
  if (!booking || booking.status !== "PENDING_PAYMENT") return false;
  return await prisma.$transaction(async (tx) => {
    const ended = await endBooking(tx, booking, ["PENDING_PAYMENT"], "CANCELLED", reason);
    if (ended) {
      await tx.booking.update({ where: { id: booking.id }, data: { adminNotes: [booking.adminNotes, `Payment not completed: ${reason}`].filter(Boolean).join("\n") } });
    }
    return ended;
  });
}

/** Expires bookings whose payment window has passed and frees their seats (run by the jobs). */
export async function expireUnpaidBookings(now = new Date()) {
  return (await freeExpiredSeats({ now })).bookings;
}

export async function getBookingByReference(reference: string) {
  return await prisma.booking.findUnique({
    where: { bookingReference: reference },
    include: {
      tourDeparture: { include: { tour: true, shuttleRoute: true } },
      pickupStop: true,
      items: true,
      payments: true,
      review: true,
    },
  });
}

/**
 * Refund owed under the cancellation policy, in cents: full for 1–6 guests; for 7+ guests and
 * multi-day trips the 20% deposit is kept.
 */
export function refundableAmount(paidCents: number, guests: number, category?: string | null) {
  const keepsDeposit = guests >= 7 || category === "MULTIDAY";
  return keepsDeposit ? Math.round(paidCents * 0.8) : paidCents;
}

/** Cancels a booking for its owner (the caller has already proved ownership). */
export async function cancelBooking(reference: string, customerEmail?: string) {
  const booking = await prisma.booking.findUnique({
    where: { bookingReference: reference },
    include: { tourDeparture: { include: { tour: true, shuttleRoute: true } }, payments: true },
  });
  if (!booking) return { success: false, error: "Booking reference not found" };
  if (!customerEmail || booking.customerEmail.toLowerCase() !== customerEmail.toLowerCase()) {
    return { success: false, error: "Unauthorized: Booking belongs to another account or email not provided" };
  }
  if (booking.status === "CANCELLED" || booking.status === "REFUNDED" || booking.status === "EXPIRED") {
    return { success: false, error: "Booking is already cancelled" };
  }

  // Policy (vistachase.com terms): cancel at least 72 hours before departure, in Mountain Time.
  const departureAt = getMountainTimeInstant(booking.tourDeparture.date, booking.tourDeparture.departureTime);
  const hoursLeft = (departureAt.getTime() - Date.now()) / 3_600_000;
  if (hoursLeft < 72) {
    return {
      success: false,
      error: `Cancellation window closed. Bookings can be cancelled for a refund up to 72 hours before departure. This departure is in ${Math.max(0, Math.round(hoursLeft))} hours.`,
    };
  }

  // The status move is the claim, so a double-submitted cancel releases the seats once.
  const cancelledNow = await prisma.$transaction((tx) =>
    endBooking(tx, booking, ["PENDING_PAYMENT", "CONFIRMED", "PAID_UNSYNCED"], "CANCELLED", "cancelled by guest"),
  );
  if (!cancelledNow) return { success: false, error: "Booking is already cancelled" };
  const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });

  // Outside the transaction: the payment provider is a network call.
  let refundedCents = 0;
  for (const payment of booking.payments.filter((p) => p.status === "SUCCEEDED")) {
    const amount = refundableAmount(payment.amount, booking.totalSeats, booking.tourDeparture.tour?.category);
    try {
      const refund = await getPaymentProvider().refundPayment(payment.transactionId, amount);
      if (refund.success) {
        refundedCents += amount;
        await prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
        // Keyed by the provider's refund id, so the Stripe webhook for this refund is a no-op.
        await reverseCommissionForRefund(booking.id, refund.refundId, amount, "guest cancelled").catch((e) =>
          console.error(`Commission reversal failed for ${booking.bookingReference}:`, (e as Error).message),
        );
      }
    } catch (error) {
      console.error(`Refund failed for ${booking.bookingReference}:`, (error as Error).message);
    }
  }
  if (refundedCents > 0) {
    await prisma.$transaction((tx) => transitionBooking(tx, booking.id, ["CANCELLED"], "REFUNDED", { refundedCents }));
  }
  const final = refundedCents > 0 ? await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }) : updated;

  getEmailProvider()
    .sendEmail({
      to: booking.customerEmail,
      subject: `Your Vista Chase booking is cancelled: ${booking.bookingReference}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1c1f23;">
          <h2>Booking cancelled</h2>
          <p>Your booking <strong>${booking.bookingReference}</strong> for <strong>${escapeHtml(booking.tourDeparture.tour?.title || booking.tourDeparture.shuttleRoute?.name || "Vista Chase experience")}</strong> on ${formatDateOnly(booking.tourDeparture.date)} has been cancelled.</p>
          ${refundedCents > 0 ? `<p>We have refunded <strong>$${(refundedCents / 100).toFixed(2)} ${booking.currency}</strong> to your original payment method; it usually arrives within 5–10 business days.</p>` : ""}
          <p>Bookings of 1–6 guests are refunded in full. For groups of 7 or more and multi-day trips, the 20% deposit is non-refundable.</p>
          <p>Questions? Reply to this email or call +1 (825) 734-9456.</p>
        </div>`,
      text: `Your Vista Chase booking ${booking.bookingReference} is cancelled.${refundedCents > 0 ? ` Refund: $${(refundedCents / 100).toFixed(2)} ${booking.currency}.` : ""}`,
    })
    .catch((e) => console.error("Cancellation email failed:", (e as Error).message));

  return { success: true, booking: final, refundedAmount: refundedCents / 100, message: "Reservation cancelled and capacity released." };
}

export async function getCustomerBookings(customerEmail: string) {
  return await prisma.booking.findMany({
    // Expired checkouts were never paid for, so they aren't the guest's trips.
    where: { customerEmail: { equals: customerEmail, mode: "insensitive" }, status: { not: "EXPIRED" } },
    include: { tourDeparture: { include: { tour: true, shuttleRoute: true } }, pickupStop: true, review: true },
    orderBy: { createdAt: "desc" },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Tell the partner a referred booking earned commission (fire and forget). */
function notifyCommissionEarned(affiliateId: string, reference: string, amountCents: number, currency: string) {
  prisma.affiliate
    .findUnique({ where: { id: affiliateId }, include: { user: { select: { email: true, name: true } } } })
    .then((a) => {
      if (a) sendCommissionEarnedEmail({ email: a.user.email, contactName: a.user.name, bookingReference: reference, amount: amountCents / 100, currency });
    })
    .catch((e) => console.error("Commission email failed:", (e as Error).message));
}
