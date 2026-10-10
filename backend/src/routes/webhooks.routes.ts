// Stripe webhook. Mounted in app.ts with express.raw() before the JSON parser, because Stripe signs
// the exact bytes it sends. Unsigned or unverifiable events are refused; without
// STRIPE_WEBHOOK_SECRET the endpoint is off.
//   payment_intent.succeeded            → confirm the booking (voucher email)
//   payment_intent.payment_failed       → cancel the pending booking and release its seats
//   payment_intent.canceled             → same

import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { confirmPaidBooking, failPendingBooking } from "@/modules/bookings/booking.repository";

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
    const intent = event.data.object as Stripe.PaymentIntent;
    const reference = intent?.metadata?.bookingReference;
    if (reference) {
      if (event.type === "payment_intent.succeeded") {
        const charge = typeof intent.latest_charge === "string" ? intent.latest_charge : undefined;
        await confirmPaidBooking(reference, intent.id ?? charge);
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

export default router;
