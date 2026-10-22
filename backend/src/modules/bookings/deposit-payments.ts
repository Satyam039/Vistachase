// Balance payments and reminders for DEPOSIT bookings (docs/DEPOSITS.md; terms in deposit.ts).
//
//   startBalancePayment     the voucher page's "Pay balance" button: a payment for what is still
//                           owed (an unfinished one is resumed, never doubled)
//   recordBalancePayment    the payment succeeded (Stripe webhook, or at once with the mock
//                           provider): marks the booking paid in full, earns partner commission on
//                           the total, closes any PAYMENT_DUE flag and emails a receipt
//   failBalancePayment      the card was declined: the payment is marked failed; the booking stays
//                           confirmed and the guest can try again
//   sendBalanceReminders    hourly job: reminder 3 days before the due date, a notice on the due
//                           date, and 72 hours before departure an overdue notice plus a
//                           PAYMENT_DUE flag for staff. A booking is never cancelled for an unpaid
//                           balance automatically.

import prisma from "@/lib/db/prisma";
import { getPaymentProvider } from "@/lib/payment/payment.provider";
import { getEmailProvider } from "@/lib/email/email.provider";
import { voucherLink } from "@/lib/security/signed-links";
import { formatDateOnly, formatTimeOfDay, getMountainTimeInstant } from "@/lib/utils/time";
import { earnCommission } from "@/modules/affiliates/commission";
import { balanceDueLabel, flagBooking } from "@/modules/bookings/booking.repository";
import {
  BALANCE_OVERDUE_HOURS_BEFORE,
  BALANCE_REMINDER_DAYS_BEFORE_DUE,
  balanceOwedCents,
  paidCents,
} from "@/modules/bookings/deposit";

const LIVE = ["CONFIRMED", "PAID_UNSYNCED"];
const money = (cents: number, currency: string) => `$${(cents / 100).toFixed(2)} ${currency}`;
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function loadBooking(reference: string) {
  return prisma.booking.findUnique({
    where: { bookingReference: reference },
    include: { payments: true, tourDeparture: { include: { tour: true, shuttleRoute: true } } },
  });
}
type LoadedBooking = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;

const departureAt = (b: LoadedBooking) => getMountainTimeInstant(b.tourDeparture.date, b.tourDeparture.departureTime);
const titleOf = (b: LoadedBooking) => b.tourDeparture.tour?.title || b.tourDeparture.shuttleRoute?.name || "Vista Chase experience";

export type BalanceStart =
  | { ok: true; paid: true; balanceDue: 0 }
  | { ok: true; paid: false; clientSecret: string; amount: number; currency: string }
  | { ok: false; status: number; error: string };

/** Starts (or resumes) the balance payment for a DEPOSIT booking. Amounts returned in dollars. */
export async function startBalancePayment(reference: string, now = new Date()): Promise<BalanceStart> {
  const booking = await loadBooking(reference);
  if (!booking) return { ok: false, status: 404, error: "Booking not found" };
  if (booking.paymentPlan !== "DEPOSIT") return { ok: false, status: 400, error: "This booking was paid in full at checkout." };
  if (!LIVE.includes(booking.status)) return { ok: false, status: 409, error: "This booking is no longer active, so there is nothing to pay." };
  const owed = balanceOwedCents(booking, booking.payments);
  if (owed <= 0) return { ok: true, paid: true, balanceDue: 0 };
  if (departureAt(booking) <= now) {
    return { ok: false, status: 409, error: "This departure has already left. Please contact us about the balance." };
  }

  const provider = getPaymentProvider();
  // Resume an unfinished balance payment for the same amount instead of starting a second one.
  const pending = booking.payments.find((p) => p.kind === "BALANCE" && p.status === "PENDING");
  if (pending && pending.amount === owed && provider.retrievePaymentIntent) {
    const intent = await provider.retrievePaymentIntent(pending.transactionId).catch(() => null);
    if (intent?.paid) {
      await recordBalancePayment(reference, { amount: intent.amount, currency: intent.currency, transactionId: intent.intentId });
      return { ok: true, paid: true, balanceDue: 0 };
    }
    if (intent?.clientSecret) return { ok: true, paid: false, clientSecret: intent.clientSecret, amount: owed / 100, currency: booking.currency };
  }
  if (pending) await prisma.payment.update({ where: { id: pending.id }, data: { status: "FAILED" } });

  const attempt = booking.payments.filter((p) => p.kind === "BALANCE").length + 1;
  let intent;
  try {
    intent = await provider.createPaymentIntent({
      amount: owed,
      currency: booking.currency,
      bookingReference: booking.bookingReference,
      customerEmail: booking.customerEmail,
      metadata: { kind: "BALANCE" },
      // Twin clicks get the same intent; a later attempt (after a decline) gets a new one.
      idempotencyKey: `balance-${booking.bookingReference}-${attempt}`,
    });
  } catch (error) {
    console.error(`Balance payment could not be started for ${reference}:`, (error as Error).message);
    return { ok: false, status: 502, error: "We couldn't start the payment. Please try again." };
  }
  const existing = await prisma.payment.findUnique({ where: { transactionId: intent.intentId } });
  if (!existing) {
    await prisma.payment.create({
      data: { bookingId: booking.id, amount: owed, currency: booking.currency, provider: provider.name, transactionId: intent.intentId, kind: "BALANCE", status: "PENDING" },
    });
  }
  if (intent.paid) {
    await recordBalancePayment(reference, { amount: owed, currency: booking.currency, transactionId: intent.intentId });
    return { ok: true, paid: true, balanceDue: 0 };
  }
  return { ok: true, paid: false, clientSecret: intent.clientSecret, amount: owed / 100, currency: booking.currency };
}

/**
 * Records a succeeded balance payment (idempotent). The amount must match the pending balance
 * payment; a mismatch, or money for a booking no longer active, is flagged for staff instead.
 */
export async function recordBalancePayment(reference: string, verified: { amount: number; currency: string; transactionId: string }) {
  const booking = await loadBooking(reference);
  if (!booking) return null;
  const payment = booking.payments.find((p) => p.transactionId === verified.transactionId);
  if (!payment || payment.kind !== "BALANCE") return null;
  if (payment.status === "SUCCEEDED") return booking; // webhook retry

  if (verified.amount !== payment.amount || verified.currency.toUpperCase() !== booking.currency.toUpperCase()) {
    await flagBooking(booking.id, "PAYMENT_AMOUNT_MISMATCH", `Balance payment ${verified.transactionId} of ${verified.amount} ${verified.currency.toUpperCase()} doesn't match the ${payment.amount} ${booking.currency} due; not recorded.`, booking.adminNotes);
    return booking;
  }

  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.payment.updateMany({ where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } }, data: { status: "SUCCEEDED" } });
    if (moved.count === 0) return null;
    if (!LIVE.includes(booking.status)) return { late: true as const };
    const payments = await tx.payment.findMany({ where: { bookingId: booking.id }, select: { status: true, amount: true } });
    const total = paidCents(payments);
    if (total < booking.totalAmount) return { late: false as const, inFull: false, commission: null };
    await tx.booking.update({ where: { id: booking.id }, data: { balancePaidAt: new Date() } });
    await tx.bookingFlag.updateMany({
      where: { bookingId: booking.id, type: "PAYMENT_DUE", status: "OPEN" },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolution: `Balance paid online (${verified.transactionId}).` },
    });
    await tx.auditLog.create({ data: { action: "BALANCE_PAID", entityType: "Booking", entityId: booking.id, details: { transactionId: verified.transactionId, amountCents: payment.amount } } });
    // Commission on the whole booking, now that it is all paid.
    return { late: false as const, inFull: true, commission: await earnCommission(tx, booking.id, total) };
  });
  if (!result) return booking;
  if (result.late) {
    await flagBooking(booking.id, "LATE_PAYMENT", `Balance payment ${verified.transactionId} succeeded after the booking was ${booking.status.toLowerCase()}. Refund it by hand.`, booking.adminNotes);
    return booking;
  }
  if (result.inFull) {
    const when = `${formatDateOnly(booking.tourDeparture.date)} at ${formatTimeOfDay(booking.tourDeparture.departureTime)}`;
    const link = voucherLink(booking.bookingReference);
    getEmailProvider()
      .sendEmail({
        to: booking.customerEmail,
        subject: `Paid in full: ${booking.bookingReference}`,
        html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1c1f23;">
          <h2>Thank you, your booking is paid in full</h2>
          <p>We received your balance of <strong>${money(payment.amount, booking.currency)}</strong> for ${escapeHtml(titleOf(booking))} on ${when} (Mountain Time). Total paid: ${money(booking.totalAmount, booking.currency)}.</p>
          <p><a href="${link}" style="color: #257780; font-weight: bold;">Open your voucher</a> and show it to your guide at pickup.</p>
        </div>`,
        text: `We received your balance of ${money(payment.amount, booking.currency)} for booking ${booking.bookingReference}. Total paid: ${money(booking.totalAmount, booking.currency)}.\nVoucher: ${link}`,
      })
      .catch((e) => console.error("Balance receipt email failed:", (e as Error).message));
  }
  return loadBooking(reference);
}

/** A declined or abandoned balance payment: recorded as failed; the booking is unaffected. */
export async function failBalancePayment(transactionId: string) {
  await prisma.payment.updateMany({ where: { transactionId, kind: "BALANCE", status: "PENDING" }, data: { status: "FAILED" } });
}

const STAGES = {
  1: {
    subject: (ref: string) => `Balance due soon: ${ref}`,
    lead: (amount: string, due: string) => `A friendly reminder: the balance of <strong>${amount}</strong> for your trip is due by <strong>${due}</strong>.`,
  },
  2: {
    subject: (ref: string) => `Balance due today: ${ref}`,
    lead: (amount: string, due: string) => `The balance of <strong>${amount}</strong> for your trip is due today (${due}).`,
  },
  3: {
    subject: (ref: string) => `Action needed: balance unpaid for ${ref}`,
    lead: (amount: string) =>
      `We haven't received the balance of <strong>${amount}</strong> for your trip yet. Your seats are still reserved; please pay now, or reply to this email or call +1 (825) 734-9456 and we'll help.`,
  },
} as const;

/**
 * Hourly: reminds guests with an unpaid balance. Each booking moves through the stages once; when
 * several are due at once (a late booking, or the job was off), only the latest is sent.
 */
export async function sendBalanceReminders(now = new Date()) {
  const bookings = await prisma.booking.findMany({
    where: { paymentPlan: "DEPOSIT", status: { in: LIVE as never }, balancePaidAt: null, balanceReminderStage: { lt: 3 } },
    include: { payments: true, tourDeparture: { include: { tour: true, shuttleRoute: true } } },
  });
  let sent = 0;
  let flagged = 0;
  for (const booking of bookings) {
    const owed = balanceOwedCents(booking, booking.payments);
    if (owed <= 0 || !booking.balanceDueAt) continue;
    const leaves = departureAt(booking);
    if (leaves <= now) continue; // after departure it is staff's (the overdue flag is already open)
    const due = booking.balanceDueAt.getTime();
    const stage =
      now.getTime() >= leaves.getTime() - BALANCE_OVERDUE_HOURS_BEFORE * 3_600_000
        ? 3
        : now.getTime() >= due
          ? 2
          : now.getTime() >= due - BALANCE_REMINDER_DAYS_BEFORE_DUE * 86_400_000
            ? 1
            : 0;
    if (stage <= booking.balanceReminderStage) continue;

    // Claim the stage first, so overlapping runs never email twice.
    const claimed = await prisma.booking.updateMany({
      where: { id: booking.id, balanceReminderStage: booking.balanceReminderStage, balancePaidAt: null },
      data: { balanceReminderStage: stage },
    });
    if (claimed.count === 0) continue;

    if (stage === 3) {
      await prisma.bookingFlag.create({
        data: {
          bookingId: booking.id,
          type: "PAYMENT_DUE",
          amountCents: owed,
          note: `Deposit booking: balance of ${money(owed, booking.currency)} still unpaid ${BALANCE_OVERDUE_HOURS_BEFORE} hours before departure (it was due ${balanceDueLabel(booking.balanceDueAt)}). The guest has been emailed; their seats are kept. Collect it, or cancel the booking if the guest isn't coming.`,
        },
      });
      flagged++;
    }

    const amount = money(owed, booking.currency);
    const dueLabel = balanceDueLabel(booking.balanceDueAt);
    const link = voucherLink(booking.bookingReference);
    const when = `${formatDateOnly(booking.tourDeparture.date)} at ${formatTimeOfDay(booking.tourDeparture.departureTime)}`;
    const copy = STAGES[stage as 1 | 2 | 3];
    await getEmailProvider()
      .sendEmail({
        to: booking.customerEmail,
        subject: copy.subject(booking.bookingReference),
        html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1c1f23;">
          <p>Hi ${escapeHtml(booking.customerName)},</p>
          <p>${copy.lead(amount, dueLabel)}</p>
          <p>${escapeHtml(titleOf(booking))}, ${when} (Mountain Time). Booking ${booking.bookingReference}.</p>
          <p><a href="${link}" style="color: #257780; font-weight: bold;">Pay the balance on your voucher</a>. It takes a minute by card.</p>
          <p style="color: #5d6168; font-size: 13px;">Already paid? Thank you, you can ignore this email.</p>
        </div>`,
        text: `${copy.lead(amount, dueLabel).replace(/<[^>]+>/g, "")}\n${titleOf(booking)}, ${when} (Mountain Time). Booking ${booking.bookingReference}.\nPay the balance: ${link}`,
      })
      .then((r) => {
        if (r.success) sent++;
      })
      .catch((e) => console.error(`Balance reminder failed for ${booking.bookingReference}:`, (e as Error).message));
  }
  return { checked: bookings.length, sent, flagged };
}
