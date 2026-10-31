// Website bookings → Bókun, with Bókun's two-step checkout for payments taken elsewhere (Stripe).
// bokun-sync.ts runs both steps right after the booking is confirmed on this site:
//
//   1. reserve   POST /checkout.json/options/booking-request, then POST /checkout.json/submit with
//                RESERVE_FOR_EXTERNAL_PAYMENT. Bókun holds the seats and returns a confirmation code.
//   2. confirm   POST /checkout.json/confirm-reserved/{code} with the amount the guest paid us.
//   or abort     POST /booking.json/{code}/abort-reserved when the booking was cancelled in between.
//   cancel       POST /booking.json/cancel-booking/{code} when a confirmed booking is cancelled
//                (the refund is made through Stripe, not Bókun).
//
// The slot (startTimeId, rateId) and the passenger categories are read from Bókun at reservation
// time, so a booking always uses Bókun's current IDs and seat count.

import type { BokunApi } from "@/modules/bokun/config";

/** One start of a Bókun product (GET /activity.json/{id}/availabilities). */
export interface BokunAvailability {
  /** Epoch ms of the day (UTC midnight). */
  date: number;
  startTime?: string;
  startTimeId?: number;
  /** Seats Bókun still sells. */
  availabilityCount?: number;
  bookedParticipants?: number;
  soldOut?: boolean;
  unavailable?: boolean;
  defaultRateId?: number;
  rates?: { id: number; pricedPerPerson?: boolean; maxPerBooking?: number | null }[];
}

/** A Bókun passenger category (pricingCategories on GET /activity.json/{id}). */
export interface BokunCategory {
  id: number;
  title: string;
}

/** Bókun has no room for this party on this departure (sold out, closed, or not offered). */
export class BokunUnavailableError extends Error {}

export interface BokunReservationInput {
  bookingReference: string;
  productBokunId: string;
  /** Our tour category: PRIVATE books the whole vehicle. */
  category: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm, Mountain Time
  adults: number;
  children: number;
  infants: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickup?: string;
  specialRequests?: string;
}

export interface BokunPayment {
  /** Dollars. */
  amount: number;
  currency: string;
  transactionId?: string;
}

type Availability = BokunAvailability;

/** Bókun's "YYYY-MM-DD" and "HH:mm" for one availability (start times without a clock read as 00:00). */
// Bókun sends the day as the epoch time of midnight in the vendor's time zone, so a vendor east of
// UTC (India: 18:30 UTC the day before) or west of it (Banff: 07:00 UTC) is rounded to the nearest
// UTC midnight to get the vendor's calendar day.
const DAY_MS = 86_400_000;
export const slotDate = (a: BokunAvailability) => {
  const ms = typeof a.date === "number" ? a.date : Date.parse(String(a.date));
  return new Date(Math.round(ms / DAY_MS) * DAY_MS).toISOString().slice(0, 10);
};
/** "7:00", "07:00" and "07:00:00" all read as "07:00". */
export const slotTime = (a: BokunAvailability) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(a.startTime ?? "");
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "00:00";
};

const RESERVE = "RESERVE_FOR_EXTERNAL_PAYMENT";
const isChild = (title: string) => /child|youth|kid/i.test(title);
const isInfant = (title: string) => /infant|baby/i.test(title);
const groupSize = (title: string) => Number(/group of (\d+)/i.exec(title)?.[1] ?? NaN);

/** Bókun's start for our departure: same day and start time. */
export function findSlot(list: Availability[], date: string, time: string) {
  return list.find((a) => slotDate(a) === date && slotTime(a) === time);
}

/**
 * One Bókun passenger per guest, in Bókun's categories: adults in the adult category, children in
 * the child category (or adult when there is none), infants only when Bókun has an infant category
 * (otherwise they're named in the note). "Group of N" products take one unit of the smallest group
 * that fits.
 */
export function buildPassengers(input: Pick<BokunReservationInput, "category" | "adults" | "children" | "infants">, categories: BokunCategory[]) {
  const guests = input.adults + input.children;
  const groups = categories.filter((c) => Number.isFinite(groupSize(c.title))).sort((a, b) => groupSize(a.title) - groupSize(b.title));
  if (groups.length > 0) {
    const fits = groups.find((g) => groupSize(g.title) >= guests) ?? groups[groups.length - 1];
    return { passengers: [{ pricingCategoryId: fits.id }], infantsInNote: input.infants };
  }

  const adult = categories.find((c) => !isChild(c.title) && !isInfant(c.title)) ?? categories[0];
  if (!adult) throw new Error("Bókun returned no passenger categories for this product.");
  const child = input.category === "PRIVATE" ? adult : categories.find((c) => isChild(c.title)) ?? adult;
  const infant = input.category === "PRIVATE" ? undefined : categories.find((c) => isInfant(c.title));
  const passengers = [
    ...Array.from({ length: input.adults }, () => ({ pricingCategoryId: adult.id })),
    ...Array.from({ length: input.children }, () => ({ pricingCategoryId: child.id })),
    ...(infant ? Array.from({ length: input.infants }, () => ({ pricingCategoryId: infant.id })) : []),
  ];
  return { passengers, infantsInNote: infant ? 0 : input.infants };
}

export function buildNote(input: BokunReservationInput, infantsInNote: number) {
  return [
    `Booked on vistachase.com, reference ${input.bookingReference}.`,
    input.pickup ? `Pickup: ${input.pickup}.` : "",
    infantsInNote > 0 ? `Also ${infantsInNote} infant${infantsInNote === 1 ? "" : "s"} (0–2, no seat).` : "",
    input.specialRequests ? `Guest requests: ${input.specialRequests}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
}

function mainContact(input: BokunReservationInput) {
  const [first, ...rest] = input.customerName.trim().split(/\s+/);
  return [
    { questionId: "firstName", values: [first || input.customerName] },
    { questionId: "lastName", values: [rest.join(" ") || "-"] },
    { questionId: "email", values: [input.customerEmail] },
    { questionId: "phoneNumber", values: [input.customerPhone] },
  ];
}

/**
 * Reserves the booking in Bókun for payment taken by us; returns Bókun's confirmation code.
 * `beforeSubmit` runs just before the one call that creates the reservation, so a caller can
 * record that a reservation may exist if that call fails without an answer.
 */
export async function reserveInBokun(client: BokunApi, input: BokunReservationInput, beforeSubmit?: () => Promise<void>): Promise<string> {
  const [list, detail] = await Promise.all([
    client.getAvailabilities(input.productBokunId, input.date, input.date) as Promise<Availability[] | null>,
    client.fetch("GET", `/activity.json/${input.productBokunId}?lang=EN&currency=CAD`) as Promise<{ pricingCategories?: BokunCategory[] } | null>,
  ]);
  const slot = findSlot(Array.isArray(list) ? list : [], input.date, input.time);
  if (!slot || slot.unavailable) {
    const sameDay = (Array.isArray(list) ? list : []).filter((a) => slotDate(a) === input.date && !a.unavailable).map(slotTime);
    throw new BokunUnavailableError(
      `Bókun doesn't offer this departure (${input.date} ${input.time}). Bókun has ${sameDay.length ? `only ${[...new Set(sameDay)].join(", ")}` : "no start times"} on that day: add a ${input.time} start time with seats on that date in Bókun.`,
    );
  }
  const seatsLeft = Math.max(0, slot.availabilityCount ?? 0);
  const needed = input.category === "PRIVATE" ? 1 : input.adults + input.children;
  if (slot.soldOut || seatsLeft < needed) throw new BokunUnavailableError(`Bókun has ${seatsLeft} seat(s) left.`);

  const rateId = slot.defaultRateId ?? slot.rates?.[0]?.id;
  const { passengers, infantsInNote } = buildPassengers(input, (detail?.pricingCategories ?? []).map((c) => ({ id: c.id, title: c.title })));
  const directBooking = {
    externalBookingReference: input.bookingReference,
    mainContactDetails: mainContact(input),
    activityBookings: [
      {
        activityId: Number(input.productBokunId),
        rateId,
        date: input.date,
        startTimeId: slot.startTimeId,
        pickup: false,
        dropoff: false,
        passengers,
        extras: [],
        note: buildNote(input, infantsInNote),
      },
    ],
  };

  const options = (await client.fetch("POST", "/checkout.json/options/booking-request?currency=CAD", directBooking)) as {
    options?: { type: string; paymentMethods?: { allowedMethods?: string[] }; allowedMethods?: string[] }[];
  } | null;
  const option = options?.options?.find((o) => (o.paymentMethods?.allowedMethods ?? o.allowedMethods ?? []).includes(RESERVE));
  if (!option) throw new BokunUnavailableError("Bókun offers no reserve-for-external-payment checkout for this booking (check the API key's booking channel).");

  await beforeSubmit?.();
  const submitted = (await client.fetch("POST", "/checkout.json/submit?currency=CAD", {
    checkoutOption: option.type,
    paymentMethod: RESERVE,
    source: "DIRECT_REQUEST",
    directBooking,
    // The site sends its own confirmation email and voucher.
    sendNotificationToMainContact: false,
  })) as { booking?: { confirmationCode?: string } } | null;
  const code = submitted?.booking?.confirmationCode?.trim();
  if (!code) throw new Error("Bókun accepted the reservation but returned no confirmation code.");
  return code;
}

/** Confirms a reserved booking once we have the payment. */
export async function confirmInBokun(client: BokunApi, code: string, reference: string, payment: BokunPayment) {
  await client.fetch("POST", `/checkout.json/confirm-reserved/${encodeURIComponent(code)}`, {
    externalBookingReference: reference,
    amount: payment.amount,
    currency: payment.currency,
    sendNotificationToMainContact: false,
    showPricesInNotification: false,
    transactionDetails: { transactionDate: new Date().toISOString(), transactionId: payment.transactionId ?? reference },
  });
}

/** Releases a reservation that was never paid. */
export async function abortInBokun(client: BokunApi, code: string) {
  await client.fetch("POST", `/booking.json/${encodeURIComponent(code)}/abort-reserved`, {});
}

/** Cancels a confirmed booking in Bókun; the refund is handled by our payment provider. */
export async function cancelInBokun(client: BokunApi, code: string, note = "Cancelled on vistachase.com") {
  await client.fetch("POST", `/booking.json/cancel-booking/${encodeURIComponent(code)}`, { note, notify: false, refund: false });
}
