// Stripe webhook. Mounted in app.ts with express.raw() before the JSON parser, because Stripe signs
// the exact bytes it sends. Unsigned or unverifiable events are refused; without
// STRIPE_WEBHOOK_SECRET the endpoint is off.
//   payment_intent.succeeded            → confirm the booking (voucher email) if the amount matches
//   payment_intent.payment_failed       → cancel the pending booking and release its seats
//   payment_intent.canceled             → same
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
    if (reference) {
      if (event.type === "payment_intent.succeeded") {
        // Confirms only if Stripe's amount and currency match the booking's server-computed total.
        await confirmPaidBooking(reference, { amount: intent.amount_received || intent.amount || 0, currency: intent.currency ?? "", transactionId: intent.id });
      } else if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
        await failPendingBooking(reference, event.type === "payment_intent.canceled" ? "payment cancelled" : "payment failed");
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

async function paymentFor(intentId: string | undefined) {
  if (!intentId) return null;
  return prisma.payment.findUnique({
    where: { transactionId: intentId },
    select: { id: true, amount: true, status: true, bookingId: true, booking: { select: { status: true, bookingReference: true, currency: true } } },
  });
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
  const payment = await paymentFor(intentIdOf(refund.payment_intent));
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
  const payment = await paymentFor(intentId);
  if (!payment || !intentId) return;
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

export default router;
