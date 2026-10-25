// Staff booking administration (docs/ADMIN.md): cancel with a refund decision, Quick Book for a
// guest paying by phone, cash or e-transfer, and the flags that track what staff still owe or are
// owed. Seats move only through modules/departures/inventory.ts and statuses only through
// booking-status.ts, exactly as for guest bookings.
//
// Refunds: a staff cancellation works out the refund (policy, full or none) and records it as a
// REFUND_DUE flag. Money is sent back through the payment provider only when
// STAFF_REFUNDS_VIA_PROVIDER=true; otherwise staff refund by hand and press "Mark refunded", which
// moves the booking to REFUNDED and reverses partner commission like a provider refund does.

import crypto from "node:crypto";
import type { BookingFlagType, Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { getEmailProvider } from "@/lib/email/email.provider";
import { getPaymentProvider } from "@/lib/payment/payment.provider";
import { voucherLink } from "@/lib/security/signed-links";
import { formatDateOnly, formatTimeOfDay } from "@/lib/utils/time";
import { transitionBooking } from "@/modules/bookings/booking-status";
import { confirmPaidBooking, createBooking, refundableAmount, type CreateBookingInput } from "@/modules/bookings/booking.repository";
import { depositPlanRefundCents } from "@/modules/bookings/deposit";
import { earnCommission, reverseCommissionForRefund } from "@/modules/affiliates/commission";
import { endBooking } from "@/modules/departures/inventory";

export const OFFLINE_METHODS = ["CASH", "ETRANSFER", "CARD_TERMINAL", "OTHER"] as const;
export type OfflineMethod = (typeof OFFLINE_METHODS)[number];
export type RefundChoice = "POLICY" | "FULL" | "NONE";

/** Payment records staff enter by hand carry this provider name; they never reach Stripe. */
export const OFFLINE_PROVIDER = "offline";

export function staffRefundsViaProvider() {
  return process.env.STAFF_REFUNDS_VIA_PROVIDER === "true";
}

const money = (cents: number, currency: string) => `$${(cents / 100).toFixed(2)} ${currency}`;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function appendNote(tx: Prisma.TransactionClient, bookingId: string, note: string) {
  const current = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, select: { adminNotes: true } });
  await tx.booking.update({ where: { id: bookingId }, data: { adminNotes: [current.adminNotes, note].filter(Boolean).join("\n") } });
}

function staffAudit(tx: Prisma.TransactionClient, staffId: string, action: string, entityType: string, entityId: string, details: Record<string, unknown>) {
  return tx.auditLog.create({ data: { userId: staffId, action, entityType, entityId, details: details as Prisma.InputJsonValue } });
}

// ---------------------------------------------------------------------------------------------
// Cancel

export interface StaffCancelInput {
  reason: string;
  refund: RefundChoice;
  notifyGuest: boolean;
}

export async function staffCancelBooking(bookingId: string, input: StaffCancelInput, staffId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { tourDeparture: { include: { tour: true, shuttleRoute: true } }, payments: true },
  });
  if (!booking) return { status: 404, error: "Booking not found" } as const;
  if (!["PENDING_PAYMENT", "CONFIRMED", "PAID_UNSYNCED"].includes(booking.status)) {
    return { status: 409, error: `This booking is already ${booking.status.toLowerCase().replace("_", " ")}.` } as const;
  }

  const paid = booking.payments.filter((p) => p.status === "SUCCEEDED");
  const paidCents = paid.reduce((sum, p) => sum + p.amount, 0);
  // Policy refund: a DEPOSIT booking keeps its deposit; otherwise the group / multi-day rule.
  const policyRefund =
    booking.paymentPlan === "DEPOSIT" ? depositPlanRefundCents(booking, booking.payments) : refundableAmount(paidCents, booking.totalSeats, booking.tourDeparture.tour?.category);
  const owed = input.refund === "NONE" ? 0 : input.refund === "FULL" ? paidCents : policyRefund;

  // The status move is the claim: a double-submitted cancel releases the seats once.
  const cancelled = await prisma.$transaction(async (tx) => {
    const ended = await endBooking(tx, booking, ["PENDING_PAYMENT", "CONFIRMED", "PAID_UNSYNCED"], "CANCELLED", `cancelled by staff: ${input.reason}`);
    if (!ended) return false;
    await appendNote(tx, booking.id, `Cancelled by staff: ${input.reason}`);
    // Nothing is collected for a cancelled booking any more.
    await tx.bookingFlag.updateMany({
      where: { bookingId: booking.id, type: "PAYMENT_DUE", status: "OPEN" },
      data: { status: "RESOLVED", resolvedById: staffId, resolvedAt: new Date(), resolution: "Booking cancelled; nothing to collect." },
    });
    await staffAudit(tx, staffId, "STAFF_CANCEL", "Booking", booking.id, { reason: input.reason, refund: input.refund, paidCents, refundOwedCents: owed });
    return true;
  });
  if (!cancelled) return { status: 409, error: "This booking was already cancelled." } as const;

  // Outside the transaction: the payment provider is a network call.
  let refundedCents = 0;
  if (owed > 0 && staffRefundsViaProvider()) {
    let left = owed;
    for (const payment of paid.filter((p) => p.provider !== OFFLINE_PROVIDER)) {
      const amount = Math.min(left, payment.amount);
      if (amount <= 0) break;
      try {
        const refund = await getPaymentProvider().refundPayment(payment.transactionId, amount, { bookingReference: booking.bookingReference });
        if (!refund.success) continue;
        refundedCents += amount;
        left -= amount;
        await prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
        await reverseCommissionForRefund(booking.id, refund.refundId, amount, "cancelled by staff").catch((e) =>
          console.error(`Commission reversal failed for ${booking.bookingReference}:`, (e as Error).message),
        );
      } catch (error) {
        console.error(`Refund failed for ${booking.bookingReference}:`, (error as Error).message);
      }
    }
  }
  const stillOwed = owed - refundedCents;

  let flagId: string | null = null;
  await prisma.$transaction(async (tx) => {
    if (refundedCents > 0 && stillOwed === 0) await transitionBooking(tx, booking.id, ["CANCELLED"], "REFUNDED", { refundedCents, by: "provider" });
    if (stillOwed > 0) {
      const flag = await tx.bookingFlag.create({
        data: {
          bookingId: booking.id,
          type: "REFUND_DUE",
          amountCents: stillOwed,
          createdById: staffId,
          note: `Refund ${money(stillOwed, booking.currency)} owed after staff cancellation (${input.refund.toLowerCase()}): ${input.reason}`,
        },
      });
      flagId = flag.id;
    }
  });

  if (input.notifyGuest) {
    const title = booking.tourDeparture.tour?.title || booking.tourDeparture.shuttleRoute?.name || "Vista Chase experience";
    const refundLine =
      refundedCents > 0 && stillOwed === 0
        ? `We have refunded ${money(refundedCents, booking.currency)} to your original payment method; it usually arrives within 5–10 business days.`
        : owed > 0
          ? `A refund of ${money(owed, booking.currency)} is on its way; we'll confirm once it has been sent.`
          : "";
    getEmailProvider()
      .sendEmail({
        to: booking.customerEmail,
        subject: `Your Vista Chase booking is cancelled: ${booking.bookingReference}`,
        html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1c1f23;">
          <h2>Booking cancelled</h2>
          <p>Hi ${escapeHtml(booking.customerName)}, your booking <strong>${booking.bookingReference}</strong> for <strong>${escapeHtml(title)}</strong> on ${formatDateOnly(booking.tourDeparture.date)} has been cancelled.</p>
          ${refundLine ? `<p>${refundLine}</p>` : ""}
          <p>Questions? Reply to this email or call +1 (825) 734-9456.</p>
        </div>`,
        text: `Your Vista Chase booking ${booking.bookingReference} is cancelled.${refundLine ? ` ${refundLine}` : ""}`,
      })
      .catch((e) => console.error("Cancellation email failed:", (e as Error).message));
  }

  return { status: 200, paidCents, refundOwedCents: owed, refundedCents, refundDueCents: stillOwed, flagId } as const;
}

// ---------------------------------------------------------------------------------------------
// Flags

export async function listFlags(filter: { status?: "OPEN" | "RESOLVED"; type?: BookingFlagType; bookingId?: string }) {
  const flags = await prisma.bookingFlag.findMany({
    where: { status: filter.status, type: filter.type, bookingId: filter.bookingId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      booking: {
        select: {
          id: true, bookingReference: true, status: true, customerName: true, customerEmail: true, totalAmount: true, currency: true,
          tourDeparture: { select: { date: true, departureTime: true, tour: { select: { title: true } }, shuttleRoute: { select: { name: true } } } },
        },
      },
    },
  });
  const counts = await prisma.bookingFlag.groupBy({ by: ["type"], where: { status: "OPEN" }, _count: true });
  return {
    flags: flags.map((f) => ({
      ...f,
      amount: f.amountCents != null ? f.amountCents / 100 : null,
      booking: {
        ...f.booking,
        totalAmount: f.booking.totalAmount / 100,
        experience: f.booking.tourDeparture.tour?.title ?? f.booking.tourDeparture.shuttleRoute?.name ?? null,
        date: formatDateOnly(f.booking.tourDeparture.date),
        departureTime: formatTimeOfDay(f.booking.tourDeparture.departureTime),
      },
    })),
    open: Object.fromEntries(counts.map((c) => [c.type, c._count])) as Partial<Record<BookingFlagType, number>>,
  };
}

/** Claims an open flag for resolution, once. Null when it was already resolved. */
async function claimFlag(tx: Prisma.TransactionClient, flagId: string, staffId: string, resolution: string) {
  const claimed = await tx.bookingFlag.updateMany({
    where: { id: flagId, status: "OPEN" },
    data: { status: "RESOLVED", resolvedById: staffId, resolvedAt: new Date(), resolution },
  });
  return claimed.count === 1 ? tx.bookingFlag.findUniqueOrThrow({ where: { id: flagId } }) : null;
}

/** Closes a flag that needs no money moved (a mismatch checked, a late payment rebooked). */
export async function resolveFlag(flagId: string, resolution: string, staffId: string) {
  const flag = await prisma.bookingFlag.findUnique({ where: { id: flagId }, include: { booking: { select: { status: true } } } });
  if (!flag) return { status: 404, error: "Flag not found" } as const;
  // A payment due on a booking that was cancelled since can simply be closed.
  const dueOnLiveBooking = flag.type === "PAYMENT_DUE" && ["CONFIRMED", "COMPLETED", "PAID_UNSYNCED"].includes(flag.booking.status);
  if (flag.type === "REFUND_DUE" || dueOnLiveBooking) {
    return { status: 400, error: flag.type === "REFUND_DUE" ? "Use Mark refunded for a refund that is owed." : "Use Record payment for a payment that is due." } as const;
  }
  const done = await prisma.$transaction(async (tx) => {
    const claimed = await claimFlag(tx, flagId, staffId, resolution);
    if (claimed) await staffAudit(tx, staffId, "RESOLVE_FLAG", "Booking", flag.bookingId, { flagId, type: flag.type, resolution });
    return claimed;
  });
  return done ? ({ status: 200, flag: done } as const) : ({ status: 409, error: "This flag was already resolved." } as const);
}

/**
 * A refund staff sent by hand (bank transfer, card terminal, Stripe dashboard): closes the
 * REFUND_DUE flag, moves the booking to REFUNDED and reverses partner commission for the amount.
 */
export async function markRefunded(flagId: string, input: { reference: string; note?: string }, staffId: string) {
  const flag = await prisma.bookingFlag.findUnique({ where: { id: flagId } });
  if (!flag) return { status: 404, error: "Flag not found" } as const;
  if (flag.type !== "REFUND_DUE") return { status: 400, error: "This flag is not a refund." } as const;
  const amount = flag.amountCents ?? 0;
  const resolution = `Refunded by hand, reference ${input.reference}${input.note ? `: ${input.note}` : ""}`;

  const done = await prisma.$transaction(async (tx) => {
    const claimed = await claimFlag(tx, flagId, staffId, resolution);
    if (!claimed) return null;
    await transitionBooking(tx, flag.bookingId, ["CANCELLED"], "REFUNDED", { refundedCents: amount, by: "staff", reference: input.reference });
    await tx.payment.updateMany({ where: { bookingId: flag.bookingId, status: "SUCCEEDED" }, data: { status: "REFUNDED" } });
    await appendNote(tx, flag.bookingId, `Refund of ${(amount / 100).toFixed(2)} sent by hand (${input.reference}).`);
    await staffAudit(tx, staffId, "MARK_REFUNDED", "Booking", flag.bookingId, { flagId, amountCents: amount, reference: input.reference });
    return claimed;
  });
  if (!done) return { status: 409, error: "This refund was already marked as sent." } as const;
  // Keyed by the flag, so pressing the button twice can't reverse commission twice.
  await reverseCommissionForRefund(flag.bookingId, `manual:${flag.id}`, amount, "refunded by staff").catch((e) =>
    console.error(`Commission reversal failed for flag ${flag.id}:`, (e as Error).message),
  );
  return { status: 200, flag: done } as const;
}

/** Payment for a Quick Book booking left unpaid: records it, closes PAYMENT_DUE, earns commission. */
export async function recordPayment(flagId: string, input: { method: OfflineMethod; reference?: string }, staffId: string) {
  const flag = await prisma.bookingFlag.findUnique({ where: { id: flagId }, include: { booking: true } });
  if (!flag) return { status: 404, error: "Flag not found" } as const;
  if (flag.type !== "PAYMENT_DUE") return { status: 400, error: "This flag is not a payment that is due." } as const;
  const booking = flag.booking;
  const amount = flag.amountCents ?? booking.totalAmount;
  const resolution = `Paid by ${input.method.toLowerCase().replace("_", " ")}${input.reference ? `, reference ${input.reference}` : ""}`;

  const done = await prisma.$transaction(async (tx) => {
    const claimed = await claimFlag(tx, flagId, staffId, resolution);
    if (!claimed) return null;
    await tx.payment.create({
      data: {
        bookingId: booking.id,
        amount,
        currency: booking.currency,
        provider: OFFLINE_PROVIDER,
        transactionId: offlineTransactionId(input.method),
        kind: booking.paymentPlan === "DEPOSIT" ? "BALANCE" : "FULL",
        status: "SUCCEEDED",
      },
    });
    if (booking.paymentPlan === "DEPOSIT") {
      // A deposit booking's balance collected by staff: paid in full now, commission on the total.
      const paid = await tx.payment.aggregate({ where: { bookingId: booking.id, status: "SUCCEEDED" }, _sum: { amount: true } });
      const total = paid._sum.amount ?? 0;
      if (total >= booking.totalAmount) {
        await tx.booking.update({ where: { id: booking.id }, data: { balancePaidAt: new Date() } });
        if (booking.status === "CONFIRMED") await earnCommission(tx, booking.id, total);
      }
    } else if (booking.status === "CONFIRMED") await earnCommission(tx, booking.id, amount);
    await appendNote(tx, booking.id, `${resolution}: ${(amount / 100).toFixed(2)} ${booking.currency}.`);
    await staffAudit(tx, staffId, "RECORD_PAYMENT", "Booking", booking.id, { flagId, amountCents: amount, method: input.method, reference: input.reference ?? null });
    return claimed;
  });
  return done ? ({ status: 200, flag: done } as const) : ({ status: 409, error: "This payment was already recorded." } as const);
}

function offlineTransactionId(method: OfflineMethod) {
  return `offline_${method.toLowerCase()}_${crypto.randomBytes(8).toString("hex")}`;
}

// ---------------------------------------------------------------------------------------------
// Quick Book

export interface QuickBookInput extends Omit<CreateBookingInput, "holdToken" | "affiliateCode" | "customerId"> {
  payment: { method: OfflineMethod | "UNPAID"; reference?: string };
  /** Email the guest their confirmation and voucher (default true). */
  notifyGuest?: boolean;
}

/**
 * Books a departure for a guest on the phone or at the desk. The price is the server's, as for an
 * online booking. Paid by cash, e-transfer or card terminal: the payment is recorded and the
 * booking confirmed (with the usual confirmation email). Unpaid: confirmed, with a PAYMENT_DUE
 * flag, and the guest gets the voucher without a "paid" line.
 */
export async function quickBook(input: QuickBookInput, staffId: string) {
  const { payment, notifyGuest = true, ...booking } = input;
  const created = await createBooking(booking, { offlinePayment: true, allowAfterCutoff: true });
  if (!created.success || !created.booking) return { status: 409, error: created.error ?? "The booking could not be made." } as const;
  const { id, bookingReference } = created.booking;
  // A repeated submit (same idempotency key) answers with the booking the first one made.
  if (created.replayed) return { status: 200, booking: created.booking, replayed: true } as const;

  const record = await prisma.booking.findUniqueOrThrow({ where: { id } });
  await prisma.auditLog.create({
    data: { userId: staffId, action: "QUICK_BOOK", entityType: "Booking", entityId: id, details: { method: payment.method, reference: payment.reference ?? null, totalCents: record.totalAmount } },
  });

  if (payment.method !== "UNPAID" || record.totalAmount === 0) {
    if (record.totalAmount > 0) {
      await prisma.payment.create({
        data: { bookingId: id, amount: record.totalAmount, currency: record.currency, provider: OFFLINE_PROVIDER, transactionId: offlineTransactionId(payment.method as OfflineMethod), status: "PENDING" },
      });
    }
    const note = `Quick Book, paid by ${payment.method.toLowerCase().replace("_", " ")}${payment.reference ? ` (${payment.reference})` : ""}.`;
    await prisma.booking.update({ where: { id }, data: { adminNotes: note } });
    // Same confirmation as an instant online payment: PENDING → SUCCEEDED, commission, email.
    if (notifyGuest) await confirmPaidBooking(bookingReference);
    else await confirmQuietly(id, record.totalAmount);
  } else {
    await prisma.$transaction(async (tx) => {
      await transitionBooking(tx, id, ["PENDING_PAYMENT"], "CONFIRMED", { by: "staff", unpaid: true });
      await tx.booking.update({ where: { id }, data: { paymentExpiresAt: null, adminNotes: "Quick Book, payment still due." } });
      await tx.bookingFlag.create({
        data: { bookingId: id, type: "PAYMENT_DUE", amountCents: record.totalAmount, createdById: staffId, note: `Quick Book: ${money(record.totalAmount, record.currency)} still to collect.` },
      });
    });
    if (notifyGuest) sendVoucherEmail(id);
  }

  const final = await prisma.booking.findUniqueOrThrow({ where: { id }, include: { payments: { select: { status: true } } } });
  return { status: 201, booking: { ...created.booking, status: final.status } } as const;
}

/** Confirms a paid Quick Book booking without emailing the guest. */
async function confirmQuietly(bookingId: string, paidCents: number) {
  await prisma.$transaction(async (tx) => {
    const moved = await transitionBooking(tx, bookingId, ["PENDING_PAYMENT"], "CONFIRMED", { by: "staff" });
    if (!moved) return;
    await tx.payment.updateMany({ where: { bookingId, status: "PENDING" }, data: { status: "SUCCEEDED" } });
    await earnCommission(tx, bookingId, paidCents);
  });
}

/** Confirmation with the voucher link but no amount paid (Quick Book, payment still due). */
function sendVoucherEmail(bookingId: string) {
  prisma.booking
    .findUniqueOrThrow({ where: { id: bookingId }, include: { tourDeparture: { include: { tour: true, shuttleRoute: true } } } })
    .then((b) => {
      const title = b.tourDeparture.tour?.title || b.tourDeparture.shuttleRoute?.name || "Vista Chase experience";
      const when = `${formatDateOnly(b.tourDeparture.date)} at ${formatTimeOfDay(b.tourDeparture.departureTime)}`;
      const link = voucherLink(b.bookingReference);
      return getEmailProvider().sendEmail({
        to: b.customerEmail,
        subject: `Your Vista Chase booking is confirmed: ${b.bookingReference}`,
        html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1c1f23;">
          <h2>Your booking is confirmed</h2>
          <p>Hi ${escapeHtml(b.customerName)}, thank you for booking with Vista Chase.</p>
          <div style="border: 1px solid #e1e1db; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p><strong>Booking reference:</strong> ${b.bookingReference}</p>
            <p><strong>Experience:</strong> ${escapeHtml(title)}</p>
            <p><strong>Date and time:</strong> ${when} (Mountain Time)</p>
            <p><strong>Amount due:</strong> ${money(b.totalAmount, b.currency)}</p>
          </div>
          <p><a href="${link}" style="color: #257780; font-weight: bold;">Open your voucher</a> and show it to your guide at pickup.</p>
          <p style="color: #5d6168; font-size: 13px;">Questions? Reply to this email or call +1 (825) 734-9456.</p>
        </div>`,
        text: `Your Vista Chase booking ${b.bookingReference} is confirmed.\n${title}, ${when} (Mountain Time).\nAmount due: ${money(b.totalAmount, b.currency)}.\nVoucher: ${link}`,
      });
    })
    .catch((e) => console.error("Voucher email failed:", (e as Error).message));
}
