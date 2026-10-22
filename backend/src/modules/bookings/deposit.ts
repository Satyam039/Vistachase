// Deposit payments (docs/DEPOSITS.md). At checkout the guest pays everything, or a 20% deposit
// when the departure is at least 15 days away. The balance is due 14 days before departure (the published
// payment terms) and is
// paid from the voucher page. Cancelling at least 72 hours before departure refunds everything paid
// except the deposit (80% of the total once it is paid in full). An unpaid balance never cancels a
// booking by itself: guests get reminders, and staff get a PAYMENT_DUE flag 72 hours before.

import type { Booking, Payment } from "@prisma/client";

export const DEPOSIT_PERCENT = 20;
/** Departures closer than this are paid in full at checkout. */
export const DEPOSIT_MIN_DAYS_BEFORE = 15;
/** The balance is due this many days before departure. */
export const BALANCE_DUE_DAYS_BEFORE = 14;
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

/** Balance still owed on a DEPOSIT booking (0 for FULL bookings and once paid). */
export const balanceOwedCents = (booking: BookingLike, payments: PaymentLike[]) =>
  booking.paymentPlan === "DEPOSIT" ? Math.max(0, booking.totalAmount - paidCents(payments)) : 0;

/** DEPOSIT plan refund on a cancellation inside the policy window: everything paid except the deposit. */
export const depositPlanRefundCents = (booking: BookingLike, payments: PaymentLike[]) =>
  Math.max(0, paidCents(payments) - (booking.depositAmount ?? 0));

/** The payment summary the voucher page, My trips and the checkout show. Amounts in dollars. */
export function paymentSummary(booking: BookingLike & Pick<Booking, "balanceDueAt" | "balancePaidAt">, payments: PaymentLike[]) {
  if (booking.paymentPlan !== "DEPOSIT") return { paymentPlan: "FULL" as const };
  return {
    paymentPlan: "DEPOSIT" as const,
    depositAmount: (booking.depositAmount ?? 0) / 100,
    amountPaid: paidCents(payments) / 100,
    balanceDue: balanceOwedCents(booking, payments) / 100,
    balanceDueAt: booking.balanceDueAt,
    balancePaidAt: booking.balancePaidAt,
  };
}
