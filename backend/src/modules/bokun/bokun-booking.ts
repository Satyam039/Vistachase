// Website bookings → Bókun, with Bókun's two-step checkout for payments taken elsewhere (Stripe):
//
//   1. reserve   POST /checkout.json/options/booking-request, then POST /checkout.json/submit with
//                RESERVE_FOR_EXTERNAL_PAYMENT. Bókun holds the seats (up to 30 minutes) and returns a
//                confirmation code. Done when the guest starts paying.
//   2. confirm   POST /checkout.json/confirm-reserved/{code} with the amount paid, after Stripe
//                reports the payment.
//   or abort     POST /booking.json/{code}/abort-reserved when the payment fails or expires.
//   cancel       POST /booking.json/cancel-booking/{code} when a confirmed booking is cancelled
//                (the refund is made through Stripe, not Bókun).
//
// The slot (startTimeId, rateId) and the passenger categories are read from Bókun at reservation
// time, so a booking always uses Bókun's current IDs and seat count.

import type { BokunApiClient } from "@/modules/bokun/bokun.client";
import type { BokunAvailability, BokunCategory } from "@/modules/bokun/availability-sync";

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

type Availability = BokunAvailability & { startTimeId?: number };

const RESERVE = "RESERVE_FOR_EXTERNAL_PAYMENT";
const isChild = (title: string) => /child|youth|kid/i.test(title);
const isInfant = (title: string) => /infant|baby/i.test(title);
const groupSize = (title: string) => Number(/group of (\d+)/i.exec(title)?.[1] ?? NaN);

/** Bókun's start for our departure: same day and start time. */
export function findSlot(list: Availability[], date: string, time: string) {
  // Same reading of date and start time as the availability sync, which created the departure.
  return list.find((a) => new Date(a.date).toISOString().slice(0, 10) === date && (/^\d{2}:\d{2}$/.test(a.startTime ?? "") ? a.startTime : "00:00") === time);
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

/** Reserves the booking in Bókun for payment taken by us; returns Bókun's confirmation code. */
export async function reserveInBokun(client: BokunApiClient, input: BokunReservationInput): Promise<string> {
  const [list, detail] = await Promise.all([
    client.getAvailabilities(input.productBokunId, input.date, input.date) as Promise<Availability[] | null>,
    client.fetch("GET", `/activity.json/${input.productBokunId}?lang=EN&currency=CAD`) as Promise<{ pricingCategories?: BokunCategory[] } | null>,
  ]);
  const slot = findSlot(Array.isArray(list) ? list : [], input.date, input.time);
  if (!slot || slot.unavailable) throw new BokunUnavailableError("Bókun doesn't offer this departure.");
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
  if (!option) throw new Error("Bókun offers no reserve-for-external-payment checkout for this booking.");

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
export async function confirmInBokun(client: BokunApiClient, code: string, reference: string, payment: BokunPayment) {
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
export async function abortInBokun(client: BokunApiClient, code: string) {
  await client.fetch("POST", `/booking.json/${encodeURIComponent(code)}/abort-reserved`, {});
}

/** Cancels a confirmed booking in Bókun; the refund is handled by our payment provider. */
export async function cancelInBokun(client: BokunApiClient, code: string, note = "Cancelled on vistachase.com") {
  await client.fetch("POST", `/booking.json/cancel-booking/${encodeURIComponent(code)}`, { note, notify: false, refund: false });
}
