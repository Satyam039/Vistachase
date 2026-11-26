// Deposit payments (docs/DEPOSITS.md). At checkout the guest pays everything, or a 20% deposit
// when the departure is at least 15 days away. The balance is due 7 days before departure (owner, 2026-11-18;
// was 14), and for a package 7 days before its first tour day, and is paid from the voucher page. A deposit doesn't change the cancellation rules (cancellation-policy.ts):
// an eligible cancellation refunds everything paid, less 20% of the total on a private multi-day
// package (so a deposit alone is kept there). An unpaid balance never cancels a
// booking by itself: guests get reminders, and staff get a PAYMENT_DUE flag 72 hours before.

import type { Booking, Payment } from "@prisma/client";

export const DEPOSIT_PERCENT = 20;
/** Departures closer than this are paid in full at checkout. */
export const DEPOSIT_MIN_DAYS_BEFORE = 15;
/** The balance is due this many days before departure. */
export const BALANCE_DUE_DAYS_BEFORE = 7;
/** First reminder this many days before the balance is due. */
export const BALANCE_REMINDER_DAYS_BEFORE_DUE = 3;
/** Still unpaid this close to departure: staff are flagged (also the end of the online refund window). */
export const BALANCE_OVERDUE_HOURS_BEFORE = 72;

const DAY_MS = 86_400_000;

export const depositCentsFor = (totalCents: number) => Math.round((totalCents * DEPOSIT_PERCENT) / 100);

/** The deposit and balance due date for a booking, or null when it must be paid in full. */
export function depositTerms(totalCents: number, departureAt: Date, now = new Date()) {
  if (totalCents <= 0) return null;
  if (departureAt.getTime() - now.getTime() < DEPOSIT_MIN_DAYS_BEFORE * DAY_MS) return null;
  const depositCents = depositCentsFor(totalCents);
  if (depositCents <= 0 || depositCents >= totalCents) return null;
  return { depositCents, balanceDueAt: new Date(departureAt.getTime() - BALANCE_DUE_DAYS_BEFORE * DAY_MS) };
}

type PaymentLike = Pick<Payment, "status" | "amount">;
type BookingLike = Pick<Booking, "paymentPlan" | "depositAmount" | "totalAmount">;

/** What the guest pays at checkout: the deposit, or everything. */
export const firstChargeCents = (booking: BookingLike) =>
  booking.paymentPlan === "DEPOSIT" && booking.depositAmount ? booking.depositAmount : booking.totalAmount;

export const paidCents = (payments: PaymentLike[]) => payments.filter((p) => p.status === "SUCCEEDED").reduce((sum, p) => sum + p.amount, 0);

/**
 * Balance still owed: on a DEPOSIT booking the rest of the total; on a FULL booking only what a
 * staff change added after it was paid (booking-changes.ts: more guests or a dearer date), so an
 * unpaid booking (nothing paid yet) never shows a balance. 0 once paid.
 */
export const balanceOwedCents = (booking: BookingLike, payments: PaymentLike[]) => {
  const paid = paidCents(payments);
  if (booking.paymentPlan === "DEPOSIT") return Math.max(0, booking.totalAmount - paid);
  return paid > 0 ? Math.max(0, booking.totalAmount - paid) : 0;
};

/** The payment summary the voucher page, My trips and the checkout show. Amounts in dollars. */
export function paymentSummary(booking: BookingLike & Pick<Booking, "balanceDueAt" | "balancePaidAt">, payments: PaymentLike[]) {
  if (booking.paymentPlan !== "DEPOSIT") {
    const extra = balanceOwedCents(booking, payments);
    // Paid in full, then changed to cost more: what was paid and what is still to pay.
    return extra > 0 ? { paymentPlan: "FULL" as const, amountPaid: paidCents(payments) / 100, balanceDue: extra / 100 } : { paymentPlan: "FULL" as const };
  }
  return {
    paymentPlan: "DEPOSIT" as const,
    depositAmount: (booking.depositAmount ?? 0) / 100,
    amountPaid: paidCents(payments) / 100,
    balanceDue: balanceOwedCents(booking, payments) / 100,
    balanceDueAt: booking.balanceDueAt,
    balancePaidAt: booking.balancePaidAt,
  };
}
