// Stripe webhook. Mounted in app.ts with express.raw() before the JSON parser, because Stripe signs
// the exact bytes it sends. Unsigned or unverifiable events are refused; without
// STRIPE_WEBHOOK_SECRET the endpoint is off.
//   payment_intent.succeeded            → confirm the booking (voucher email) if the amount matches
//   payment_intent.payment_failed       → cancel the pending booking and release its seats
//   payment_intent.canceled             → same
//   (metadata.kind BALANCE)             → a deposit booking's balance: record it, or mark the
//                                         payment failed (the booking stays confirmed)
//   charge.refunded                     → reverse partner commission for each refund (also refunds
//                                         made in the Stripe dashboard); a fully refunded payment is
//                                         marked REFUNDED (a partial refund leaves it SUCCEEDED); a
//                                         cancelled booking moves to REFUNDED; a refund on a booking
//                                         that is still active raises a flag for staff
//   refund.created / refund.updated /   → reverse partner commission for that refund (newer Stripe
//   charge.refund.updated                 API versions don't list refunds on the charge)

import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { confirmPaidBooking, failPendingBooking } from "@/modules/bookings/booking.repository";
import { failBalancePayment, recordBalancePayment } from "@/modules/bookings/deposit-payments";
import { confirmPackagePayment, failPackagePayment, packageReferences } from "@/modules/bookings/package-booking";
import { sendPaymentFailedEmail } from "@/modules/bookings/payment-failed-email";
import { transitionBooking } from "@/modules/bookings/booking-status";
import { reverseCommissionForRefund } from "@/modules/affiliates/commission";
import prisma from "@/lib/db/prisma";

const router = Router();

let stripe: Stripe | null = null;
function stripeClient() {
  stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY || "sk_unused");
  return stripe;
}

router.post("/stripe", async (req: Request, res: Response) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: "Stripe webhook is not configured." });

  let event: Stripe.Event;
  try {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string" || !Buffer.isBuffer(req.body)) throw new Error("Missing signature or raw body");
    event = stripeClient().webhooks.constructEvent(req.body, signature, secret);
  } catch (error) {
    console.warn("Stripe webhook rejected:", (error as Error).message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  try {
    if (event.type === "charge.refunded") {
      await handleChargeRefunded(event.data.object as Stripe.Charge);
      return res.json({ received: true });
    }
    if (event.type === "refund.created" || event.type === "refund.updated" || event.type === "charge.refund.updated") {
      await handleRefund(event.data.object as Stripe.Refund);
      return res.json({ received: true });
    }
    const intent = event.data.object as Stripe.PaymentIntent;
    const reference = intent?.metadata?.bookingReference;
    if (reference && intent.metadata?.kind === "BALANCE") {
      // A deposit booking's balance: the booking is already confirmed, so a failure leaves it alone.
      if (event.type === "payment_intent.succeeded") {
        await recordBalancePayment(reference, { amount: intent.amount_received || intent.amount || 0, currency: intent.currency ?? "", transactionId: intent.id });
      } else if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
        await failBalancePayment(intent.id);
      }
    } else if (reference && intent.metadata?.kind === "PACKAGE") {
      // A package: one payment for several bookings (modules/bookings/package-booking.ts).
      const references = packageReferences(intent.metadata.packageRefs);
      if (event.type === "payment_intent.succeeded") {
        await confirmPackagePayment(references, { amount: intent.amount_received || intent.amount || 0, currency: intent.currency ?? "", transactionId: intent.id });
      } else if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
        // The guest hears once, from Day 1, and only when this event ended the bookings (not on a retry).
        if (await failPackagePayment(references, event.type === "payment_intent.canceled" ? "payment cancelled" : "payment failed")) await sendPaymentFailedEmail(references[0]);
      }
    } else if (reference) {
      if (event.type === "payment_intent.succeeded") {
        // Confirms only if Stripe's amount and currency match the booking's server-computed total.
        await confirmPaidBooking(reference, { amount: intent.amount_received || intent.amount || 0, currency: intent.currency ?? "", transactionId: intent.id });
      } else if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
        if (await failPendingBooking(reference, event.type === "payment_intent.canceled" ? "payment cancelled" : "payment failed")) await sendPaymentFailedEmail(reference);
      }
    }
    return res.json({ received: true });
  } catch (error) {
    // 500 makes Stripe retry; confirmPaidBooking and failPendingBooking are idempotent.
    console.error(`Stripe webhook ${event.type} failed:`, (error as Error).message);
    return res.status(500).json({ error: "Webhook handling failed" });
  }
});

const intentIdOf = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : value?.id);

const PAYMENT_FIELDS = { id: true, amount: true, status: true, transactionId: true, bookingId: true, booking: { select: { status: true, bookingReference: true, currency: true } } } as const;

async function paymentFor(intentId: string | undefined) {
  if (!intentId) return null;
  return prisma.payment.findUnique({ where: { transactionId: intentId }, select: PAYMENT_FIELDS });
}

/** Every payment row paid by this intent: one, or one per booking of a package ("pi_…", "pi_…:2"…). */
async function paymentsFor(intentId: string) {
  return prisma.payment.findMany({ where: { OR: [{ transactionId: intentId }, { transactionId: { startsWith: `${intentId}:` } }] }, select: PAYMENT_FIELDS });
}

/**
 * The payment a refund belongs to. Refunds Vista Chase makes carry metadata.bookingReference, which
 * picks the right booking of a package; otherwise the intent's own (first) payment.
 */
async function paymentForRefund(refund: Pick<Stripe.Refund, "payment_intent" | "metadata">) {
  const intentId = intentIdOf(refund.payment_intent);
  if (!intentId) return null;
  const payments = await paymentsFor(intentId);
  const ref = refund.metadata?.bookingReference;
  const named = ref ? payments.find((p) => p.booking.bookingReference === ref) : null;
  if (named) return named;
  // A package refund made in the Stripe dashboard can't be pinned to a day: charge.refunded flags it.
  return payments.length > 1 ? null : (payments[0] ?? null);
}

/** Reverse commission for one refund. Keyed by refund id, so retries and refunds the cancel flow already handled are no-ops. */
async function reverseFor(bookingId: string, refund: Pick<Stripe.Refund, "id" | "amount" | "status">) {
  if (refund.status !== "succeeded" && refund.status !== "pending") return;
  const line = await reverseCommissionForRefund(bookingId, refund.id, refund.amount, "refund in Stripe");
  if (line) {
    await prisma.auditLog.create({
      data: { action: "COMMISSION_REVERSED", entityType: "Booking", entityId: bookingId, details: { refundId: refund.id, refundedCents: refund.amount, commissionCents: line.amountCents } },
    });
  }
}

async function handleRefund(refund: Stripe.Refund) {
  const payment = await paymentForRefund(refund);
  if (payment) await reverseFor(payment.bookingId, refund);
}

/** The charge's refunds: listed on the event by older Stripe API versions, fetched otherwise. */
async function refundsOf(charge: Stripe.Charge, intentId: string): Promise<Stripe.Refund[]> {
  if (charge.refunds?.data) return charge.refunds.data;
  if (!process.env.STRIPE_SECRET_KEY) return [];
  return (await stripeClient().refunds.list({ payment_intent: intentId, limit: 100 })).data;
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const intentId = intentIdOf(charge.payment_intent);
  if (!intentId) return;
  const shared = await paymentsFor(intentId);
  if (shared.length > 1) return handlePackageChargeRefunded(charge, intentId, shared);
  const payment = await paymentFor(intentId);
  if (!payment) return;
  for (const refund of await refundsOf(charge, intentId)) await reverseFor(payment.bookingId, refund);

  // amount_refunded is the charge's running total, so this is right however many refunds there were.
  const refundedCents = charge.amount_refunded ?? 0;
  if (refundedCents <= 0) return;
  const fully = refundedCents >= (charge.amount ?? payment.amount);
  if (fully && payment.status !== "REFUNDED") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
  }

  const { status, bookingReference, currency } = payment.booking;
  if (status === "CANCELLED" && fully) {
    await prisma.$transaction((tx) => transitionBooking(tx, payment.bookingId, ["CANCELLED"], "REFUNDED", { refundedCents, by: "stripe webhook" }));
  } else if (["CONFIRMED", "PAID_UNSYNCED", "PENDING_PAYMENT", "COMPLETED"].includes(status)) {
    // Money went back in Stripe (usually from the dashboard) but the booking still holds seats.
    // Once per refunded total: a later, larger refund raises its own flag.
    const key = `[stripe ${charge.id} refunded ${refundedCents}]`;
    const exists = await prisma.bookingFlag.findFirst({ where: { bookingId: payment.bookingId, note: { contains: key } }, select: { id: true } });
    if (!exists) {
      await prisma.bookingFlag.create({
        data: {
          bookingId: payment.bookingId,
          type: "OTHER",
          note: `${bookingReference}: $${(refundedCents / 100).toFixed(2)} ${currency.toUpperCase()} was refunded in Stripe (${fully ? "in full" : "part"}) but the booking is still ${status.toLowerCase().replace(/_/g, " ")}. Cancel it if the guest isn't coming. ${key}`,
        },
      });
    }
  }
}

/**
 * A refund on a package payment (one charge for several bookings). Refunds Vista Chase made (guest or
 * staff cancellation) name their booking and have already updated it; anything refunded in the
 * Stripe dashboard can't be pinned to one day, so staff get one flag on the first booking to sort out.
 */
async function handlePackageChargeRefunded(charge: Stripe.Charge, intentId: string, payments: Awaited<ReturnType<typeof paymentsFor>>) {
  let unattributedCents = 0;
  for (const refund of await refundsOf(charge, intentId)) {
    const ref = refund.metadata?.bookingReference;
    const target = ref ? payments.find((p) => p.booking.bookingReference === ref) : null;
    if (target) await reverseFor(target.bookingId, refund);
    else if (refund.status === "succeeded" || refund.status === "pending") unattributedCents += refund.amount;
  }
  if (unattributedCents <= 0) return;
  const first = payments.find((p) => p.transactionId === intentId) ?? payments[0];
  const references = payments.map((p) => p.booking.bookingReference).join(", ");
  const key = `[stripe ${charge.id} package refunded ${unattributedCents}]`;
  const exists = await prisma.bookingFlag.findFirst({ where: { bookingId: first.bookingId, note: { contains: key } }, select: { id: true } });
  if (exists) return;
  await prisma.bookingFlag.create({
    data: {
      bookingId: first.bookingId,
      type: "OTHER",
      note: `Package payment for ${references}: $${(unattributedCents / 100).toFixed(2)} ${first.booking.currency.toUpperCase()} was refunded in Stripe, not through Vista Chase. Check which day the guest isn't taking and cancel that booking. ${key}`,
    },
  });
}

export default router;
