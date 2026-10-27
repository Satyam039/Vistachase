// Asks Stripe directly whether a booking's pending payment went through, and applies it exactly as
// the webhook would (routes/webhooks.routes.ts). The webhook stays the main path, but it is
// registered against the server's address: when that address changes (no fixed IP yet) or
// STRIPE_WEBHOOK_SECRET is missing, guests were charged while their booking sat unpaid and then
// expired. The checkout's "waiting for confirmation" poll, the voucher page and the expiry sweep
// call this, so a paid booking is confirmed even when the webhook never arrives.
// Only success is taken from here; failures are left to the webhook and the payment window, since a
// declined card can still be retried in the same Payment Element.

import prisma from "@/lib/db/prisma";
import { getPaymentProvider } from "@/lib/payment/payment.provider";
import { confirmPaidBooking } from "@/modules/bookings/booking.repository";
import { recordBalancePayment } from "@/modules/bookings/deposit-payments";
import { confirmPackagePayment, packageReferences } from "@/modules/bookings/package-booking";

/**
 * Settles the booking's pending Stripe payments that Stripe reports as succeeded. Returns true when
 * one was applied. Never throws: a Stripe outage must not break the page that called it.
 */
export async function syncPendingPayments(reference: string): Promise<boolean> {
  const provider = getPaymentProvider();
  if (provider.name !== "stripe" || !provider.retrievePaymentIntent) return false;
  try {
    const booking = await prisma.booking.findUnique({
      where: { bookingReference: reference },
      select: { status: true, payments: { where: { status: "PENDING", provider: "stripe" }, select: { transactionId: true, kind: true } } },
    });
    if (!booking) return false;
    let applied = false;
    for (const payment of booking.payments) {
      // The booking's own payment only matters while it is unpaid; a balance while it is live.
      if (payment.kind === "BALANCE" ? !["CONFIRMED", "PAID_UNSYNCED"].includes(booking.status) : booking.status !== "PENDING_PAYMENT") continue;
      const intent = await provider.retrievePaymentIntent(payment.transactionId);
      if (!intent?.paid) continue;
      const verified = { amount: intent.amountReceived || intent.amount, currency: intent.currency, transactionId: intent.intentId };
      const kind = intent.metadata?.kind;
      if (kind === "BALANCE") await recordBalancePayment(reference, verified);
      else if (kind === "PACKAGE") await confirmPackagePayment(packageReferences(intent.metadata?.packageRefs), verified);
      else await confirmPaidBooking(reference, verified);
      applied = true;
    }
    return applied;
  } catch (error) {
    console.warn(`Payment check with Stripe for ${reference} failed:`, (error as Error).message);
    return false;
  }
}
