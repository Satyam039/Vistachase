// Requests staff decide on (docs/ADMIN.md "Requests"):
//
// - Cancellation requests: a guest asks to cancel from My trips. The request is an OPEN
//   CANCEL_REQUEST flag carrying the guest's reason and the refund the published policy gives at
//   that moment. Staff approve it (the booking is cancelled through staffCancelBooking with the
//   refund they choose; "policy" follows the guest's rules as they stood when the guest asked) or
//   decline it with a reason the guest is emailed. Nothing changes for the booking until staff act.
// - Approve booking: a booking left PENDING_PAYMENT (the card payment failed or never finished) or
//   PAID_UNSYNCED is confirmed by hand, paid offline or with the payment still due (a PAYMENT_DUE
//   flag), like Quick Book. Online payments still pending for it are marked FAILED so a late card
//   payment is caught as a flag (confirmPaidBooking) instead of being counted twice.

import type { BookingStatus } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { getEmailProvider } from "@/lib/email/email.provider";
import { formatDateOnly, formatTimeOfDay } from "@/lib/utils/time";
import { transitionBooking } from "@/modules/bookings/booking-status";
import { refundableAmount } from "@/modules/bookings/booking.repository";
import { depositPlanRefundCents } from "@/modules/bookings/deposit";
import { earnCommission } from "@/modules/affiliates/commission";
import {
  GUEST_CANCEL_HOURS,
  OFFLINE_PROVIDER,
  appendNote,
  claimFlag,
  escapeHtml,
  hoursBeforeDeparture,
  offlineTransactionId,
  sendVoucherEmail,
  staffAudit,
  staffCancelBooking,
  type OfflineMethod,
  type RefundChoice,
} from "@/modules/admin/booking-admin";

const LIVE: BookingStatus[] = ["PENDING_PAYMENT", "CONFIRMED", "PAID_UNSYNCED"];
const money = (cents: number, currency: string) => `$${(cents / 100).toFixed(2)} ${currency}`;

type BookingForRefund = Parameters<typeof depositPlanRefundCents>[0] & {
  totalSeats: number;
  payments: Parameters<typeof depositPlanRefundCents>[1];
  tourDeparture: { date: Date; departureTime: Date; tour: { category: string } | null };
};

/** What the guest's own cancellation policy gives back if the booking is cancelled at `at`. */
export function guestPolicyRefundCents(booking: BookingForRefund, at = new Date()) {
  if (hoursBeforeDeparture(booking.tourDeparture, at) < GUEST_CANCEL_HOURS) return 0;
  if (booking.paymentPlan === "DEPOSIT") return depositPlanRefundCents(booking, booking.payments);
  const paid = booking.payments.filter((p) => p.status === "SUCCEEDED").reduce((sum, p) => sum + p.amount, 0);
  return refundableAmount(paid, booking.totalSeats, booking.tourDeparture.tour?.category);
}

function titleOf(b: { tourDeparture: { tour: { title: string } | null; shuttleRoute: { name: string } | null } }) {
  return b.tourDeparture.tour?.title || b.tourDeparture.shuttleRoute?.name || "Vista Chase experience";
}

function guestEmail(to: string, subject: string, heading: string, paragraphs: string[]) {
  getEmailProvider()
    .sendEmail({
      to,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1c1f23;">
          <h2>${heading}</h2>
          ${paragraphs.map((p) => `<p>${p}</p>`).join("\n          ")}
          <p style="color: #5d6168; font-size: 13px;">Questions? Reply to this email or call +1 (825) 734-9456.</p>
        </div>`,
      text: paragraphs.map((p) => p.replace(/<[^>]+>/g, "")).join("\n\n"),
    })
    .catch((e) => console.error(`${heading} email failed:`, (e as Error).message));
}

function opsEmail(subject: string, text: string) {
  const to = process.env.OPS_ALERT_EMAIL || process.env.ENQUIRIES_TO;
  if (!to) return;
  getEmailProvider()
    .sendEmail({ to, subject, html: `<p>${escapeHtml(text)}</p>`, text })
    .catch((e) => console.error("Staff alert email failed:", (e as Error).message));
}

// ---------------------------------------------------------------------------------------------
// Cancellation requests

/** The guest's request (the caller has proved they own the booking). One open request at a time. */
export async function requestCancellation(reference: string, reason: string, userId: string | null) {
  const booking = await prisma.booking.findUnique({
    where: { bookingReference: reference },
    include: { tourDeparture: { include: { tour: true, shuttleRoute: true } }, payments: true },
  });
  if (!booking) return { status: 404, error: "Booking not found" } as const;
  if (!LIVE.includes(booking.status)) return { status: 409, error: "This booking can't be cancelled any more." } as const;
  if (hoursBeforeDeparture(booking.tourDeparture) <= 0) return { status: 409, error: "This trip has already left." } as const;

  const estimate = guestPolicyRefundCents(booking);
  const flag = await prisma.$transaction(async (tx) => {
    const open = await tx.bookingFlag.findFirst({ where: { bookingId: booking.id, type: "CANCEL_REQUEST", status: "OPEN" } });
    if (open) return null;
    const created = await tx.bookingFlag.create({
      data: {
        bookingId: booking.id,
        type: "CANCEL_REQUEST",
        amountCents: estimate,
        note: `Guest asked to cancel${reason ? `: ${reason.replace(/[.!?]?$/, (end) => end || ".")}` : "."} Refund by the policy today: ${money(estimate, booking.currency)}.`,
      },
    });
    await tx.auditLog.create({
      data: { userId, action: "CANCEL_REQUESTED", entityType: "Booking", entityId: booking.id, details: { flagId: created.id, reason, policyRefundCents: estimate } },
    });
    return created;
  });
  if (!flag) return { status: 409, error: "You've already asked to cancel this booking. We'll email you once it's been reviewed." } as const;

  const title = titleOf(booking);
  guestEmail(booking.customerEmail, `We received your cancellation request: ${booking.bookingReference}`, "Cancellation request received", [
    `Hi ${escapeHtml(booking.customerName)}, we received your request to cancel <strong>${booking.bookingReference}</strong> for <strong>${escapeHtml(title)}</strong> on ${formatDateOnly(booking.tourDeparture.date)}.`,
    "Your booking stays active until our team reviews it. We'll email you as soon as it's done, usually within one business day.",
  ]);
  opsEmail(`Cancellation request ${booking.bookingReference}`, `${booking.customerName} asked to cancel ${booking.bookingReference} (${title}, ${formatDateOnly(booking.tourDeparture.date)}). Review it in Admin → Bookings → Requests.`);
  return { status: 201, request: { id: flag.id, status: flag.status, createdAt: flag.createdAt } } as const;
}

/** Approve: cancel the booking with the refund staff choose. POLICY uses the rules at request time. */
export async function approveCancellation(flagId: string, input: { refund: RefundChoice; note?: string; notifyGuest: boolean }, staffId: string) {
  const flag = await prisma.bookingFlag.findUnique({ where: { id: flagId }, include: { booking: { select: { status: true } } } });
  if (!flag || flag.type !== "CANCEL_REQUEST") return { status: 404, error: "Cancellation request not found" } as const;
  if (flag.status !== "OPEN") return { status: 409, error: "This request was already answered." } as const;
  if (!LIVE.includes(flag.booking.status)) {
    // Cancelled some other way meanwhile: nothing left to approve.
    await prisma.$transaction((tx) => claimFlag(tx, flagId, staffId, `Booking was already ${flag.booking.status.toLowerCase()}.`));
    return { status: 409, error: `This booking is already ${flag.booking.status.toLowerCase().replace("_", " ")}.` } as const;
  }
  const reason = `Guest request${input.note ? `: ${input.note}` : ""}`;
  // staffCancelBooking resolves the request flag in the same transaction as the cancellation.
  return staffCancelBooking(flag.bookingId, { reason, refund: input.refund, notifyGuest: input.notifyGuest, requestedAt: flag.createdAt }, staffId);
}

/** Decline: the booking stays as it is; the guest is told why. */
export async function declineCancellation(flagId: string, input: { reason: string; notifyGuest: boolean }, staffId: string) {
  const flag = await prisma.bookingFlag.findUnique({
    where: { id: flagId },
    include: { booking: { include: { tourDeparture: { include: { tour: true, shuttleRoute: true } } } } },
  });
  if (!flag || flag.type !== "CANCEL_REQUEST") return { status: 404, error: "Cancellation request not found" } as const;
  const done = await prisma.$transaction(async (tx) => {
    const claimed = await claimFlag(tx, flagId, staffId, `Declined: ${input.reason}`);
    if (!claimed) return null;
    await appendNote(tx, flag.bookingId, `Cancellation request declined: ${input.reason}`);
    await staffAudit(tx, staffId, "DECLINE_CANCEL_REQUEST", "Booking", flag.bookingId, { flagId, reason: input.reason });
    return claimed;
  });
  if (!done) return { status: 409, error: "This request was already answered." } as const;
  const b = flag.booking;
  if (input.notifyGuest) {
    guestEmail(b.customerEmail, `About your cancellation request: ${b.bookingReference}`, "Your booking is still active", [
      `Hi ${escapeHtml(b.customerName)}, we reviewed your request to cancel <strong>${b.bookingReference}</strong> for <strong>${escapeHtml(titleOf(b))}</strong> on ${formatDateOnly(b.tourDeparture.date)} at ${formatTimeOfDay(b.tourDeparture.departureTime)}.`,
      `We weren't able to cancel it: ${escapeHtml(input.reason)}`,
      "Your booking and voucher are unchanged.",
    ]);
  }
  return { status: 200, flag: done } as const;
}

/** Open requests (with the booking) and bookings waiting for staff to approve them. */
export async function listRequests() {
  const bookingSelect = {
    id: true, bookingReference: true, status: true, customerName: true, customerEmail: true, customerPhone: true, totalSeats: true,
    totalAmount: true, currency: true, paymentPlan: true, createdAt: true, paymentExpiresAt: true,
    payments: { select: { amount: true, status: true, provider: true } },
    tourDeparture: { select: { date: true, departureTime: true, tour: { select: { title: true } }, shuttleRoute: { select: { name: true } } } },
  } as const;
  const [requests, pending] = await Promise.all([
    prisma.bookingFlag.findMany({
      where: { type: "CANCEL_REQUEST", status: "OPEN" },
      orderBy: { createdAt: "asc" },
      take: 200,
      include: { booking: { select: bookingSelect } },
    }),
    prisma.booking.findMany({
      where: { status: { in: ["PENDING_PAYMENT", "PAID_UNSYNCED"] } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: bookingSelect,
    }),
  ]);
  const shape = (b: (typeof pending)[number]) => ({
    id: b.id,
    bookingReference: b.bookingReference,
    status: b.status,
    customerName: b.customerName,
    customerEmail: b.customerEmail,
    customerPhone: b.customerPhone,
    totalSeats: b.totalSeats,
    totalAmount: b.totalAmount / 100,
    paid: b.payments.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + p.amount, 0) / 100,
    currency: b.currency,
    paymentPlan: b.paymentPlan,
    createdAt: b.createdAt,
    paymentExpiresAt: b.paymentExpiresAt,
    experience: titleOf({ tourDeparture: { tour: b.tourDeparture.tour, shuttleRoute: b.tourDeparture.shuttleRoute } }),
    date: formatDateOnly(b.tourDeparture.date),
    departureTime: formatTimeOfDay(b.tourDeparture.departureTime),
  });
  return {
    cancellations: requests.map((f) => ({
      id: f.id,
      note: f.note,
      policyRefund: f.amountCents != null ? f.amountCents / 100 : null,
      createdAt: f.createdAt,
      booking: shape(f.booking),
    })),
    awaitingApproval: pending.map(shape),
  };
}

// ---------------------------------------------------------------------------------------------
// Approve booking

export interface ApproveInput {
  /** How the guest paid (recorded as an offline payment), UNPAID (PAYMENT_DUE flag) or nothing to record (PAID_UNSYNCED). */
  payment: { method: OfflineMethod | "UNPAID"; reference?: string };
  notifyGuest: boolean;
}

export async function approveBooking(bookingId: string, input: ApproveInput, staffId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { payments: true } });
  if (!booking) return { status: 404, error: "Booking not found" } as const;
  if (booking.status !== "PENDING_PAYMENT" && booking.status !== "PAID_UNSYNCED") {
    return { status: 409, error: `Only bookings waiting for payment can be approved; this one is ${booking.status.toLowerCase().replace("_", " ")}.` } as const;
  }

  const { method, reference } = input.payment;
  const paidBefore = booking.payments.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + p.amount, 0);
  const owed = Math.max(0, booking.totalAmount - paidBefore);
  const label = method === "UNPAID" ? "payment still due" : `paid by ${method.toLowerCase().replace("_", " ")}${reference ? ` (${reference})` : ""}`;

  const approved = await prisma.$transaction(async (tx) => {
    const moved = await transitionBooking(tx, booking.id, [booking.status], "CONFIRMED", { by: "staff", approved: true, method });
    if (!moved) return false;
    await tx.booking.update({ where: { id: booking.id }, data: { paymentExpiresAt: null } });
    // An online payment that never finished is superseded; if it succeeds later, confirmPaidBooking flags it.
    await tx.payment.updateMany({ where: { bookingId: booking.id, status: "PENDING" }, data: { status: "FAILED" } });
    if (owed > 0 && method !== "UNPAID") {
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          amount: owed,
          currency: booking.currency,
          provider: OFFLINE_PROVIDER,
          transactionId: offlineTransactionId(method),
          kind: booking.paymentPlan === "DEPOSIT" ? (paidBefore > 0 ? "BALANCE" : "FULL") : "FULL",
          status: "SUCCEEDED",
        },
      });
      if (booking.paymentPlan === "DEPOSIT") await tx.booking.update({ where: { id: booking.id }, data: { balancePaidAt: new Date() } });
      await earnCommission(tx, booking.id, booking.totalAmount);
    } else if (owed > 0) {
      await tx.bookingFlag.create({
        data: { bookingId: booking.id, type: "PAYMENT_DUE", amountCents: owed, createdById: staffId, note: `Approved by staff: ${money(owed, booking.currency)} still to collect.` },
      });
    }
    await appendNote(tx, booking.id, `Approved by staff, ${label}.`);
    await staffAudit(tx, staffId, "APPROVE_BOOKING", "Booking", booking.id, { from: booking.status, method, reference: reference ?? null, owedCents: owed });
    return true;
  });
  if (!approved) return { status: 409, error: "This booking changed while you were approving it. Reload and try again." } as const;

  if (input.notifyGuest) sendVoucherEmail(booking.id, method !== "UNPAID" || owed === 0);
  return { status: 200, booking: { id: booking.id, bookingReference: booking.bookingReference, status: "CONFIRMED" as const }, owed: method === "UNPAID" ? owed : 0 } as const;
}
