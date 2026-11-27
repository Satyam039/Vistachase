// Booking changes (owner, 2026-11-26: "when a customer requests a passenger count change, e.g. booked
// 6 and one cannot join, the guest needs an option to send the request, and the backend should adjust
// the passengers, the invoice and any refund; the same flow covers rescheduling, names and email").
//
// Guest side (voucher page "Manage booking", linked from My Trips and the confirmation email):
//   requestBookingChange   one request for any mix of: a new date (and preferred time), a new guest
//                          count, a new email address, the names of everyone travelling and a note.
//                          Nothing about the booking changes yet: the request is an OPEN "Other" flag
//                          starting "Change request" (the same flag the older date-only request used),
//                          the details are kept in the audit log (CHANGE_REQUESTED), and the guest
//                          gets an estimate of the new total. Lead name and phone stay instant
//                          (manage-booking.ts updateGuestDetails).
//
// Staff side (Admin → Requests → Change requests, or the Manage booking page):
//   planBookingChange      works out what a change does, without saving it (the preview): seats,
//                          the new invoice, what was paid, the refund or the extra amount due.
//   applyBookingChange     does it in one transaction: seats moved or adjusted on the departure,
//                          the booking's party, totals and priceSnapshot (with a "changes" history)
//                          updated, the request closed, Bókun rebooked; then the refund (through the
//                          payment provider when STAFF_REFUNDS_VIA_PROVIDER=true, else a REFUND_DUE
//                          flag), or a PAYMENT_DUE flag the guest can pay online ("Pay balance").
//   declineChangeRequest   closes the request with a reason the guest is emailed.
//
// Pricing: per-guest tours (shared, shuttles) are repriced with the unit prices the guest booked at
// (KEEP, the default) or the new departure's prices (NEW); the discount they booked with is kept in
// proportion (a fixed-amount code stays fixed). Private tours are priced per vehicle, so a guest
// count change doesn't change the price (the vehicle's size limit still applies). Add-ons (airport
// transfer, activities) stay as booked.
//
// Refunds when the new total is less than what was paid: POLICY (default) follows the cancellation
// policy as it stood when the guest asked: the difference back if they asked before the deadline
// (24 hours for shared tours and shuttles, 72 hours for private tours), nothing after it. FULL gives
// the difference back regardless, NONE keeps it. Money kept is shown on the invoice as a
// "non-refundable" line so total and paid still agree. Docs: docs/BOOKING_CHANGES.md.

import type { Booking, BookingStatus, Payment, Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { getPaymentProvider } from "@/lib/payment/payment.provider";
import { voucherLink } from "@/lib/security/signed-links";
import { emailSchema, z } from "@/lib/security/validate";
import { formatDateOnly, formatTimeOfDay, getMountainTimeInstant, todayInMountainTime } from "@/lib/utils/time";
import { reverseCommissionForRefund } from "@/modules/affiliates/commission";
import { OFFLINE_PROVIDER, appendNote, claimFlag, escapeHtml, staffAudit, staffRefundsViaProvider, type RefundChoice } from "@/modules/admin/booking-admin";
import { guestEmail, opsEmail, titleOf } from "@/modules/admin/booking-requests";
import { bokunBusy, bokunProductId, queueBokunDateChange } from "@/modules/bokun/bokun-sync";
import { bokunSeatsError } from "@/modules/bokun/bokun-seats";
import { bokunConnected } from "@/modules/bokun/config";
import { policyDecision } from "@/modules/bookings/cancellation-policy";
import { sendDateChangeEmail } from "@/modules/bookings/confirmation-email";
import { BALANCE_DUE_DAYS_BEFORE, depositTerms, paidCents } from "@/modules/bookings/deposit";
import { tripOf } from "@/modules/bookings/trip";
import { releaseBookedSeats, takeBookedSeats } from "@/modules/departures/inventory";
import { isVehicleDeparture, partySizeError, seatedGuests, seatsToReserve } from "@/modules/pricing/departure-pricing";

export const CHANGE_PREFIX = "Change request";
const LIVE: BookingStatus[] = ["PENDING_PAYMENT", "CONFIRMED", "PAID_UNSYNCED"];
/** The refund a change makes carries this in Stripe's metadata, so the webhook knows it's ours. */
export const CHANGE_REFUND_KIND = "BOOKING_CHANGE";
const money = (cents: number, currency: string) => `$${(cents / 100).toFixed(2)} ${currency}`;

type Refusal = { status: 400 | 404 | 409; error: string };
const refuse = (status: Refusal["status"], error: string) => ({ status, error }) as const;

// ---------------------------------------------------------------------------------------------
// Pricing

export interface Party {
  adults: number;
  children: number;
  infants: number;
}

interface Snapshot {
  pricing?: "PER_VEHICLE" | "PER_GUEST";
  adultUnitCents?: number | null;
  childUnitCents?: number | null;
  infantUnitCents?: number | null;
  party?: Party;
  fareCents?: number;
  discountCents?: number;
  promo?: { amountOffCents?: number; percent?: number } | null;
  addOnsCents?: number;
  /** Money kept by earlier changes (policy), still part of the total. */
  keptCents?: number;
  changes?: unknown[];
  guestNames?: string;
  [key: string]: unknown;
}

interface PricedDep {
  price: number;
  childPrice?: number | null;
  infantPrice?: number | null;
  capacityTotal: number;
  tour?: { category: string; slug?: string | null } | null;
}

type PricedBooking = Pick<Booking, "totalAmount" | "subtotal" | "addOnsTotal" | "adultsCount" | "childrenCount" | "infantsCount" | "totalSeats" | "priceSnapshot">;

export type Repricing = "KEEP" | "NEW";

/**
 * The booking's invoice for `party` on `departure`. KEEP: the unit prices the guest booked at; NEW:
 * the departure's current prices. Amounts in cents. Pure, so the preview and the change agree.
 */
export function repriceBooking(booking: PricedBooking, current: PricedDep, target: PricedDep, party: Party, repricing: Repricing = "KEEP") {
  const snap = (booking.priceSnapshot ?? {}) as Snapshot;
  const oldFare = snap.fareCents ?? booking.subtotal + (snap.discountCents ?? 0);
  const oldDiscount = snap.discountCents ?? Math.max(0, oldFare - booking.subtotal);
  const addOns = snap.addOnsCents ?? booking.addOnsTotal;
  const kept = snap.keptCents ?? 0;
  const vehicle = snap.pricing ? snap.pricing === "PER_VEHICLE" : isVehicleDeparture(current);

  let fare: number;
  if (vehicle) {
    // One price for the whole vehicle, whoever is in it.
    fare = repricing === "NEW" ? target.price : oldFare;
  } else {
    // Older bookings without unit prices: the fare per seated guest they paid.
    const perSeat = Math.round(oldFare / Math.max(1, booking.totalSeats));
    const keep = {
      adult: snap.adultUnitCents ?? perSeat,
      child: snap.childUnitCents ?? snap.adultUnitCents ?? perSeat,
      infant: snap.adultUnitCents != null ? (snap.infantUnitCents ?? null) : null,
    };
    const unit = repricing === "NEW" ? { adult: target.price, child: target.childPrice ?? target.price, infant: target.infantPrice ?? null } : keep;
    fare = unit.adult * party.adults + unit.child * party.children + (unit.infant ?? 0) * (unit.infant != null ? party.infants : 0);
  }
  // The discount they booked with: a fixed amount stays (at most the fare), a percentage stays in proportion.
  const fixedOff = snap.promo?.amountOffCents && !snap.promo?.percent ? snap.promo.amountOffCents : null;
  const discount = fixedOff != null ? Math.min(fixedOff, fare) : oldFare > 0 ? Math.round((fare * oldDiscount) / oldFare) : 0;
  const subtotal = fare - discount;
  return { vehicle, fareCents: fare, discountCents: discount, subtotalCents: subtotal, addOnsCents: addOns, keptCents: kept, totalCents: subtotal + addOns + kept };
}

// ---------------------------------------------------------------------------------------------
// Guest request

const count = (max: number) => z.coerce.number().int().min(0).max(max);

export const bookingChangeRequestSchema = z
  .object({
    newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date").optional(),
    preferredTime: z.string().trim().max(40).default(""),
    guests: z.object({ adults: count(30), children: count(30).default(0), infants: count(30).default(0) }).optional(),
    customerEmail: emailSchema.optional(),
    guestNames: z.string().trim().max(600).default(""),
    note: z.string().trim().max(500).default(""),
  })
  .strict();

export type BookingChangeRequest = z.infer<typeof bookingChangeRequestSchema>;

const loadBooking = (where: Prisma.BookingWhereUniqueInput) =>
  prisma.booking.findUnique({ where, include: { payments: true, tourDeparture: { include: { tour: true, shuttleRoute: true } } } });
type LoadedBooking = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;

const partyOf = (b: Pick<Booking, "adultsCount" | "childrenCount" | "infantsCount">): Party => ({ adults: b.adultsCount, children: b.childrenCount, infants: b.infantsCount });
const sameParty = (a: Party, b: Party) => a.adults === b.adults && a.children === b.children && a.infants === b.infants;
export function partyLabel(p: Party) {
  const bits = [
    p.adults ? `${p.adults} adult${p.adults === 1 ? "" : "s"}` : null,
    p.children ? `${p.children} child${p.children === 1 ? "" : "ren"}` : null,
    p.infants ? `${p.infants} infant${p.infants === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  return bits.join(", ") || "no guests";
}

/** The guest's request (the caller has proved they own the booking). One open request at a time. */
export async function requestBookingChange(reference: string, input: BookingChangeRequest, userId: string | null) {
  const booking = await loadBooking({ bookingReference: reference });
  if (!booking) return refuse(404, "Booking not found");
  if (!LIVE.includes(booking.status)) return refuse(409, "This booking can't be changed any more.");
  const currentDate = formatDateOnly(booking.tourDeparture.date);
  if (currentDate < todayInMountainTime()) return refuse(409, "This trip has already taken place.");

  const today = todayInMountainTime();
  if (input.newDate && input.newDate < today) return refuse(400, "Choose a date in the future.");
  const newDate = input.newDate && input.newDate !== currentDate ? input.newDate : undefined;
  const from = partyOf(booking);
  const guests = input.guests && !sameParty(input.guests, from) ? input.guests : undefined;
  if (guests) {
    if (guests.adults + guests.children < 1) return refuse(400, "At least one adult or child must travel. To cancel the whole booking, request a cancellation instead.");
    const sizeProblem = partySizeError(booking.tourDeparture, seatedGuests(booking.tourDeparture, guests));
    if (sizeProblem) return refuse(400, sizeProblem);
  }
  const newEmail = input.customerEmail && input.customerEmail !== booking.customerEmail.toLowerCase() ? input.customerEmail : undefined;
  if (!newDate && !guests && !newEmail && !input.guestNames && !input.note) {
    return refuse(400, "Tell us what to change: a new date, the number of guests, the email address or the guests' names.");
  }

  // What the new party would cost on the same date at the price they booked (an estimate: a new date may differ).
  const estimate = guests ? repriceBooking(booking, booking.tourDeparture, booking.tourDeparture, guests, "KEEP") : null;
  const paid = paidCents(booking.payments);

  const parts = [
    newDate ? `move from ${currentDate} to ${newDate}${input.preferredTime ? ` (${input.preferredTime})` : ""}` : input.preferredTime ? `time ${input.preferredTime}` : null,
    guests ? `guests ${partyLabel(from)} to ${partyLabel(guests)}` : null,
    newEmail ? `email ${booking.customerEmail} to ${newEmail}` : null,
    input.guestNames ? `guest names: ${input.guestNames}` : null,
  ].filter(Boolean);
  const note = `${CHANGE_PREFIX}: ${parts.join("; ") || "see the guest's note"}${input.note ? `. Guest note: ${input.note}` : ""}.`.slice(0, 1500);

  const flag = await prisma.$transaction(async (tx) => {
    const open = await tx.bookingFlag.findFirst({ where: { bookingId: booking.id, type: "OTHER", status: "OPEN", note: { startsWith: CHANGE_PREFIX } } });
    if (open) return null;
    const created = await tx.bookingFlag.create({ data: { bookingId: booking.id, type: "OTHER", note } });
    await tx.auditLog.create({
      data: {
        userId,
        action: "CHANGE_REQUESTED",
        entityType: "Booking",
        entityId: booking.id,
        details: {
          flagId: created.id,
          from: currentDate,
          fromParty: from,
          newDate: newDate ?? null,
          preferredTime: input.preferredTime,
          guests: guests ?? null,
          customerEmail: newEmail ?? null,
          guestNames: input.guestNames,
          note: input.note,
          estimateCents: estimate?.totalCents ?? null,
          paidCents: paid,
        } as unknown as Prisma.InputJsonValue,
      },
    });
    return created;
  });
  if (!flag) return refuse(409, "You've already asked to change this booking. We'll email you once it's been reviewed.");

  const title = titleOf(booking);
  const lines = [
    newDate ? `New date: <strong>${newDate}</strong>${input.preferredTime ? ` (${escapeHtml(input.preferredTime)})` : ""} instead of ${currentDate}.` : null,
    guests ? `Guests: <strong>${partyLabel(guests)}</strong> instead of ${partyLabel(from)}.` : null,
    newEmail ? `Email: <strong>${escapeHtml(newEmail)}</strong>.` : null,
    input.guestNames ? `Guest names: ${escapeHtml(input.guestNames)}.` : null,
  ].filter((l): l is string => Boolean(l));
  const estimateLine =
    estimate && estimate.totalCents !== booking.totalAmount
      ? `At the price you booked, the new total would be about <strong>${money(estimate.totalCents, booking.currency)}</strong> (it is ${money(booking.totalAmount, booking.currency)} now). Any refund follows our cancellation policy.`
      : null;
  guestEmail(booking.customerEmail, `We received your change request: ${booking.bookingReference}`, "Change request received", [
    `Hi ${escapeHtml(booking.customerName)}, we received your request to change <strong>${booking.bookingReference}</strong> (${escapeHtml(title)}, ${currentDate}).`,
    ...lines,
    ...(estimateLine ? [estimateLine] : []),
    "Your booking stays as it is until our team confirms the change, usually within one business day. If the price changes, we'll tell you before anything is charged or refunded.",
  ]);
  if (newEmail) {
    guestEmail(newEmail, `Change request for booking ${booking.bookingReference}`, "Change request received", [
      `Someone asked for Vista Chase booking <strong>${booking.bookingReference}</strong> to use this email address. Our team will confirm the change; nothing changes until then.`,
    ]);
  }
  opsEmail(
    `Change request ${booking.bookingReference}`,
    `${booking.customerName} asked to change ${booking.bookingReference} (${title}, ${currentDate}): ${parts.join("; ") || "see note"}${input.note ? `. Note: ${input.note}` : ""}. Review it in Admin → Requests → Change requests.`,
  );
  return {
    status: 201 as const,
    request: { id: flag.id, createdAt: flag.createdAt },
    estimate: estimate ? { total: estimate.totalCents / 100, current: booking.totalAmount / 100, paid: paid / 100, currency: booking.currency } : null,
  };
}

// ---------------------------------------------------------------------------------------------
// Staff: plan (preview) and apply

export interface ChangeInput {
  /** Another departure of the same tour; omitted = stays on the current one. */
  departureId?: string;
  guests?: Party;
  customerName?: string;
  customerEmail?: string;
  guestNames?: string;
  repricing: Repricing;
  refund: RefundChoice;
  note?: string;
  notifyGuest: boolean;
  /** The guest's request being answered (an OPEN "Change request" flag of this booking). */
  requestId?: string;
}

export const changeInputSchema = z
  .object({
    departureId: z.string().min(1).max(64).optional(),
    guests: z.object({ adults: count(30), children: count(30).default(0), infants: count(30).default(0) }).optional(),
    customerName: z.string().trim().min(2).max(120).optional(),
    customerEmail: emailSchema.optional(),
    guestNames: z.string().trim().max(600).optional(),
    repricing: z.enum(["KEEP", "NEW"]).default("KEEP"),
    refund: z.enum(["POLICY", "FULL", "NONE"]).default("POLICY"),
    note: z.string().trim().max(500).optional(),
    notifyGuest: z.boolean().default(true),
    requestId: z.string().min(1).max(64).optional(),
  })
  .strict();

/** When the guest asked (the request's date), for the POLICY refund; now when staff change it themselves. */
async function requestedAt(bookingId: string, requestId?: string) {
  if (!requestId) return { at: new Date(), flag: null };
  const flag = await prisma.bookingFlag.findUnique({ where: { id: requestId } });
  if (!flag || flag.bookingId !== bookingId || flag.type !== "OTHER" || !flag.note.startsWith(CHANGE_PREFIX)) return { at: new Date(), flag: null, missing: true };
  return { at: flag.createdAt, flag };
}

/** Everything a change does, worked out without saving it. Amounts in cents. */
export async function planBookingChange(bookingId: string, input: ChangeInput) {
  const booking = await loadBooking({ id: bookingId });
  if (!booking) return refuse(404, "Booking not found");
  if (!LIVE.includes(booking.status)) return refuse(409, `A ${booking.status.toLowerCase().replace("_", " ")} booking can't be changed.`);
  const req = await requestedAt(booking.id, input.requestId);
  if ("missing" in req && req.missing) return refuse(404, "That change request wasn't found for this booking.");
  if (req.flag && req.flag.status !== "OPEN") return refuse(409, "This request was already answered.");

  const current = booking.tourDeparture;
  let target = current;
  if (input.departureId && input.departureId !== current.id) {
    const found = await prisma.tourDeparture.findUnique({ where: { id: input.departureId }, include: { tour: true, shuttleRoute: true } });
    if (!found) return refuse(404, "Departure not found");
    const sameProduct = current.tourId ? found.tourId === current.tourId : found.shuttleRouteId === current.shuttleRouteId;
    if (!sameProduct) return refuse(400, "Pick a departure of the same tour.");
    if (found.status !== "ACTIVE") return refuse(409, "That departure is full or cancelled.");
    if (formatDateOnly(found.date) < todayInMountainTime()) return refuse(400, "That date has passed.");
    target = found;
  }
  const moving = target.id !== current.id;
  if (!moving && formatDateOnly(current.date) < todayInMountainTime()) return refuse(409, "This trip has already taken place.");

  const fromParty = partyOf(booking);
  const party = input.guests ?? fromParty;
  if (party.adults + party.children < 1) return refuse(400, "At least one adult or child must travel; cancel the booking instead.");
  const seated = seatedGuests(target, party);
  const sizeProblem = partySizeError(target, seated);
  if (sizeProblem) return refuse(400, sizeProblem);

  // Seats: on the same departure only the difference; moving takes them on the new one and frees the old.
  const oldReserved = seatsToReserve(current, booking.totalSeats);
  const newReserved = seatsToReserve(target, seated);
  const seatsNeeded = moving ? newReserved : Math.max(0, newReserved - oldReserved);
  const left = target.capacityTotal - target.capacityBooked - target.capacityHeld;
  if (seatsNeeded > left) {
    return refuse(409, moving ? `Not enough seats on that departure (${Math.max(0, left)} left, ${newReserved} needed).` : `Only ${Math.max(0, left)} more seat${left === 1 ? "" : "s"} left on this departure.`);
  }

  const totals = repriceBooking(booking, current, target, party, input.repricing);
  const paid = paidCents(booking.payments);
  // Refund owed on its way back already (an earlier change) is not paid any more.
  const openRefunds = await prisma.bookingFlag.aggregate({ where: { bookingId: booking.id, type: "REFUND_DUE", status: "OPEN" }, _sum: { amountCents: true } });
  const netPaid = paid - (openRefunds._sum.amountCents ?? 0);
  const excess = Math.max(0, netPaid - totals.totalCents);
  const policy = await policyDecision(booking, req.at);
  const refundCents = excess === 0 ? 0 : input.refund === "NONE" ? 0 : input.refund === "FULL" ? excess : policy.eligible ? excess : 0;
  const keptCents = excess - refundCents;
  // What was kept stays on the invoice, so the total matches what was paid.
  const newTotal = totals.totalCents + keptCents;
  const deposit = booking.paymentPlan === "DEPOSIT" && !booking.balancePaidAt;
  // Owed now: a deposit booking's balance is collected as usual (Pay balance, reminders) unless it
  // was already paid in full; any other booking owes the difference straight away.
  const dueCents = Math.max(0, newTotal - netPaid);

  const changes = {
    date: moving ? { from: `${formatDateOnly(current.date)} ${formatTimeOfDay(current.departureTime)}`, to: `${formatDateOnly(target.date)} ${formatTimeOfDay(target.departureTime)}` } : null,
    guests: sameParty(party, fromParty) ? null : { from: partyLabel(fromParty), to: partyLabel(party) },
    customerName: input.customerName && input.customerName !== booking.customerName ? { from: booking.customerName, to: input.customerName } : null,
    customerEmail: input.customerEmail && input.customerEmail !== booking.customerEmail.toLowerCase() ? { from: booking.customerEmail, to: input.customerEmail } : null,
    guestNames: input.guestNames && input.guestNames !== ((booking.priceSnapshot as Snapshot | null)?.guestNames ?? "") ? input.guestNames : null,
    total: newTotal !== booking.totalAmount ? { from: booking.totalAmount, to: newTotal } : null,
  };
  const nothing = !changes.date && !changes.guests && !changes.customerName && !changes.customerEmail && !changes.guestNames && !changes.total;

  return {
    status: 200 as const,
    booking,
    current,
    target,
    moving,
    party,
    fromParty,
    seated,
    seatsNeeded,
    oldReserved,
    newReserved,
    totals,
    paidCents: netPaid,
    refundCents,
    keptCents,
    newTotal,
    dueCents,
    deposit,
    policy: { eligible: policy.eligible, cutoffHours: policy.cutoffHours, askedAt: req.at },
    trip: tripOf(booking.priceSnapshot, booking.bookingReference),
    changes,
    nothing,
    request: req.flag,
  };
}
type Plan = Extract<Awaited<ReturnType<typeof planBookingChange>>, { status: 200 }>;

/** The preview staff see before they press Apply (dollars). */
export function planSummary(plan: Plan) {
  const c = plan.booking.currency;
  return {
    currency: c,
    changes: {
      ...plan.changes,
      total: plan.changes.total ? { from: plan.changes.total.from / 100, to: plan.changes.total.to / 100 } : null,
    },
    nothing: plan.nothing,
    departure: { id: plan.target.id, date: formatDateOnly(plan.target.date), time: formatTimeOfDay(plan.target.departureTime) },
    guests: plan.party,
    seats: { before: plan.oldReserved, after: plan.newReserved, moving: plan.moving },
    invoice: {
      fare: plan.totals.fareCents / 100,
      discount: plan.totals.discountCents / 100,
      addOns: plan.totals.addOnsCents / 100,
      kept: (plan.totals.keptCents + plan.keptCents) / 100,
      total: plan.newTotal / 100,
      pricing: plan.totals.vehicle ? "PER_VEHICLE" : "PER_GUEST",
    },
    paid: plan.paidCents / 100,
    refund: plan.refundCents / 100,
    keptNow: plan.keptCents / 100,
    due: plan.dueCents / 100,
    depositBalance: plan.deposit,
    policy: plan.policy,
    multiDayTrip: plan.trip ? { reference: plan.trip.reference, days: plan.trip.references.length } : null,
    bokun: bokunConnected() && bokunProductId(plan.target.tour) != null,
    text: `${money(plan.booking.totalAmount, c)} → ${money(plan.newTotal, c)}`,
  };
}

/** Money back on a booking that stays live: through the provider when allowed, else owed by hand. */
async function refundLiveBooking(booking: LoadedBooking, cents: number, staffId: string, why: string) {
  let refunded = 0;
  if (cents > 0 && staffRefundsViaProvider()) {
    let left = cents;
    // Newest payment first (a balance before the deposit).
    const paid = booking.payments.filter((p) => p.status === "SUCCEEDED" && p.provider !== OFFLINE_PROVIDER && p.amount > 0).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    for (const payment of paid) {
      const amount = Math.min(left, payment.amount);
      if (amount <= 0) break;
      try {
        const refund = await getPaymentProvider().refundPayment(payment.transactionId, amount, { bookingReference: booking.bookingReference, kind: CHANGE_REFUND_KIND });
        if (!refund.success) continue;
        await prisma.$transaction((tx) => reducePayment(tx, payment, amount));
        refunded += amount;
        left -= amount;
        await reverseCommissionForRefund(booking.id, refund.refundId, amount, "booking changed").catch((e) =>
          console.error(`Commission reversal failed for ${booking.bookingReference}:`, (e as Error).message),
        );
      } catch (error) {
        console.error(`Change refund failed for ${booking.bookingReference}:`, (error as Error).message);
      }
    }
  }
  const owed = cents - refunded;
  let flagId: string | null = null;
  if (owed > 0) {
    const flag = await prisma.bookingFlag.create({
      data: { bookingId: booking.id, type: "REFUND_DUE", amountCents: owed, createdById: staffId, note: `Change refund ${money(owed, booking.currency)} owed (booking stays active): ${why}` },
    });
    flagId = flag.id;
  }
  return { refunded, owed, flagId };
}

/** A partial refund on a live booking lowers what that payment counts for; all of it, and it is REFUNDED. */
async function reducePayment(tx: Prisma.TransactionClient, payment: Pick<Payment, "id" | "amount">, cents: number) {
  if (cents >= payment.amount) await tx.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
  else await tx.payment.update({ where: { id: payment.id }, data: { amount: payment.amount - cents } });
}

/**
 * A refund staff sent by hand for a booking that stays live (Mark refunded on a change refund):
 * what the booking's payments count for drops by the amount, newest payment first.
 */
export async function reducePaidBy(tx: Prisma.TransactionClient, bookingId: string, cents: number) {
  let left = cents;
  const paid = await tx.payment.findMany({ where: { bookingId, status: "SUCCEEDED", amount: { gt: 0 } }, orderBy: { createdAt: "desc" } });
  for (const p of paid) {
    if (left <= 0) break;
    const take = Math.min(left, p.amount);
    await reducePayment(tx, p, take);
    left -= take;
  }
}

/** Applies a change (see the file header). */
export async function applyBookingChange(bookingId: string, input: ChangeInput, staffId: string) {
  const plan = await planBookingChange(bookingId, input);
  if (plan.status !== 200) return plan;
  if (plan.nothing && !plan.request) return refuse(400, "Nothing to change.");
  const { booking, current, target } = plan;
  const reshaped = plan.moving || plan.changes.guests != null;

  const bokunScope = bokunProductId(target.tour) != null;
  if (reshaped && bokunScope) {
    if (await bokunBusy(booking.id)) return refuse(409, "This booking is being sent to Bókun right now. Try again in a minute.");
    // Bókun's own seats decide too when the booking needs more of them.
    const need = plan.moving ? plan.seated : Math.max(0, plan.seated - booking.totalSeats);
    if (need > 0 && !isVehicleDeparture(target)) {
      const refused = await bokunSeatsError(target.id, need);
      if (refused) return refuse(409, `Bókun: ${refused}`);
    } else if (plan.moving) {
      const refused = await bokunSeatsError(target.id, 1);
      if (refused) return refuse(409, `Bókun: ${refused}`);
    }
  }

  const snap = (booking.priceSnapshot ?? {}) as Snapshot;
  const at = new Date();
  const record = {
    at: at.toISOString(),
    by: staffId,
    requestId: plan.request?.id ?? null,
    date: plan.changes.date,
    guests: plan.changes.guests ? { from: plan.fromParty, to: plan.party } : null,
    customerName: plan.changes.customerName,
    customerEmail: plan.changes.customerEmail,
    guestNames: plan.changes.guestNames,
    repricing: input.repricing,
    totalFromCents: booking.totalAmount,
    totalToCents: plan.newTotal,
    paidCents: plan.paidCents,
    refundCents: plan.refundCents,
    keptCents: plan.keptCents,
    dueCents: plan.dueCents,
    note: input.note ?? null,
  };
  const oldCode = booking.bokunBookingId;

  const done = await prisma
    .$transaction(async (tx) => {
      // Seats first: a full departure refuses before anything else changes.
      if (plan.moving) {
        if (!(await takeBookedSeats(tx, target.id, plan.newReserved))) return "full" as const;
      } else if (plan.newReserved > plan.oldReserved) {
        if (!(await takeBookedSeats(tx, current.id, plan.newReserved - plan.oldReserved))) return "full" as const;
      }
      const claimed = await tx.booking.updateMany({
        where: { id: booking.id, tourDepartureId: current.id, status: { in: LIVE }, totalAmount: booking.totalAmount, totalSeats: booking.totalSeats },
        data: {
          tourDepartureId: target.id,
          adultsCount: plan.party.adults,
          childrenCount: plan.party.children,
          infantsCount: plan.party.infants,
          totalSeats: plan.seated,
          subtotal: plan.totals.subtotalCents,
          addOnsTotal: plan.totals.addOnsCents,
          totalAmount: plan.newTotal,
          ...(plan.changes.customerName ? { customerName: plan.changes.customerName.to } : {}),
          ...(plan.changes.customerEmail ? { customerEmail: plan.changes.customerEmail.to } : {}),
          priceSnapshot: {
            ...snap,
            party: plan.party,
            fareCents: plan.totals.fareCents,
            discountCents: plan.totals.discountCents,
            totalCents: plan.newTotal,
            keptCents: plan.totals.keptCents + plan.keptCents,
            ...(input.repricing === "NEW" && !plan.totals.vehicle
              ? { adultUnitCents: target.price, childUnitCents: target.childPrice ?? target.price, infantUnitCents: target.infantPrice }
              : {}),
            ...(input.repricing === "NEW" && plan.totals.vehicle ? { adultUnitCents: target.price } : {}),
            ...(plan.changes.guestNames ? { guestNames: plan.changes.guestNames } : {}),
            changes: [...(Array.isArray(snap.changes) ? snap.changes : []), record],
          } as unknown as Prisma.InputJsonValue,
        },
      });
      if (claimed.count !== 1) throw new Error("changed");
      if (plan.moving) await releaseBookedSeats(tx, current.id, plan.oldReserved);
      else if (plan.newReserved < plan.oldReserved) await releaseBookedSeats(tx, current.id, plan.oldReserved - plan.newReserved);

      // Deposit bookings: the balance falls due a fixed time before the (new) trip.
      if (booking.paymentPlan === "DEPOSIT" && !booking.balancePaidAt && plan.moving) {
        const startsAt = getMountainTimeInstant(target.date, target.departureTime);
        const balanceDueAt = depositTerms(plan.newTotal, startsAt)?.balanceDueAt ?? new Date(Math.max(Date.now(), startsAt.getTime() - BALANCE_DUE_DAYS_BEFORE * 86_400_000));
        await tx.booking.update({ where: { id: booking.id }, data: { balanceDueAt, balanceReminderStage: 0 } });
      }
      if (booking.paymentPlan === "DEPOSIT" && plan.dueCents === 0 && !booking.balancePaidAt) {
        // The new total is covered by what was paid.
        await tx.booking.update({ where: { id: booking.id }, data: { balancePaidAt: at } });
      }
      if (plan.dueCents > 0 && (!plan.deposit || booking.balancePaidAt)) {
        if (booking.balancePaidAt) await tx.booking.update({ where: { id: booking.id }, data: { balancePaidAt: null } });
        await tx.bookingFlag.create({
          data: {
            bookingId: booking.id,
            type: "PAYMENT_DUE",
            amountCents: plan.dueCents,
            createdById: staffId,
            note: `Booking changed: ${money(plan.dueCents, booking.currency)} more to collect (new total ${money(plan.newTotal, booking.currency)}). The guest can pay it from the voucher page (Pay balance).`,
          },
        });
      }
      if (plan.changes.guestNames) {
        const others = (booking.specialRequests ?? "").split("\n").filter((l) => !l.startsWith("Guest names:"));
        await tx.booking.update({ where: { id: booking.id }, data: { specialRequests: [...others, `Guest names: ${plan.changes.guestNames}`].filter(Boolean).join("\n") } });
      }

      // The guest's request is answered (any open change request on this booking).
      await tx.bookingFlag.updateMany({
        where: { bookingId: booking.id, status: "OPEN", type: "OTHER", note: { startsWith: CHANGE_PREFIX } },
        data: { status: "RESOLVED", resolvedById: staffId, resolvedAt: at, resolution: `Changed by staff: ${summaryLine(plan)}` },
      });
      await appendNote(tx, booking.id, `Booking changed by staff: ${summaryLine(plan)}${input.note ? ` (${input.note})` : ""}`);
      await staffAudit(tx, staffId, "BOOKING_CHANGED", "Booking", booking.id, record);
      if (reshaped) await queueBokunDateChange(tx, booking.id, oldCode);
      return "done" as const;
    })
    .catch((e) => {
      if ((e as Error).message === "changed") return "changed" as const;
      throw e;
    });
  if (done === "full") return refuse(409, "Not enough seats left for this change.");
  if (done === "changed") return refuse(409, "The booking changed meanwhile. Reload and try again.");

  const refund = plan.refundCents > 0 ? await refundLiveBooking(booking, plan.refundCents, staffId, summaryLine(plan)) : { refunded: 0, owed: 0, flagId: null };

  let email: string = "not-sent";
  if (input.notifyGuest) {
    const fresh = await loadBooking({ id: booking.id });
    if (fresh) email = await emailGuest(fresh, plan, refund);
  }
  return {
    status: 200 as const,
    ...planSummary(plan),
    refunded: refund.refunded / 100,
    refundOwed: refund.owed / 100,
    refundFlagId: refund.flagId,
    email,
  };
}

function summaryLine(plan: Plan) {
  const c = plan.booking.currency;
  return [
    plan.changes.date ? `date ${plan.changes.date.from} → ${plan.changes.date.to}` : null,
    plan.changes.guests ? `guests ${plan.changes.guests.from} → ${plan.changes.guests.to}` : null,
    plan.changes.customerName ? `name → ${plan.changes.customerName.to}` : null,
    plan.changes.customerEmail ? `email → ${plan.changes.customerEmail.to}` : null,
    plan.changes.guestNames ? "guest names updated" : null,
    plan.changes.total ? `total ${money(plan.changes.total.from, c)} → ${money(plan.changes.total.to, c)}` : null,
    plan.refundCents > 0 ? `refund ${money(plan.refundCents, c)}` : null,
    plan.keptCents > 0 ? `${money(plan.keptCents, c)} kept (cancellation policy)` : null,
    plan.dueCents > 0 ? `${money(plan.dueCents, c)} to pay` : null,
  ]
    .filter(Boolean)
    .join(", ") || "no change";
}

async function emailGuest(b: LoadedBooking, plan: Plan, refund: { refunded: number; owed: number }) {
  const c = b.currency;
  const title = titleOf(b);
  const link = voucherLink(b.bookingReference);
  const lines = [
    plan.changes.date ? `New date: <strong>${formatDateOnly(b.tourDeparture.date)} at ${formatTimeOfDay(b.tourDeparture.departureTime)}</strong> (Mountain Time).` : null,
    plan.changes.guests ? `Guests: <strong>${plan.changes.guests.to}</strong> (was ${plan.changes.guests.from}).` : null,
    plan.changes.customerName ? `Lead guest: <strong>${escapeHtml(plan.changes.customerName.to)}</strong>.` : null,
    plan.changes.customerEmail ? `Email: <strong>${escapeHtml(plan.changes.customerEmail.to)}</strong>.` : null,
    plan.changes.guestNames ? `Guest names: ${escapeHtml(plan.changes.guestNames)}.` : null,
    plan.changes.total ? `New total: <strong>${money(plan.newTotal, c)}</strong> (was ${money(plan.changes.total.from, c)}).` : null,
    refund.refunded > 0 ? `We have refunded <strong>${money(refund.refunded, c)}</strong> to your original payment method; it usually arrives within 5–10 business days.` : null,
    refund.owed > 0 ? `A refund of <strong>${money(refund.owed, c)}</strong> is on its way; we'll confirm once it has been sent.` : null,
    plan.keptCents > 0 ? `${money(plan.keptCents, c)} is non-refundable under our cancellation policy, because the change was asked for less than ${plan.policy.cutoffHours} hours before departure.` : null,
    plan.dueCents > 0 && (!plan.deposit || b.balancePaidAt == null)
      ? `<strong>${money(plan.dueCents, c)}</strong> is still to pay${plan.deposit ? " with your balance" : ""}. You can pay it from your voucher (Pay balance).`
      : null,
  ].filter((l): l is string => Boolean(l));

  guestEmail(b.customerEmail, `Your booking has been updated: ${b.bookingReference}`, "Booking updated", [
    `Hi ${escapeHtml(b.customerName)}, we've updated <strong>${b.bookingReference}</strong> for <strong>${escapeHtml(title)}</strong>.`,
    ...lines,
    `Your voucher shows the new details: <a href="${link}">open your voucher</a>.`,
  ]);
  if (plan.changes.customerEmail) {
    // The old address hears about it too, in case the change wasn't theirs.
    guestEmail(plan.changes.customerEmail.from, `Booking ${b.bookingReference} now uses a new email`, "Email address changed", [
      `Booking <strong>${b.bookingReference}</strong> now sends its emails to ${escapeHtml(plan.changes.customerEmail.to)}. If you didn't ask for this, reply to this email or call +1 (825) 734-9456.`,
    ]);
  }
  // A new date also gets the updated ticket (PDF), as the date-change tool sends.
  if (plan.changes.date && b.status === "CONFIRMED") return sendDateChangeEmail(b.bookingReference, { previous: plan.changes.date.from });
  return "sent";
}

/** Decline: the booking stays as it is; the guest is told why. */
export async function declineChangeRequest(flagId: string, input: { reason: string; notifyGuest: boolean }, staffId: string) {
  const flag = await prisma.bookingFlag.findUnique({ where: { id: flagId }, include: { booking: { include: { tourDeparture: { include: { tour: true, shuttleRoute: true } } } } } });
  if (!flag || flag.type !== "OTHER" || !flag.note.startsWith(CHANGE_PREFIX)) return refuse(404, "Change request not found");
  const done = await prisma.$transaction(async (tx) => {
    const claimed = await claimFlag(tx, flagId, staffId, `Declined: ${input.reason}`);
    if (!claimed) return null;
    await appendNote(tx, flag.bookingId, `Change request declined: ${input.reason}`);
    await staffAudit(tx, staffId, "DECLINE_CHANGE_REQUEST", "Booking", flag.bookingId, { flagId, reason: input.reason });
    return claimed;
  });
  if (!done) return refuse(409, "This request was already answered.");
  const b = flag.booking;
  if (input.notifyGuest) {
    guestEmail(b.customerEmail, `About your change request: ${b.bookingReference}`, "Your booking is unchanged", [
      `Hi ${escapeHtml(b.customerName)}, we reviewed your request to change <strong>${b.bookingReference}</strong> for <strong>${escapeHtml(titleOf(b))}</strong> on ${formatDateOnly(b.tourDeparture.date)}.`,
      `We weren't able to make the change: ${escapeHtml(input.reason)}`,
      "Your booking and voucher are unchanged.",
    ]);
  }
  return { status: 200 as const, flag: done };
}

/** Open change requests for Admin → Requests, with what the guest asked for. */
export async function listChangeRequests() {
  const flags = await prisma.bookingFlag.findMany({
    where: { type: "OTHER", status: "OPEN", note: { startsWith: CHANGE_PREFIX } },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      booking: {
        select: {
          id: true, bookingReference: true, status: true, customerName: true, customerEmail: true, customerPhone: true, totalSeats: true,
          adultsCount: true, childrenCount: true, infantsCount: true, totalAmount: true, currency: true, paymentPlan: true, createdAt: true,
          paymentExpiresAt: true, priceSnapshot: true,
          payments: { select: { amount: true, status: true } },
          tourDeparture: { select: { id: true, date: true, departureTime: true, tour: { select: { slug: true, title: true, category: true } }, shuttleRoute: { select: { name: true } } } },
        },
      },
    },
  });
  const audits = flags.length
    ? await prisma.auditLog.findMany({ where: { action: "CHANGE_REQUESTED", entityId: { in: flags.map((f) => f.bookingId) } }, orderBy: { createdAt: "desc" } })
    : [];
  return flags.map((f) => {
    const details = (audits.find((a) => (a.details as { flagId?: string } | null)?.flagId === f.id)?.details ?? {}) as Record<string, unknown>;
    const b = f.booking;
    return {
      id: f.id,
      note: f.note,
      createdAt: f.createdAt,
      asked: {
        newDate: (details.newDate as string | null) ?? null,
        preferredTime: (details.preferredTime as string | undefined) || null,
        guests: (details.guests as Party | null) ?? null,
        customerEmail: (details.customerEmail as string | null) ?? null,
        guestNames: (details.guestNames as string | undefined) || null,
        note: (details.note as string | undefined) || null,
        estimate: typeof details.estimateCents === "number" ? details.estimateCents / 100 : null,
      },
      booking: {
        id: b.id,
        bookingReference: b.bookingReference,
        status: b.status,
        customerName: b.customerName,
        customerEmail: b.customerEmail,
        customerPhone: b.customerPhone,
        totalSeats: b.totalSeats,
        guests: partyOf(b),
        totalAmount: b.totalAmount / 100,
        paid: paidCents(b.payments) / 100,
        currency: b.currency,
        paymentPlan: b.paymentPlan,
        createdAt: b.createdAt,
        paymentExpiresAt: b.paymentExpiresAt,
        experience: titleOf({ tourDeparture: { tour: b.tourDeparture.tour, shuttleRoute: b.tourDeparture.shuttleRoute } }),
        category: b.tourDeparture.tour?.category ?? "SHUTTLE",
        date: formatDateOnly(b.tourDeparture.date),
        departureTime: formatTimeOfDay(b.tourDeparture.departureTime),
        departureId: b.tourDeparture.id,
        multiDayTrip: tripOf(b.priceSnapshot, b.bookingReference) != null,
      },
    };
  });
}
