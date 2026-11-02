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

import { BokunApiError } from "@/modules/bokun/bokun.client";
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
/** "2026-11-15" moved by whole days. */
export const shiftDay = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

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
export async function reserveInBokun(
  client: BokunApi,
  input: BokunReservationInput,
  beforeSubmit?: () => Promise<void>,
  opts: { testAccount?: boolean } = {},
): Promise<string> {
  let activityId = input.productBokunId;
  let list: Availability[] | null = null;
  let detail: { pricingCategories?: BokunCategory[] } | null = null;

  try {
    [list, detail] = await Promise.all([
      // One day either side: a same-day range (start = end) can come back empty from Bókun, and
      // Bókun's day stamps can sit a few hours off UTC midnight. findSlot keeps only the asked date.
      client.getAvailabilities(activityId, shiftDay(input.date, -1), shiftDay(input.date, 1)) as Promise<Availability[] | null>,
      client.fetch("GET", `/activity.json/${activityId}?lang=EN&currency=CAD`) as Promise<{ pricingCategories?: BokunCategory[] } | null>,
    ]);
  } catch (error) {
    if (opts.testAccount && error instanceof BokunApiError && error.status === 404) {
      activityId = "30159";
      [list, detail] = await Promise.all([
        client.getAvailabilities(activityId, shiftDay(input.date, -1), shiftDay(input.date, 1)) as Promise<Availability[] | null>,
        client.fetch("GET", `/activity.json/${activityId}?lang=EN&currency=CAD`) as Promise<{ pricingCategories?: BokunCategory[] } | null>,
      ]);
    } else {
      throw error;
    }
  }

  let slot = findSlot(Array.isArray(list) ? list : [], input.date, input.time);
  const needed = input.category === "PRIVATE" ? 1 : input.adults + input.children;

  if ((!slot || slot.unavailable) && opts.testAccount) {
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    const upcoming = (await client.getAvailabilities(activityId, today, end)) as Availability[] | null;
    const available = (Array.isArray(upcoming) ? upcoming : []).find(
      (a) => !a.unavailable && !a.soldOut && (a.availabilityCount ?? 0) >= needed,
    );
    if (available) {
      slot = available;
      console.warn(
        `[bokun] test account: no slot for ${input.date} ${input.time}, using available test slot on ${slotDate(slot)} ${slotTime(slot)} (test only).`,
      );
    }
  }
  if (!slot || slot.unavailable) {
    const all = Array.isArray(list) ? list : [];
    const sameDay = all.filter((a) => slotDate(a) === input.date && !a.unavailable).map(slotTime);
    const closed = all.filter((a) => slotDate(a) === input.date && a.unavailable).map(slotTime);
    const nearby = [...new Set(all.map((a) => `${slotDate(a)} ${slotTime(a)}`))].slice(0, 6);
    throw new BokunUnavailableError(
      [
        `Bókun product ${input.productBokunId} doesn't offer this departure (${input.date} ${input.time}).`,
        `Bókun has ${sameDay.length ? `only ${[...new Set(sameDay)].join(", ")}` : "no start times"} on that day`,
        closed.length ? `(closed: ${[...new Set(closed)].join(", ")})` : "",
        `; ${nearby.length ? `Bókun returned ${nearby.join(", ")} around it` : "Bókun returned no dates at all around it"}.`,
        ` Add a ${input.time} start time with seats on that date to product ${input.productBokunId} in Bókun.`,
      ].join(" ").replace(/ ;/, ";").replace(/\s+/g, " ").trim(),
    );
  }
  const seatsLeft = Math.max(0, slot.availabilityCount ?? 0);
  if (slot.soldOut || seatsLeft < needed) throw new BokunUnavailableError(`Bókun has ${seatsLeft} seat(s) left.`);

  const rateId = slot.defaultRateId ?? slot.rates?.[0]?.id;
  const { passengers, infantsInNote } = buildPassengers(input, (detail?.pricingCategories ?? []).map((c) => ({ id: c.id, title: c.title })));
  const bookingDate = slotDate(slot);
  const directBooking = {
    externalBookingReference: input.bookingReference,
    mainContactDetails: mainContact(input),
    activityBookings: [
      {
        activityId: Number(activityId),
        rateId,
        date: bookingDate,
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

/**
 * Confirms a reserved booking once we have the payment.
 *
 * `testAccount`: a Bókun test account (bokuntest.com) set up in another currency (e.g. INR) books
 * in that currency and refuses our CAD payment ("Payment currency must match the booking currency
 * INR"). Only then, and only on a test account, the confirmation is sent again in Bókun's currency
 * for Bókun's own total, so the test can finish. A live account never does this: a currency
 * mismatch there stops the booking for a person to look at.
 */
export async function confirmInBokun(client: BokunApi, code: string, reference: string, payment: BokunPayment, options: { testAccount?: boolean } = {}) {
  const confirm = (amount: number, currency: string) =>
    client.fetch("POST", `/checkout.json/confirm-reserved/${encodeURIComponent(code)}`, {
      externalBookingReference: reference,
      amount,
      currency,
      sendNotificationToMainContact: false,
      showPricesInNotification: false,
      transactionDetails: { transactionDate: new Date().toISOString(), transactionId: payment.transactionId ?? reference },
    });
  try {
    await confirm(payment.amount, payment.currency);
  } catch (error) {
    const bokunCurrency = options.testAccount ? currencyMismatch(error) : null;
    if (!bokunCurrency || bokunCurrency === payment.currency) throw error;
    console.warn(`[bokun] test account books in ${bokunCurrency}, not ${payment.currency}: confirming ${code} in ${bokunCurrency} (test only).`);
    await confirm(await bokunTotal(client, code, payment.amount), bokunCurrency);
  }
}

/** The booking currency Bókun asked for when it refused ours, if that was the refusal. */
export function currencyMismatch(error: unknown): string | null {
  if (!(error instanceof BokunApiError) || error.status !== 400) return null;
  return /currency must match the booking currency ([A-Z]{3})/i.exec(error.message)?.[1]?.toUpperCase() ?? null;
}

/** Bókun's total for a booking in its own currency (falls back to `fallback`). */
async function bokunTotal(client: BokunApi, code: string, fallback: number): Promise<number> {
  try {
    const b = (await client.fetch("GET", `/booking.json/booking/${encodeURIComponent(code)}`)) as Record<string, unknown> | null;
    for (const key of ["totalPrice", "totalDue", "priceWithDiscount", "totalPriceAmount"]) {
      const v = Number(b?.[key]);
      if (Number.isFinite(v) && v > 0) return v;
    }
  } catch {
    // Not readable: fall back to our amount.
  }
  return fallback;
}

/** Releases a reservation that was never paid. */
export async function abortInBokun(client: BokunApi, code: string) {
  await client.fetch("POST", `/booking.json/${encodeURIComponent(code)}/abort-reserved`, {});
}

/** Cancels a confirmed booking in Bókun; the refund is handled by our payment provider. */
export async function cancelInBokun(client: BokunApi, code: string, note = "Cancelled on vistachase.com") {
  await client.fetch("POST", `/booking.json/cancel-booking/${encodeURIComponent(code)}`, { note, notify: false, refund: false });
}
