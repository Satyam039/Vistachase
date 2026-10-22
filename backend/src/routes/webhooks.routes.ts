// Stripe webhook. Mounted in app.ts with express.raw() before the JSON parser, because Stripe signs
// the exact bytes it sends. Unsigned or unverifiable events are refused; without
// STRIPE_WEBHOOK_SECRET the endpoint is off.
//   payment_intent.succeeded            → confirm the booking (voucher email) if the amount matches
//   payment_intent.payment_failed       → cancel the pending booking and release its seats
//   payment_intent.canceled             → same
//   (metadata.kind BALANCE)             → a deposit booking's balance: record it, or mark the
//                                         payment failed (the booking stays confirmed)
//   charge.refunded                     → reverse partner commission for each refund (also refunds
//                                         made in the Stripe dashboard); the booking's status is
//                                         left to staff

import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { confirmPaidBooking, failPendingBooking } from "@/modules/bookings/booking.repository";
import { failBalancePayment, recordBalancePayment } from "@/modules/bookings/deposit-payments";
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
    const intent = event.data.object as Stripe.PaymentIntent;
    const reference = intent?.metadata?.bookingReference;
    if (reference && intent.metadata?.kind === "BALANCE") {
      // A deposit booking's balance: the booking is already confirmed, so a failure leaves it alone.
      if (event.type === "payment_intent.succeeded") {
        await recordBalancePayment(reference, { amount: intent.amount_received || intent.amount || 0, currency: intent.currency ?? "", transactionId: intent.id });
      } else if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
        await failBalancePayment(intent.id);
      }
    } else if (reference) {
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

/** Reverse commission for each succeeded refund on the charge. Keyed by refund id, so retries and refunds already handled by the cancel flow are no-ops. */
async function handleChargeRefunded(charge: Stripe.Charge) {
  const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!intentId) return;
  const payment = await prisma.payment.findUnique({ where: { transactionId: intentId }, select: { bookingId: true } });
  if (!payment) return;
  const refunds = charge.refunds?.data ?? [];
  for (const refund of refunds) {
    if (refund.status !== "succeeded" && refund.status !== "pending") continue;
    const line = await reverseCommissionForRefund(payment.bookingId, refund.id, refund.amount, "refund in Stripe");
    if (line) {
      await prisma.auditLog.create({
        data: { action: "COMMISSION_REVERSED", entityType: "Booking", entityId: payment.bookingId, details: { refundId: refund.id, refundedCents: refund.amount, commissionCents: line.amountCents } },
      });
    }
  }
}

export default router;
