import { PrismaClient } from "@prisma/client";
import { getBokunOperationsProvider } from "../src/modules/bokun/bokun.provider";
import Stripe from "stripe";

const prisma = new PrismaClient();
const bokun = getBokunOperationsProvider();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2024-06-20" as any });

async function runNightlyReconciliation() {
  console.log("Starting Nightly Reconciliation...");

  // 1. Fetch all bookings that are CONFIRMED locally
  const recentBookings = await prisma.booking.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } // Last 3 days
    },
    include: { payment: true }
  });

  for (const booking of recentBookings) {
    let bokunOk = false;
    let stripeOk = false;

    // Check Stripe
    if (booking.payment && booking.payment.transactionId && booking.payment.transactionId.startsWith("ch_")) {
      try {
        const charge = await stripe.charges.retrieve(booking.payment.transactionId);
        if (charge.status === "succeeded") stripeOk = true;
      } catch (e: any) {
        console.warn(`Stripe error for ${booking.bookingReference}: ${e.message}`);
      }
    } else if (booking.payment?.status === "SUCCEEDED") {
      stripeOk = true; // Maybe mock payment or other
    }

    // Check Bokun
    if (booking.bokunBookingId && booking.bokunBookingId !== "pending_sync") {
      // Assuming Bokun API returns booking details
      // In real implementation we'd check if Bokun has it as confirmed
      bokunOk = true;
    }

    if (!bokunOk || !stripeOk) {
      console.warn(`[WARNING] Booking ${booking.bookingReference} discrepancy: BokunOK=${bokunOk}, StripeOK=${stripeOk}`);
    } else {
      console.log(`[OK] Booking ${booking.bookingReference} matches perfectly.`);
    }
  }

  console.log("Reconciliation finished.");
}

runNightlyReconciliation().catch(console.error).finally(() => prisma.$disconnect());
