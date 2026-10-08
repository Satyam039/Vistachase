// Bookings: create (seats taken, payment started), confirm once paid, fail when payment fails or
// expires, cancel with the refund the policy allows.
//
// Flow: createBooking saves the booking as PENDING_PAYMENT and takes its seats in one transaction,
// then starts a payment for the server-computed total. The mock provider pays at once and the
// booking is confirmed straight away; with Stripe the guest pays in the browser and the Stripe
// webhook calls confirmPaidBooking. Bókun is told only about paid bookings, outside any database
// transaction; if Bókun fails, the booking is PAID_UNSYNCED for staff to finish (the reconciliation
// job lists them). All amounts are whole cents. No sales tax is added.

import crypto from "node:crypto";
import QRCode from "qrcode";
import prisma from "@/lib/db/prisma";
import { getBokunOperationsProvider } from "@/modules/bokun/bokun.provider";
import { formatDateOnly, formatTimeOfDay, getMountainTimeInstant } from "@/lib/utils/time";
import { getPaymentProvider } from "@/lib/payment/payment.provider";
import { getEmailProvider } from "@/lib/email/email.provider";
import { isVehicleDeparture, partySizeError, seatsToReserve } from "@/modules/pricing/departure-pricing";
import { priceBooking, type AddOnChoice } from "@/modules/pricing/booking-pricing";
import { findActiveAffiliateByCode } from "@/modules/affiliates/affiliate.repository";
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
}

export interface BookingResult {
  success: boolean;
  booking?: {
    id: string;
    bookingReference: string;
    voucherCode: string;
    totalAmount: number; // dollars, for display
    currency: string;
    status: string;
    qrCodeUrl: string | null;
    /** Signed link to the voucher page (also emailed), and its token for API calls. */
    voucherUrl: string;
    voucherToken: string;
  };
  /** Present when the guest still has to pay in the browser (Stripe Payment Element). */
  payment?: { provider: string; clientSecret: string; amount: number; currency: string };
  error?: string;
}

const PENDING_PAYMENT_MINUTES = 30;

function newReference() {
  return `VC-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function newVoucherCode() {
  return `VOUCH-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function createBooking(input: CreateBookingInput): Promise<BookingResult> {
  const totalSeats = input.adultsCount + input.childrenCount;
  if (input.adultsCount < 1) return { success: false, error: "At least one adult is required." };

  const created = await prisma.$transaction(async (tx) => {
    let holdRecord = null;
    if (input.holdToken) {
      holdRecord = await tx.reservationHold.findUnique({ where: { holdToken: input.holdToken } });
      if (!holdRecord || holdRecord.status !== "ACTIVE" || holdRecord.expiresAt < new Date()) {
        return { error: "Reservation hold expired. Please select your seats again." } as const;
      }
      if (holdRecord.tourDepartureId !== input.departureId) {
        return { error: "This reservation hold is for a different departure." } as const;
      }
    }

    const departure = await tx.tourDeparture.findUnique({
      where: { id: input.departureId },
      include: { tour: true, shuttleRoute: true },
    });
    if (!departure || departure.status !== "ACTIVE") return { error: "Departure not found" } as const;
    if (departure.tour?.bookingMode === "ENQUIRY") {
      return { error: "This experience is booked on request. Please send us an enquiry." } as const;
    }

    const partyError = partySizeError(departure, totalSeats);
    if (partyError) return { error: partyError } as const;

    // Capacity: shared departures take one seat per guest, private ones the whole vehicle
    const isVehicle = isVehicleDeparture(departure);
    const reservedSeats = seatsToReserve(departure, totalSeats);
    const heldByOthers = holdRecord ? Math.max(0, departure.capacityHeld - holdRecord.seatsCount) : departure.capacityHeld;
    const available = departure.capacityTotal - (departure.capacityBooked + heldByOthers);
    if (available < reservedSeats) {
      return {
        error: isVehicle
          ? "This private vehicle is already booked for this departure."
          : `Requested ${totalSeats} seats, but only ${Math.max(0, available)} seats are available.`,
      } as const;
    }

    const totals = priceBooking(departure, { adults: input.adultsCount, children: input.childrenCount }, input.addOns, input.promoCode);
    const bookingReference = newReference();

    const booking = await tx.booking.create({
      data: {
        bookingReference,
        customerId: input.customerId,
        affiliateId: (await findActiveAffiliateByCode(input.affiliateCode))?.id ?? null,
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
        specialRequests: input.specialRequests,
        voucherCode: newVoucherCode(),
        // Staff scan this to check the guest in; it carries a signature, not the guest's details.
        qrCodeUrl: await QRCode.toDataURL(checkinLink(bookingReference), { margin: 1, width: 300 }),
        items: { create: totals.addOns.map((a) => ({ name: a.name, price: a.priceCents, quantity: a.quantity })) },
      },
    });

    if (holdRecord) {
      await tx.reservationHold.update({ where: { id: holdRecord.id }, data: { status: "CONVERTED" } });
      await tx.tourDeparture.update({
        where: { id: input.departureId },
        data: { capacityBooked: { increment: reservedSeats }, capacityHeld: { decrement: holdRecord.seatsCount } },
      });
    } else {
      await tx.tourDeparture.update({ where: { id: input.departureId }, data: { capacityBooked: { increment: reservedSeats } } });
    }

    return { booking } as const;
  });

  if ("error" in created) return { success: false, error: created.error };
  const { booking } = created;

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

  const paidNow = !intent || intent.paid;
  const finalBooking = paidNow ? (await confirmPaidBooking(booking.bookingReference)) ?? booking : booking;

  return {
    success: true,
    booking: {
      id: finalBooking.id,
      bookingReference: finalBooking.bookingReference,
      voucherCode: finalBooking.voucherCode,
      totalAmount: finalBooking.totalAmount / 100,
      currency: finalBooking.currency,
      status: finalBooking.status,
      qrCodeUrl: finalBooking.qrCodeUrl,
      voucherUrl: voucherLink(finalBooking.bookingReference),
      voucherToken: signBookingLink(finalBooking.bookingReference, "voucher"),
    },
    payment:
      intent && !paidNow
        ? { provider: provider.name, clientSecret: intent.clientSecret, amount: booking.totalAmount / 100, currency: booking.currency }
        : undefined,
  };
}

/**
 * Marks a paid booking confirmed (idempotent), records the Bókun reservation and emails the
 * voucher. Called right after an instant payment, or by the Stripe webhook.
 */
export async function confirmPaidBooking(reference: string, transactionId?: string) {
  const booking = await prisma.booking.findUnique({
    where: { bookingReference: reference },
    include: { tourDeparture: { include: { tour: true, shuttleRoute: true } }, pickupStop: true },
  });
  if (!booking) return null;
  if (booking.status !== "PENDING_PAYMENT") return booking; // already handled (webhook retries)

  await prisma.payment.updateMany({
    where: { bookingId: booking.id, status: "PENDING" },
    data: { status: "SUCCEEDED", ...(transactionId ? { transactionId } : {}) },
  });

  // Tell Bókun about the paid booking. Products without a Bókun ID yet stay local.
  let status: "CONFIRMED" | "PAID_UNSYNCED" = "CONFIRMED";
  let bokunBookingId: string | null = null;
  const tour = booking.tourDeparture.tour;
  if (tour?.bokunId) {
    try {
      const bokun = getBokunOperationsProvider();
      const reservation = await bokun.createReservation({
        bokunBookingId: "",
        bookingReference: booking.bookingReference,
        productBokunId: tour.bokunId,
        departureDate: formatDateOnly(booking.tourDeparture.date),
        departureTime: formatTimeOfDay(booking.tourDeparture.departureTime),
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        totalSeats: booking.totalSeats,
        pickupLocation: booking.pickupStop?.name ?? booking.pickupCustomText ?? "",
        pickupTime: booking.pickupTime ?? undefined,
        status: "CONFIRMED",
        totalAmount: booking.totalAmount / 100,
        currency: booking.currency,
        sourceChannel: "WEBSITE",
        specialRequests: booking.specialRequests ?? undefined,
      });
      await bokun.confirmReservation(reservation.bokunBookingId);
      bokunBookingId = reservation.bokunBookingId;
    } catch (error) {
      console.error(`Bókun reservation failed for ${booking.bookingReference}:`, (error as Error).message);
      status = "PAID_UNSYNCED"; // the guest has paid; staff finish the Bókun side
    }
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status, ...(bokunBookingId ? { bokunBookingId } : {}) },
  });

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

/** Payment failed or was never completed: cancel the pending booking and release its seats. */
export async function failPendingBooking(reference: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { bookingReference: reference },
      include: { tourDeparture: { include: { tour: true } } },
    });
    if (!booking || booking.status !== "PENDING_PAYMENT") return false;
    await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED", adminNotes: `Payment not completed: ${reason}` } });
    await tx.payment.updateMany({ where: { bookingId: booking.id, status: "PENDING" }, data: { status: "FAILED" } });
    const released = Math.min(booking.tourDeparture.capacityBooked, seatsToReserve(booking.tourDeparture, booking.totalSeats));
    await tx.tourDeparture.update({ where: { id: booking.tourDepartureId }, data: { capacityBooked: { decrement: released } } });
    return true;
  });
}

/** Cancels bookings whose payment window has passed (run by the worker). */
export async function expireUnpaidBookings(now = new Date()) {
  const cutoff = new Date(now.getTime() - PENDING_PAYMENT_MINUTES * 60 * 1000);
  const stale = await prisma.booking.findMany({
    where: { status: "PENDING_PAYMENT", createdAt: { lt: cutoff } },
    select: { bookingReference: true },
  });
  let expired = 0;
  for (const b of stale) if (await failPendingBooking(b.bookingReference, "payment window expired")) expired++;
  return expired;
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
  if (booking.status === "CANCELLED" || booking.status === "REFUNDED") {
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

  const updated = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
    const released = Math.min(booking.tourDeparture.capacityBooked, seatsToReserve(booking.tourDeparture, booking.totalSeats));
    await tx.tourDeparture.update({ where: { id: booking.tourDepartureId }, data: { capacityBooked: { decrement: released } } });
    return cancelled;
  });

  // Outside the transaction: Bókun and the payment provider are network calls.
  if (booking.bokunBookingId) {
    await getBokunOperationsProvider().cancelBooking(booking.bokunBookingId).catch((e) => console.error("Bókun cancel failed:", (e as Error).message));
  }
  let refundedCents = 0;
  for (const payment of booking.payments.filter((p) => p.status === "SUCCEEDED")) {
    const amount = refundableAmount(payment.amount, booking.totalSeats, booking.tourDeparture.tour?.category);
    try {
      const refund = await getPaymentProvider().refundPayment(payment.transactionId, amount);
      if (refund.success) {
        refundedCents += amount;
        await prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
      }
    } catch (error) {
      console.error(`Refund failed for ${booking.bookingReference}:`, (error as Error).message);
    }
  }
  const final = refundedCents > 0 ? await prisma.booking.update({ where: { id: booking.id }, data: { status: "REFUNDED" } }) : updated;

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
    where: { customerEmail: { equals: customerEmail, mode: "insensitive" } },
    include: { tourDeparture: { include: { tour: true, shuttleRoute: true } }, pickupStop: true, review: true },
    orderBy: { createdAt: "desc" },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
