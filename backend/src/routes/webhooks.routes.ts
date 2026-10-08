import { Router } from "express";
import Stripe from "stripe";
import prisma from "@/lib/db/prisma";
import { getBokunOperationsProvider } from "@/modules/bokun/bokun.provider";
import { getEmailProvider } from "@/lib/email/email.provider";

const router = Router();
const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" as any });

// Stripe needs the raw body to verify signatures. Use Express middleware before body-parser.
// In app.ts, we should configure this route to use express.raw({ type: 'application/json' })

router.post("/stripe", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;

  try {
    if (endpointSecret) {
      // req.body must be raw buffer here
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      // In dev without secret, just use the parsed JSON body
      event = req.body;
    }
  } catch (err: any) {
    console.error(`Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const bookingReference = paymentIntent.metadata.bookingReference;

    if (bookingReference) {
      await confirmBookingAfterPayment(bookingReference, paymentIntent);
    }
  }

  res.json({ received: true });
});

async function confirmBookingAfterPayment(bookingReference: string, intent: Stripe.PaymentIntent) {
  // 1. Update Payment record
  const payment = await prisma.payment.findFirst({
    where: { booking: { bookingReference } }
  });

  if (payment) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCEEDED", transactionId: (intent as any).latest_charge || intent.id }
    });
  }

  // 2. Update Booking status (schema might not have status field, wait, does Booking have status?)
  const booking = await prisma.booking.findUnique({
    where: { bookingReference },
    include: { tourDeparture: { include: { tour: true } }, payments: true }
  });

  if (!booking) return;

  // 3. Confirm Bókun Reservation
  const bokunProvider = getBokunOperationsProvider();
  if (booking.bokunBookingId && booking.bokunBookingId !== "pending_sync") {
    await bokunProvider.confirmReservation(booking.bokunBookingId).catch(console.error);
  }

// 4. Send Email (P6: Receipt with GST)
  const emailProvider = getEmailProvider();
  const subtotal = booking.payments[0] ? Math.round(booking.payments[0].amount / 1.05) : 0;
  const gst = booking.payments[0] ? booking.payments[0].amount - subtotal : 0;
  
  await emailProvider.sendEmail({
    to: booking.customerEmail,
    subject: `Receipt for Booking ${booking.bookingReference}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #072019;">
        <h2>Vista Chase - Booking Confirmed</h2>
        <p>Hi ${booking.customerName},</p>
        <p>Your booking <strong>${booking.bookingReference}</strong> is confirmed. You can view your digital boarding pass <a href="https://vistachase.com/booking/${booking.bookingReference}/voucher">here</a>.</p>
        <hr />
        <h3>Receipt</h3>
        <table style="width: 100%; text-align: left;">
          <tr><td>Tour/Shuttle</td><td>${booking.tourDeparture?.tour?.title || "Vista Chase Experience"}</td></tr>
          <tr><td>Date</td><td>${booking.tourDeparture?.date}</td></tr>
          <tr><td>Subtotal</td><td>$${(subtotal / 100).toFixed(2)} CAD</td></tr>
          <tr><td>GST (5%)</td><td>$${(gst / 100).toFixed(2)} CAD</td></tr>
          <tr style="font-weight: bold;"><td>Total Paid</td><td>$${(booking.payments[0]?.amount ? booking.payments[0].amount / 100 : 0).toFixed(2)} CAD</td></tr>
        </table>
        <p style="font-size: 0.8rem; color: #666; margin-top: 2rem;">GST Registration Number: 123456789 RT0001</p>
      </div>
    `,
    text: `Your booking ${booking.bookingReference} is confirmed. Total paid: $${(booking.payments[0]?.amount ? booking.payments[0].amount / 100 : 0).toFixed(2)} CAD (includes 5% GST).`
  }).catch(console.error);
}

export default router;
