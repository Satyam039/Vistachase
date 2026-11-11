"use client";

/**
 * Tour and shuttle checkout, scaffolded from the Astryx `checkout-wizard` template.
 *
 * Two columns capped at 1000px: the form column carries the Stepper, the current
 * step and the actions; the booking summary sits beside it as a sticky Card so the
 * total and the seat-hold countdown are visible at every step. Below 900px of
 * available width the summary collapses into a card above the form.
 *
 * Steps (the template's limit is four):
 *   1. Party           adults / children / infants, capped by live seat availability
 *   2. Contact         lead guest; continuing places the 10-minute seat hold, because
 *                      the hold API needs a name and email
 *   3. Pickup & extras hotel pickup, custom address, special requests
 *   4. Review & pay    the booking request; the server prices it and, with Stripe, the guest
 *                      pays in Stripe's Payment Element (card details never touch this page)
 *
 * Every figure in the summary is derived from the same state the form writes, so the
 * total updates as the guest changes the party or promo code.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Image from "next/image";
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Divider } from "@astryxdesign/core/Divider";
import { FieldStatus } from "@astryxdesign/core/FieldStatus";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Icon } from "@astryxdesign/core/Icon";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { HStack, Stack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Step, Stepper } from "@astryxdesign/core/Stepper";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { QuantityInput } from "@/components/forms/QuantityInput";
import {
  AIRPORT_TRANSFER_PRICE_NOTE,
  AirportTransferDetails,
  AirportTransferToggle,
  airportTransferError,
  airportTransferPrice,
  EMPTY_AIRPORT_TRANSFER,
  type AirportTransferValue,
} from "@/components/booking/AirportTransferFields";
import { ActivityAddOnFields, ActivityAddOnToggle } from "@/components/booking/ActivityAddOnFields";
import { ACTIVITY_ADD_ONS, activityAddOnsFor, activityAddOnsRequestLine, activityGuestsFor, type ActivityAddOnId, type ActivityGuests } from "@/lib/activityAddOns";
import { Dropdown } from "@/components/forms/Dropdown";
import { PhoneField } from "@/components/forms/PhoneField";
import { dialCode } from "@/lib/countries";
import { balanceDueDate, cancellationShort, DEPOSIT_PERCENT, depositAvailable, depositFor, depositPolicy, formatRockiesDate, SEATS_MESSAGE } from "@/lib/policy";
import { StripeCheckoutForm, stripeConfigured } from "@/components/booking/StripeCheckoutForm";
import {
  CreditCard,
  Lock,
  Mail,
  MapPin,
  QrCode,
  Timer,
  UserRound,
  Users,
} from "lucide-react";

export interface DepartureData {
  id: string;
  date: string;
  departureTime: string;
  returnTime: string | null;
  capacityTotal: number;
  capacityBooked: number;
  capacityHeld: number;
  seatsAvailable: number;
  /** False when the server won't take a booking for it; the reason is shown instead. */
  bookable?: boolean;
  notBookableReason?: string | null;
  price: number;
  /** Per youth (6–15) when it differs from the adult price. */
  childPrice?: number | null;
  /** Per infant (0–5). Set: infants pay it and take a seat. Null: they ride free on a lap. */
  infantPrice?: number | null;
  currency: string;
  tour?: {
    id: string;
    title: string;
    slug: string;
    durationHours: number;
    featuredImage: string;
    /** PRIVATE tours are sold per vehicle (see backend departure-pricing.ts). */
    category?: string;
    maxGroupSize?: number;
  } | null;
  shuttleRoute?: {
    id: string;
    name: string;
    slug: string;
    origin: string;
    destination: string;
  } | null;
}

export interface StopData {
  id: string;
  name: string;
  town: string;
  address: string;
  instructions: string;
}

interface ConfirmedBooking {
  bookingReference: string;
  voucherCode: string;
  totalAmount: number;
  currency: string;
  qrCodeUrl: string | null;
  status: string;
  /** Signed voucher link and its token (the booking API needs the token to read the booking). */
  voucherUrl: string;
  voucherToken: string;
  paymentPlan?: "FULL" | "DEPOSIT";
  depositAmount?: number;
  balanceDue?: number;
  balanceDueAt?: string | null;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Party", icon: Users },
  { label: "Contact", icon: UserRound },
  { label: "Pickup", icon: MapPin },
  { label: "Payment", icon: CreditCard },
];

const HOLD_SECONDS = 600;
// Warn this long before a hold ends and offer to renew it (WCAG 2.2.1 asks for at least 20s).
const HOLD_WARNING_SECONDS = 120;
const NARROW_HOST_WIDTH = 900;
const MAX_INFANTS = 4;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ── Styles ────────────────────────────────────────────────────────────────────

// The summary column holds its width while the form takes the rest, and sticks as
// the form scrolls. The site's AppShell header is sticky too, so the offset adds its
// measured height (AppShell publishes it as --_app-shell-header-height; read-only use).
const summaryColumn: CSSProperties = {
  width: 360,
  flexShrink: 0,
  position: "sticky",
  top: "calc(var(--vc-header-h, 80px) + 16px)",
  alignSelf: "flex-start",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const money = (n: number) => `CAD $${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

const blockedMessage = (count: number) =>
  count === 1
    ? "One problem above needs fixing first."
    : `${count} problems above need fixing first.`;

function formatDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function partyLabel(adults: number, children: number, infants: number) {
  const parts = [`${adults} ${adults === 1 ? "adult" : "adults"}`];
  if (children > 0)
    parts.push(`${children} youth`);
  if (infants > 0)
    parts.push(`${infants} ${infants === 1 ? "infant" : "infants"}`);
  return parts.join(", ");
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <HStack hAlign="between" vAlign="start" gap={3}>
      <Text type="body" color="secondary">
        {label}
      </Text>
      <Text type="body" justify="end">
        {value}
      </Text>
    </HStack>
  );
}

export function BookingCheckoutClient({
  departure,
  stops,
  initialHoldToken,
  initialPickupStopId,
  initialGuests,
  initialAdults,
  initialChildren,
  initialInfants,
  initialActivities = false,
  initialActivityGuests,
}: {
  departure: DepartureData;
  stops: StopData[];
  initialHoldToken?: string;
  /** Pickup stop the guest chose with the AI concierge (?pickupStopId=). */
  initialPickupStopId?: string;
  /** Party size chosen on the tour page (?guests=); a concierge hold overrides it. */
  initialGuests?: number;
  /** Adults and children chosen on the tour page (?adults=&children=); take precedence over ?guests=. */
  initialAdults?: number;
  initialChildren?: number;
  /** Infants chosen on the tour page (?infants=). */
  initialInfants?: number;
  /** "Add-on activities" ticked on a private tour's page (?activities=1). */
  initialActivities?: boolean;
  /** Who joins the add-on activities, chosen on the tour page (?actAdults=&actChildren=&actInfants=). */
  initialActivityGuests?: ActivityGuests | null;
}) {
  // The responsive variant changes rendered order, so measure the host rather than the viewport.
  const hostRef = useRef<HTMLElement | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const attachHost = useCallback((element: HTMLElement | null) => {
    hostRef.current = element;
    if (element && element.clientWidth > 0) {
      setIsNarrow(element.clientWidth <= NARROW_HOST_WIDTH);
    }
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? host.clientWidth;
      if (width > 0) setIsNarrow(width <= NARROW_HOST_WIDTH);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const [step, setStep] = useState(0);
  const [attempted, setAttempted] = useState<ReadonlySet<number>>(new Set());

  // Party
  const [adults, setAdults] = useState(
    Math.max(1, Math.min(initialAdults ?? initialGuests ?? 2, departure.seatsAvailable)),
  );
  const [children, setChildren] = useState(() =>
    initialAdults ? Math.max(0, Math.min(initialChildren ?? 0, departure.seatsAvailable - Math.min(initialAdults, departure.seatsAvailable))) : 0,
  );
  const [infants, setInfants] = useState(() => Math.max(0, Math.min(initialInfants ?? 0, MAX_INFANTS)));
  // Airport transfer (private tours only): no price yet, so it doesn't change the total.
  // Single private days don't offer the airport transfer (owner's approved rules, 2026-11-10: two or
  // more tour days only), so this stays off; the package checkout has its own.
  const [airport, setAirport] = useState(false);
  const [airportTransfer, setAirportTransfer] = useState<AirportTransferValue>(EMPTY_AIRPORT_TRANSFER);
  // Activity add-ons on this tour's itinerary (summer only): requested now, priced by the team.
  const offeredAddOns = activityAddOnsFor(departure.tour?.slug, departure.date);
  const [activityAddOns, setActivityAddOns] = useState<ActivityAddOnId[]>([]);
  // Private tours: the "Add-on activities" tick box (owner, 2026-11-09). The team arranges the
  // tickets and collects payment separately, so it only adds a line to the special requests.
  const isPrivate = departure.tour?.category === "PRIVATE";
  const [wantsActivities, setWantsActivities] = useState(initialActivities && isPrivate);
  const chosenAddOns = activityAddOns.filter((id) => offeredAddOns.includes(id) && (!isPrivate || wantsActivities));
  // Who joins the activities, with ages (owner, 2026-11-11). Starts as the whole party, as adults.
  const [activityGuests, setActivityGuests] = useState<ActivityGuests>(() => initialActivityGuests ?? activityGuestsFor(adults));

  // Contact
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("CA");
  const [phoneLocal, setPhoneLocal] = useState("");
  // Stored and sent as one international number, e.g. "+1 403 555 0192".
  const customerPhone = phoneLocal.trim() ? `+${dialCode(phoneCountry)} ${phoneLocal.trim()}` : "";

  // Pickup & extras
  const [pickupStopId, setPickupStopId] = useState(
    (initialPickupStopId && stops.some((s) => s.id === initialPickupStopId) ? initialPickupStopId : stops[0]?.id) ?? "",
  );
  const [customPickup, setCustomPickup] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");

  // 10-minute seat hold
  const [holdToken, setHoldToken] = useState("");
  const [holdSeats, setHoldSeats] = useState(0);
  const [holdExpiresAt, setHoldExpiresAt] = useState(0);
  // Live availability from the server. It counts this guest's own active hold as taken
  // (and ignores expired holds), so the guest's capacity is live seats + their held seats.
  const [liveSeatsAvailable, setLiveSeatsAvailable] = useState(
    departure.seatsAvailable,
  );
  const [now, setNow] = useState(() => Date.now());
  const [isPlacingHold, setIsPlacingHold] = useState(false);
  const notBookable = departure.bookable === false;
  const notBookableNotice = {
    status: "error" as const,
    title: departure.notBookableReason || "This departure can't be booked online. Please send us an enquiry.",
  };
  const [holdNotice, setHoldNotice] = useState<{
    status: "warning" | "error";
    title: string;
  } | null>(notBookable ? notBookableNotice : null);

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  // One key per booking attempt: a retried submit (double-click, dropped connection) returns the
  // booking the server already made instead of a second one. Replaced once an attempt is over.
  const idempotencyKeyRef = useRef("");
  const newAttemptKey = () => {
    idempotencyKeyRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  };
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; percent: number; amount: number } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);

  const handleApplyPromo = async () => {
    setPromoError("");
    setIsApplyingPromo(true);
    try {
      const res = await fetch("/api/pricing/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departureId: departure.id, adultsCount: adults, childrenCount: children, infantsCount: infants, promoCode: promoCodeInput.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPromoError(data.error || "Invalid promo code");
        setAppliedPromo(null);
      } else {
        setAppliedPromo({ code: data.promoCode, percent: data.discountPercent, amount: data.discountAmount });
        setPromoCodeInput("");
      }
    } catch {
      setPromoError("Network error. Please try again.");
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const [confirmed, setConfirmed] = useState<ConfirmedBooking | null>(null);
  const [awaitingPayment, setAwaitingPayment] = useState<{ booking: ConfirmedBooking; clientSecret: string; amount: number } | null>(null);
  // Pay everything now, or the deposit now and the balance 14 days before departure.
  const [paymentPlan, setPaymentPlan] = useState<"FULL" | "DEPOSIT">("FULL");
  const [paymentState, setPaymentState] = useState<"pay" | "confirming" | "slow">("pay");

  // After Stripe accepts the card, wait for the server's confirmation (sent by Stripe's webhook).
  const waitForConfirmation = async (booking: ConfirmedBooking) => {
    setPaymentState("confirming");
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const res = await fetch(`/api/bookings?ref=${encodeURIComponent(booking.bookingReference)}&t=${booking.voucherToken}`).catch(() => null);
      const data = res?.ok ? await res.json().catch(() => null) : null;
      const status = data?.booking?.status as string | undefined;
      if (status === "CONFIRMED" || status === "PAID_UNSYNCED") {
        setAwaitingPayment(null);
        setConfirmed({ ...booking, ...data.booking, status, voucherUrl: booking.voucherUrl, voucherToken: booking.voucherToken, qrCodeUrl: data.booking.qrCodeUrl ?? booking.qrCodeUrl });
        return;
      }
      if (status === "CANCELLED" || status === "EXPIRED") {
        idempotencyKeyRef.current = "";
        setAwaitingPayment(null);
        setSubmitError("The payment didn't complete, so the booking was released. Please try again.");
        return;
      }
    }
    setPaymentState("slow");
  };

  // Private tours sell the whole vehicle: one price, every seat, guests up to the vehicle size.
  const isVehicle = departure.tour?.category === "PRIVATE";
  // Same rule as the server: where the departure has an infant price, infants pay it and take a seat.
  const infantsPay = !isVehicle && departure.infantPrice != null;
  const seatedInfants = infantsPay ? infants : 0;
  const totalSeats = adults + children + seatedInfants;
  const vehicleIsFree =
    Boolean(holdToken) || liveSeatsAvailable >= departure.capacityTotal;
  const seatCapacity = isVehicle
    ? vehicleIsFree
      ? departure.capacityTotal
      : 0
    : liveSeatsAvailable + (holdToken ? holdSeats : 0);
  const remainingSeconds = holdToken
    ? Math.max(0, Math.round((holdExpiresAt - now) / 1000))
    : 0;

  // ── Hold lifecycle ─────────────────────────────────────────────────────────

  const clearHold = useCallback(() => {
    setHoldToken("");
    setHoldSeats(0);
    setHoldExpiresAt(0);
  }, []);

  const refreshAvailability = useCallback(async (): Promise<number | null> => {
    try {
      const res = await fetch(
        `/api/departures/checkout?departureId=${encodeURIComponent(departure.id)}`,
      );
      const data = await res.json();
      if (res.ok && typeof data.departure?.seatsAvailable === "number") {
        const seats = data.departure.seatsAvailable;
        setLiveSeatsAvailable(seats);
        return seats;
      }
    } catch {
      // Keep the last known figure; the hold and booking APIs re-check capacity anyway.
    }
    return null;
  }, [departure.id]);

  useEffect(() => {
    void refreshAvailability();
  }, [refreshAvailability]);

  const releaseHold = useCallback(
    async (token: string, seats: number) => {
      // Optimistic: the released seats are free again until the server confirms.
      setLiveSeatsAvailable((current) => current + seats);
      clearHold();
      try {
        await fetch(
          `/api/reservations/hold?token=${encodeURIComponent(token)}`,
          { method: "DELETE" },
        );
      } catch {
        // The hold expires on its own after 10 minutes if the release fails.
      }
      await refreshAvailability();
    },
    [clearHold, refreshAvailability],
  );

  // A hold handed over by the AI concierge: adopt its seats and remaining time.
  useEffect(() => {
    if (!initialHoldToken) return;
    let isCancelled = false;
    fetch(
      `/api/reservations/hold?token=${encodeURIComponent(initialHoldToken)}`,
    )
      .then((res) => res.json())
      .then((data) => {
        if (isCancelled) return;
        if (data.active && data.hold) {
          setHoldToken(data.hold.holdToken);
          setHoldSeats(data.hold.seatsCount);
          setHoldExpiresAt(Date.parse(data.hold.expiresAt));
          // Name and email the guest gave the concierge (still editable).
          if (data.hold.customerName) setCustomerName((v) => v || data.hold.customerName);
          if (data.hold.customerEmail) setCustomerEmail((v) => v || data.hold.customerEmail);
          // A seat hold fixes the party size; a vehicle hold covers any party that fits.
          if (!data.hold.isVehicle) {
            setAdults(Math.max(1, data.hold.seatsCount));
            setChildren(0);
          }
        } else {
          setHoldNotice({
            status: "warning",
            title:
              "Your concierge seat hold has expired. Seats are held again when you continue past Contact.",
          });
        }
      })
      .catch(() => undefined);
    return () => {
      isCancelled = true;
    };
  }, [initialHoldToken]);

  // Tick the countdown and drop the hold when it runs out.
  useEffect(() => {
    if (!holdToken) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [holdToken]);

  useEffect(() => {
    if (holdToken && holdExpiresAt > 0 && now >= holdExpiresAt) {
      clearHold();
      setHoldNotice({
        status: "warning",
        title:
          "Your 10-minute seat hold expired. You can still book while seats remain.",
      });
      void refreshAvailability();
    }
  }, [now, holdToken, holdExpiresAt, clearHold, refreshAvailability]);

  // A seat hold covers a fixed seat count; changing the party releases it so a new one matches.
  // A vehicle hold already covers every seat, so the party can change freely.
  useEffect(() => {
    if (holdToken && !isVehicle && holdSeats !== totalSeats) {
      void releaseHold(holdToken, holdSeats);
    }
  }, [holdToken, isVehicle, holdSeats, totalSeats, releaseHold]);

  // Airport transfer is only available for bookings with 2 or more guests.
  useEffect(() => {
    if (totalSeats < 2 && airport) {
      setAirport(false);
    }
  }, [totalSeats, airport]);

  const placeHold = async () => {
    setIsPlacingHold(true);
    setHoldNotice(null);
    try {
      const res = await fetch("/api/reservations/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departureId: departure.id,
          seatsCount: totalSeats,
          customerName,
          customerEmail,
          customerPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setHoldNotice({
          status: "error",
          title: data.error || "We couldn't hold these seats.",
        });
        return false;
      }
      // Optimistic: the server now counts these seats as held, then refresh confirms it.
      const seatsHeld: number = data.seatsHeld ?? totalSeats;
      setLiveSeatsAvailable((current) => current - seatsHeld);
      setHoldToken(data.holdToken);
      setHoldSeats(seatsHeld);
      setHoldExpiresAt(
        Date.parse(data.expiresAt) ||
          Date.now() + (data.remainingSeconds ?? HOLD_SECONDS) * 1000,
      );
      setNow(Date.now());
      await refreshAvailability();
      return true;
    } catch {
      setHoldNotice({
        status: "error",
        title: "Network error while holding your seats. Please try again.",
      });
      return false;
    } finally {
      setIsPlacingHold(false);
    }
  };

  /** Renew the hold for another full period: release the current one, then hold again. */
  const extendHold = async () => {
    if (!holdToken) return;
    await releaseHold(holdToken, holdSeats);
    await placeHold();
  };

  // ── Derived totals ─────────────────────────────────────────────────────────

  // Same rule as the server: youth pay the youth price when the departure has one, infants the
  // infant price when it has one (free otherwise).
  const childPrice = departure.childPrice ?? departure.price;
  const infantPrice = departure.infantPrice ?? 0;
  const hasChildPrice = !isVehicle && children > 0 && childPrice !== departure.price;
  const hasInfantFare = infantsPay && infants > 0;
  const fareSubtotal = isVehicle
    ? departure.price
    : departure.price * adults + childPrice * children + infantPrice * seatedInfants;
  const fareLabel = [
    `${adults} × ${money(departure.price)}${hasChildPrice || hasInfantFare ? " (adult)" : ""}`,
    children > 0 ? `${children} × ${money(childPrice)} (youth)` : null,
    hasInfantFare ? `${infants} × ${money(infantPrice)} (infant)` : null,
  ]
    .filter(Boolean)
    .join(" + ");
  // Same rounding as the server (whole cents). No sales tax is added.
  const discount = appliedPromo ? round2(fareSubtotal * (appliedPromo.percent / 100)) : 0;
  // Airport transfer (private tours): the doc's both-ways price, added after any promo discount.
  const transferPrice = airport ? airportTransferPrice(airportTransfer, adults + children + infants) : null;
  const total = round2(fareSubtotal - discount + (transferPrice ?? 0));
  const canDeposit = total > 0 && depositAvailable(departure.date, departure.departureTime);
  const plan = canDeposit ? paymentPlan : "FULL";
  const depositNow = depositFor(total);
  const dueNow = plan === "DEPOSIT" ? depositNow : total;
  const balanceDueLabel = formatRockiesDate(balanceDueDate(departure.date, departure.departureTime));

  const selectedStop = stops.find((stop) => stop.id === pickupStopId);
  const experienceTitle =
    departure.tour?.title ||
    departure.shuttleRoute?.name ||
    "Canadian Rockies tour";
  const experienceSubtitle = departure.shuttleRoute
    ? `${departure.shuttleRoute.origin} → ${departure.shuttleRoute.destination}`
    : "Guaranteed access to Lake Louise & Moraine Lake";

  // ── Validation ─────────────────────────────────────────────────────────────

  const errorsByStep = useMemo<Array<Record<string, string>>>(() => {
    const party: Record<string, string> = {};
    const isSoldOut = seatCapacity <= 0 || (liveSeatsAvailable <= 0 && !holdToken);
    if (isSoldOut) {
      party.seats = isVehicle
        ? "This private vehicle is already booked for this departure."
        : "Tickets Sold Out. This departure is fully booked.";
    } else if (totalSeats < 1) {
      party.seats = "Add at least one adult.";
    } else if (isVehicle && totalSeats > seatCapacity) {
      party.seats = `This private vehicle seats up to ${seatCapacity} guests.`;
    } else if (totalSeats > seatCapacity) {
      party.seats = `Only ${seatCapacity} ${seatCapacity === 1 ? "seat is" : "seats are"} left on this departure.`;
    }
    const airportError = airport && totalSeats >= 2 ? airportTransferError(airportTransfer) : null;
    if (airportError) party.airport = airportError;
    if (isPrivate && wantsActivities && activityGuests.adults + activityGuests.children + activityGuests.infants < 1) {
      party.activities = "Add at least one guest for the add-on activities.";
    } else if (isPrivate && wantsActivities && activityGuests.adults + activityGuests.children + activityGuests.infants > totalSeats) {
      party.activities = `The add-on activities can be for up to ${totalSeats} ${totalSeats === 1 ? "guest" : "guests"}, your party size.`;
    }

    const contact: Record<string, string> = {};
    if (!customerName.trim())
      contact.name = "Enter the lead guest's full name.";
    if (!EMAIL_PATTERN.test(customerEmail.trim()))
      contact.email = "Enter an email address for your boarding pass.";
    if (phoneLocal.replace(/\D/g, "").length < 6)
      contact.phone = "Enter a mobile number for pickup-day updates.";

    const pickup: Record<string, string> = {};
    if (!pickupStopId && !customPickup.trim())
      pickup.stop = "Choose a pickup hotel or enter where you're staying.";

    return [party, contact, pickup, {}];
  }, [
    totalSeats,
    seatCapacity,
    isVehicle,
    airport,
    airportTransfer,
    isPrivate,
    wantsActivities,
    activityGuests,
    customerName,
    customerEmail,
    phoneLocal,
    pickupStopId,
    customPickup,
  ]);

  const shownErrors = (index: number) =>
    attempted.has(index) ? errorsByStep[index] : {};
  const currentErrors = shownErrors(step);
  const isLastStep = step === STEPS.length - 1;

  // Move focus to the first invalid field once React has rendered the error state.
  const stepContentRef = useRef<HTMLElement | null>(null);
  const pendingFocusStepRef = useRef<number | null>(null);
  useEffect(() => {
    if (pendingFocusStepRef.current !== step) return;
    pendingFocusStepRef.current = null;
    const invalid = stepContentRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    const target = invalid?.matches(
      "input, button, select, textarea, [tabindex]",
    )
      ? invalid
      : invalid?.querySelector<HTMLElement>(
          "input:not(:disabled), button:not(:disabled), textarea:not(:disabled)",
        );
    target?.focus();
  }, [attempted, step]);

  const markAttempted = (indices: ReadonlyArray<number>) => {
    setAttempted((previous) => {
      const next = new Set(previous);
      indices.forEach((index) => next.add(index));
      return next;
    });
  };

  const completeBooking = async () => {
    setSubmitError("");
    setIsSubmitting(true);
    if (!idempotencyKeyRef.current) newAttemptKey();
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKeyRef.current },
        body: JSON.stringify({
          departureId: departure.id,
          holdToken: holdToken || undefined,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim(),
          customerCountry: phoneCountry,
          pickupStopId: pickupStopId || undefined,
          pickupCustomText: customPickup.trim() || undefined,
          adultsCount: adults,
          childrenCount: children,
          infantsCount: infants,
          specialRequests:
            [specialRequests.trim(), isPrivate && wantsActivities ? activityAddOnsRequestLine(chosenAddOns.map((id) => ACTIVITY_ADD_ONS[id]), activityGuests) : ""]
              .filter(Boolean)
              .join("\n") || undefined,
          airportTransfer: airport ? { ...airportTransfer, area: airportTransfer.area || undefined } : undefined,
          activityAddOns: chosenAddOns,
          activityGuests: isPrivate && wantsActivities ? activityGuests : undefined,
          promoCode: appliedPromo?.code,
          paymentPlan: plan,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // The server answered, so this attempt is over (rate limits aside); a corrected retry is a new attempt.
        if (res.status !== 429) idempotencyKeyRef.current = "";
        setSubmitError(data.error || "We couldn't complete this booking.");
        return;
      }
      clearHold();
      if (data.payment?.clientSecret) {
        // The guest pays in Stripe's form; the booking is confirmed when Stripe tells our server.
        setAwaitingPayment({ booking: data.booking, clientSecret: data.payment.clientSecret, amount: data.payment.amount });
      } else if (data.booking?.status === "CONFIRMED" || data.booking?.status === "PAID_UNSYNCED") {
        setConfirmed(data.booking);
      } else {
        // A retried attempt whose booking was released (payment failed or expired): start afresh.
        idempotencyKeyRef.current = "";
        setSubmitError("This booking was released before payment completed. Please try again.");
      }
    } catch {
      setSubmitError("We couldn't reach the booking server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const goNext = async () => {
    if (notBookable) {
      setHoldNotice(notBookableNotice);
      return;
    }
    // Early availability re-check before proceeding from Party to Customer Information
    if (step === 0) {
      const freshSeats = await refreshAvailability();
      const currentAvailable = freshSeats ?? liveSeatsAvailable;
      const currentCapacity = isVehicle
        ? (vehicleIsFree ? departure.capacityTotal : 0)
        : currentAvailable + (holdToken ? holdSeats : 0);
      if (currentCapacity <= 0) {
        markAttempted([0]);
        setHoldNotice({
          status: "error",
          title: "Tickets Sold Out · This departure is fully booked.",
        });
        return;
      }
      if (totalSeats > currentCapacity) {
        markAttempted([0]);
        setHoldNotice({
          status: "warning",
          title: `Only ${currentCapacity} seat${currentCapacity === 1 ? " is" : "s are"} left on this departure.`,
        });
        return;
      }
    }
    markAttempted([step]);
    if (Object.keys(errorsByStep[step]).length > 0) {
      pendingFocusStepRef.current = step;
      return;
    }
    // Leaving Contact is the first point with a name and email, so the seats are held here.
    if (step === 1 && !holdToken) {
      const isHeld = await placeHold();
      if (!isHeld) return;
    }
    if (isLastStep) {
      await completeBooking();
      return;
    }
    setStep((current) => current + 1);
  };

  const goTo = (index: number) => {
    if (index <= step) {
      setStep(index);
      return;
    }
    const checked: number[] = [];
    let firstInvalid: number | null = null;
    for (let candidate = step; candidate < index; candidate += 1) {
      checked.push(candidate);
      if (Object.keys(errorsByStep[candidate]).length > 0) {
        firstInvalid = candidate;
        break;
      }
    }
    markAttempted(checked);
    if (firstInvalid != null) {
      pendingFocusStepRef.current = firstInvalid;
      setStep(firstInvalid);
      return;
    }
    // Jumping past Contact still needs the hold; route through Continue on that step.
    if (step <= 1 && index > 1 && !holdToken) {
      setStep(1);
      return;
    }
    setStep(index);
  };

  const fieldError = (message?: string) =>
    message ? { type: "error" as const, message } : undefined;

  // ── Summary ────────────────────────────────────────────────────────────────

  // The banner is a live region (role="status"), so the ticking countdown is hidden from
  // assistive tech: screen readers get the expiry time once, then the 2-minute warning, instead
  // of an announcement every second. Near the end the hold can be renewed (WCAG 2.2.1).
  const holdEndsSoon =
    remainingSeconds > 0 && remainingSeconds <= HOLD_WARNING_SECONDS;
  const holdLabel = isVehicle
    ? "Vehicle held"
    : `${holdSeats} ${holdSeats === 1 ? "seat" : "seats"} held`;
  const holdUntil = holdExpiresAt
    ? new Date(holdExpiresAt).toLocaleTimeString("en-CA", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
  const holdStatus = holdToken ? (
    <Banner
      status="success"
      icon={<Icon icon={Timer} size="sm" />}
      title={
        <>
          {holdLabel}{" "}
          <span aria-hidden="true">· {formatCountdown(remainingSeconds)}</span>
          <span className="sr-only">until {holdUntil}</span>
        </>
      }
      description={
        holdEndsSoon
          ? "Less than 2 minutes left on your hold. Keep your seats for another 10 minutes, or complete your booking."
          : "Complete your booking before the timer ends to keep them."
      }
      endContent={
        holdEndsSoon ? (
          <Button
            label="Hold for 10 more minutes"
            size="sm"
            onClick={extendHold}
            isDisabled={isPlacingHold}
          />
        ) : undefined
      }
    />
  ) : (
    <Text type="supporting" color="secondary">
      {cancellationShort(departure.tour?.category ?? "SHUTTLE")} · Instant digital boarding pass
    </Text>
  );

  const summaryBody = (
    <VStack gap={4}>
      <HStack gap={3} vAlign="start">
        {departure.tour?.featuredImage && (
          <Thumbnail src={departure.tour.featuredImage} alt={experienceTitle} />
        )}
        <StackItem size="fill">
          <VStack gap={0.5}>
            <Text type="body" weight="semibold">
              {experienceTitle}
            </Text>
            <Text type="supporting" color="secondary">
              {experienceSubtitle}
            </Text>
          </VStack>
        </StackItem>
      </HStack>
      <VStack gap={2}>
        <SummaryRow label="Date" value={formatDate(departure.date)} />
        <SummaryRow label="Departs" value={departure.departureTime} />
        <SummaryRow
          label="Party"
          value={partyLabel(adults, children, infants)}
        />
        {(selectedStop || customPickup.trim()) && (
          <SummaryRow
            label="Pickup"
            value={customPickup.trim() || selectedStop?.name || ""}
          />
        )}
        {airport && transferPrice == null && <SummaryRow label="Airport transfer" value={AIRPORT_TRANSFER_PRICE_NOTE} />}
        {chosenAddOns.length > 0 && (
          <SummaryRow label={chosenAddOns.map((id) => ACTIVITY_ADD_ONS[id]).join(", ")} value="Price confirmed by our team" />
        )}
        {isPrivate && wantsActivities && chosenAddOns.length === 0 && <SummaryRow label="Add-on activities" value="Paid separately once confirmed" />}
      </VStack>
      <Divider />
      <VStack gap={2}>
        <SummaryRow
          label={
            isVehicle
              ? `Private vehicle · up to ${departure.capacityTotal} guests`
              : hasChildPrice || hasInfantFare
                ? `Fare · ${fareLabel}`
                : `Fare · ${totalSeats} × ${money(departure.price)}`
          }
          value={money(fareSubtotal)}
        />
        {appliedPromo && discount > 0 && (
          <SummaryRow label={`Promo ${appliedPromo.code} (−${appliedPromo.percent}%)`} value={`−${money(discount)}`} />
        )}
        {transferPrice != null && <SummaryRow label="Airport transfer" value={money(transferPrice)} />}
        <Divider />
        <HStack hAlign="between" vAlign="center">
          <Text type="large" weight="bold">
            Total
          </Text>
          <Text type="large" weight="bold">
            {money(total)}
          </Text>
        </HStack>
        {plan === "DEPOSIT" && (
          <>
            <SummaryRow label={`Due today (${DEPOSIT_PERCENT}% deposit)`} value={money(depositNow)} />
            <SummaryRow label={`Balance, due by ${balanceDueLabel}`} value={money(round2(total - depositNow))} />
          </>
        )}
      </VStack>
      {!confirmed && holdStatus}
      <div className="mt-4 rounded-2xl bg-obsidian-50 p-4 border border-obsidian-900/10 text-xs">
        <p className="font-semibold uppercase tracking-wider text-slate-500">Booking inquiries & support</p>
        <p className="mt-1 text-sm text-obsidian-900">
          Email: <a href="mailto:support@vistachase.com" className="text-ocean-700 underline font-medium">support@vistachase.com</a>
        </p>
        <p className="mt-0.5 text-sm text-slate-600">
          Phone: <a href="tel:+18257349456" className="text-slate-800 hover:underline">+1 (825) 734-9456</a>
        </p>
      </div>
    </VStack>
  );

  // Beside the form it is open and titled; stacked above it, the title row becomes
  // the Collapsible trigger and carries the total.
  const summaryCard = (
    <div
      className={`rounded-none bg-white p-5 ring-1 ring-obsidian-900/[0.07] sm:p-6`}
    >
      {isNarrow ? (
        <Collapsible
          trigger={`Booking summary · ${money(total)}`}
          defaultIsOpen={false}
        >
          <VStack paddingBlockStart={3}>{summaryBody}</VStack>
        </Collapsible>
      ) : (
        <VStack gap={4}>
          <HStack gap={2} vAlign="center" hAlign="between">
            <Text type="label">Booking summary</Text>
            <Badge
              variant="neutral"
              label={`${totalSeats} ${totalSeats === 1 ? "seat" : "seats"}`}
            />
          </HStack>
          {summaryBody}
        </VStack>
      )}
    </div>
  );

  // ── Form column ────────────────────────────────────────────────────────────

  const progress = (
    <Stepper
      activeStep={step}
      orientation="horizontal"
      onStepClick={goTo}
      label="Booking progress"
      density="balanced"
    >
      {STEPS.map(({ label, icon }, i) => {
        const hasError = Object.keys(shownErrors(i)).length > 0;
        return (
          <Step
            key={label}
            step={i}
            label={label}
            indicator={<Icon icon={hasError ? "error" : icon} size="sm" />}
            status={hasError ? "error" : undefined}
          />
        );
      })}
    </Stepper>
  );

  const continueLabel = isLastStep
    ? stripeConfigured
      ? `Continue to payment · ${money(dueNow)}`
      : `Complete booking · ${money(dueNow)}`
    : step === 1 && !holdToken
      ? "Hold my seats & continue"
      : "Continue";

  const actions = (
    <VStack gap={3} hAlign="start">
      {Object.keys(currentErrors).length > 0 && (
        <FieldStatus
          type="error"
          variant="detached"
          message={blockedMessage(Object.keys(currentErrors).length)}
        />
      )}
      <HStack gap={3} vAlign="center" width="100%">
        {step === 0 ? (
          <Button
            label="Back to tours"
            variant="secondary"
            href={departure.tour ? `/${departure.tour.slug}` : "/shuttles"}
          />
        ) : (
          <Button
            label="Back"
            variant="secondary"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          />
        )}
        <StackItem size="fill">
          <Button
            label={step === 0 && seatCapacity <= 0 ? "Tickets Sold Out" : continueLabel}
            variant="primary"
            width="100%"
            isLoading={isPlacingHold || isSubmitting}
            isDisabled={step === 0 && seatCapacity <= 0}
            onClick={goNext}
          />
        </StackItem>
      </HStack>
    </VStack>
  );

  const confirmation = confirmed && (
    <VStack gap={5}>
      <Banner
        status="success"
        title="Booking confirmed"
        description={`Your boarding pass is ready and a confirmation email is on its way to ${customerEmail.trim()}.`}
      />
      <Heading level={2}>You&apos;re heading to the Rockies!</Heading>
      <Card padding={5}>
        <VStack gap={4}>
          <HStack hAlign="between" vAlign="start" gap={4} wrap="wrap">
            <VStack gap={0.5}>
              <Text type="supporting" color="secondary">
                Booking reference
              </Text>
              <Text type="large" weight="bold">
                {confirmed.bookingReference}
              </Text>
            </VStack>
            <VStack gap={0.5}>
              <Text type="supporting" color="secondary">
                Voucher code
              </Text>
              <Text type="code">{confirmed.voucherCode}</Text>
            </VStack>
          </HStack>
          <Divider />
          <VStack gap={2}>
            <SummaryRow
              label="Date"
              value={`${formatDate(departure.date)} · ${departure.departureTime}`}
            />
            <SummaryRow
              label="Party"
              value={partyLabel(adults, children, infants)}
            />
            {selectedStop && (
              <SummaryRow
                label="Pickup"
                value={`${selectedStop.name} (${selectedStop.town})`}
              />
            )}
            {confirmed.paymentPlan === "DEPOSIT" ? (
              <>
                <SummaryRow label="Deposit paid" value={`${money(confirmed.depositAmount ?? 0)}`} />
                <SummaryRow
                  label={`Balance, due by ${confirmed.balanceDueAt ? formatRockiesDate(confirmed.balanceDueAt) : balanceDueLabel}`}
                  value={`${money(confirmed.balanceDue ?? round2(confirmed.totalAmount - (confirmed.depositAmount ?? 0)))}`}
                />
              </>
            ) : (
              <SummaryRow
                label="Total paid"
                value={`${money(confirmed.totalAmount)}`}
              />
            )}
          </VStack>
          {selectedStop && (
            <Text type="supporting" color="secondary">
              Meeting point: {selectedStop.instructions}
            </Text>
          )}
        </VStack>
      </Card>
      {confirmed.qrCodeUrl && (
        <VStack gap={2} hAlign="center">
          <Image
            src={confirmed.qrCodeUrl}
            alt="Boarding pass QR code"
            width={160}
            height={160}
            unoptimized
          />
          <Text type="supporting" color="secondary">
            Show this QR code or your voucher at boarding.
          </Text>
        </VStack>
      )}
      <HStack gap={3} wrap="wrap">
        <Button
          label="Open boarding pass"
          variant="primary"
          href={confirmed.voucherUrl.replace(/^https?:\/\/[^/]+/, "")}
          icon={<Icon icon={QrCode} size="sm" />}
        />
        <Button label="Back to home" variant="secondary" href="/" />
      </HStack>
    </VStack>
  );

  return (
    <div className="bg-obsidian-50">
      <Layout
        height="auto"
        padding={6}
        contentWidth={1000}
        content={
          <LayoutContent>
            <VStack ref={attachHost} gap={6}>
              <HStack gap={3} vAlign="center" wrap="wrap">
                <StackItem size="fill">
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-ocean-600">
                      {confirmed ? "Booking confirmed" : "Checkout"}
                    </p>
                    <h1 className="mt-2 text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl">
                      {experienceTitle}
                    </h1>
                    <p className="mt-1.5 text-base text-slate-600">
                      {formatDate(departure.date)} · Departs{" "}
                      {departure.departureTime}
                    </p>
                  </div>
                </StackItem>
                <HStack gap={1.5} vAlign="center">
                  <Icon icon={Lock} size="sm" color="secondary" />
                  <Text type="supporting" color="secondary">
                    Secure checkout
                  </Text>
                </HStack>
              </HStack>

              <Stack
                direction={isNarrow ? "vertical" : "horizontal"}
                gap={6}
                vAlign="start"
              >
                {isNarrow && <StackItem>{summaryCard}</StackItem>}

                <StackItem size="fill">
                  <div className="rounded-none bg-white p-5 ring-1 ring-obsidian-900/[0.07] sm:p-7">
                    <VStack gap={6}>
                      {confirmed ? confirmation : progress}

                      {!confirmed && holdNotice && (
                        <Banner
                          status={holdNotice.status}
                          title={holdNotice.title}
                        />
                      )}

                      {!confirmed && step === 0 && (
                        <VStack ref={stepContentRef} gap={5}>
                          <VStack gap={2} hAlign="start">
                            <Heading level={2}>Who&apos;s coming?</Heading>
                            <Text type="supporting" color="secondary">
                              {infantsPay
                                ? "Infants (0–5) take a seat and pay the infant fare."
                                : "Infants (0–5) ride free on a lap."}
                            </Text>
                            {seatCapacity <= 0 ? (
                              <div className="w-full rounded-xl border border-red-300 bg-red-50 p-3.5 text-sm font-medium text-red-800" role="alert">
                                ⚠️ Tickets Sold Out · This departure is fully booked.
                              </div>
                            ) : (
                              <div className="pt-0.5">
                                <Badge
                                  variant={
                                    isVehicle
                                      ? seatCapacity > 0
                                        ? "success"
                                        : "error"
                                      : seatCapacity > 4
                                        ? "success"
                                        : "warning"
                                  }
                                  label={
                                    isVehicle
                                      ? seatCapacity > 0
                                        ? `Whole vehicle · up to ${seatCapacity} guests`
                                        : "Vehicle already booked"
                                      : SEATS_MESSAGE
                                  }
                                />
                              </div>
                            )}
                          </VStack>
                          {/* Counters stack at every width: with their +/- buttons, three side by side
                          don't fit the form column beside the summary. */}
                          <FormLayout>
                            <QuantityInput
                              label="Adults"
                              description="Age 16–99"
                              value={adults}
                              onChange={setAdults}
                              min={1}
                              max={Math.max(1, seatCapacity - children - seatedInfants)}
                            />
                            <QuantityInput
                              label="Youth"
                              description="Age 6–15"
                              value={children}
                              onChange={setChildren}
                              min={0}
                              max={Math.max(0, seatCapacity - adults - seatedInfants)}
                            />
                            <QuantityInput
                              label="Infants"
                              description="Age 0–5"
                              value={infants}
                              onChange={setInfants}
                              min={0}
                              max={infantsPay ? Math.max(0, Math.min(MAX_INFANTS, seatCapacity - adults - children)) : MAX_INFANTS}
                            />
                          </FormLayout>
                          {currentErrors.seats && (
                            <FieldStatus
                              type="error"
                              variant="detached"
                              message={currentErrors.seats}
                            />
                          )}
                          {isPrivate ? (
                            <>
                              <ActivityAddOnToggle
                                checked={wantsActivities}
                                onChange={setWantsActivities}
                                guests={activityGuests}
                                onGuestsChange={setActivityGuests}
                                maxGuests={totalSeats}
                              />
                              {currentErrors.activities && <FieldStatus type="error" variant="detached" message={currentErrors.activities} />}
                              {wantsActivities && <ActivityAddOnFields offered={offeredAddOns} value={activityAddOns} onChange={setActivityAddOns} />}
                            </>
                          ) : (
                            <ActivityAddOnFields offered={offeredAddOns} value={activityAddOns} onChange={setActivityAddOns} />
                          )}
                        </VStack>
                      )}

                      {!confirmed && step === 1 && (
                        <VStack ref={stepContentRef} gap={5}>
                          <VStack gap={1}>
                            <Heading level={2}>Lead guest</Heading>
                            <Text type="supporting" color="secondary">
                              Continuing holds your seats for 10 minutes while
                              you finish.
                            </Text>
                          </VStack>
                          <FormLayout defaultOptionality="required">
                            <TextInput
                              label="Full name"
                              value={customerName}
                              onChange={setCustomerName}
                              autoComplete="name"
                              placeholder="Sarah Jenkins"
                              status={fieldError(currentErrors.name)}
                            />
                            <FormLayout
                              direction={isNarrow ? "vertical" : "horizontal"}
                              defaultOptionality="required"
                            >
                              <TextInput
                                label="Email"
                                type="email"
                                value={customerEmail}
                                onChange={setCustomerEmail}
                                autoComplete="email"
                                startIcon={Mail}
                                placeholder="you@example.com"
                                status={fieldError(currentErrors.email)}
                              />
                              <PhoneField
                                label="Mobile phone"
                                country={phoneCountry}
                                onCountryChange={setPhoneCountry}
                                value={phoneLocal}
                                onChange={setPhoneLocal}
                                error={currentErrors.phone}
                              />
                            </FormLayout>
                          </FormLayout>
                        </VStack>
                      )}

                      {!confirmed && step === 2 && (
                        <VStack ref={stepContentRef} gap={5}>
                          <VStack gap={1}>
                            <Heading level={2}>Pickup & extras</Heading>
                            <Text type="supporting" color="secondary">
                              Complimentary door-to-door pickup across Banff,
                              Canmore and Lake Louise.
                            </Text>
                          </VStack>
                          <FormLayout defaultOptionality="required">
                            <div>
                              <Dropdown
                                label="Pickup hotel"
                                labelClassName="mb-1.5 block text-sm text-obsidian-900"
                                options={stops.map((stop) => ({
                                  value: stop.id,
                                  label: stop.name,
                                  description: `${stop.town} · ${stop.address}`,
                                }))}
                                value={pickupStopId}
                                onChange={setPickupStopId}
                                searchable
                                searchPlaceholder="Search hotels"
                                placeholder="Choose your hotel"
                                invalid={Boolean(currentErrors.stop)}
                                describedBy={currentErrors.stop ? "pickup-stop-error" : undefined}
                              />
                              {currentErrors.stop && (
                                <p id="pickup-stop-error" role="alert" className="mt-1.5 text-sm text-red-700">
                                  {currentErrors.stop}
                                </p>
                              )}
                            </div>
                            {selectedStop && (
                              <Banner
                                status="info"
                                title="Meeting point"
                                description={selectedStop.instructions}
                              />
                            )}
                            <TextInput
                              label="Staying somewhere else?"
                              isOptional
                              value={customPickup}
                              onChange={setCustomPickup}
                              placeholder="Airbnb address or room number"
                            />
                            <TextArea
                              label="Special requests"
                              isOptional
                              rows={3}
                              maxLength={500}
                              value={specialRequests}
                              onChange={setSpecialRequests}
                              placeholder="Anniversary trip, window seat, dietary needs…"
                            />
                          </FormLayout>
                        </VStack>
                      )}

                      {!confirmed && step === 3 && (
                        <VStack ref={stepContentRef} gap={5}>
                          <VStack gap={1}>
                            <Heading level={2}>Review & pay</Heading>
                            <Text type="supporting" color="secondary">
                              Check the summary, then complete your booking.
                            </Text>
                          </VStack>
                          <Card padding={4}>
                            <VStack gap={2}>
                              <SummaryRow
                                label="Lead guest"
                                value={customerName.trim()}
                              />
                              <SummaryRow
                                label="Email"
                                value={customerEmail.trim()}
                              />
                              <SummaryRow
                                label="Phone"
                                value={customerPhone.trim()}
                              />
                              <SummaryRow
                                label="Pickup"
                                value={
                                  customPickup.trim() ||
                                  (selectedStop
                                    ? `${selectedStop.name} (${selectedStop.town})`
                                    : "")
                                }
                              />
                            </VStack>
                          </Card>
                          {/* No card details are collected on this page. A real integration mounts the payment
                          provider's PCI-compliant fields here instead of raw inputs. */}
                          <Card padding={4}>
                            <VStack gap={3}>
                              <HStack vAlign="end" gap={2}>
                                <StackItem size="fill">
                                  <TextInput
                                    label="Promo code"
                                    isOptional
                                    value={promoCodeInput}
                                    onChange={setPromoCodeInput}
                                    placeholder="Enter code"
                                    isDisabled={isApplyingPromo}
                                  />
                                </StackItem>
                                <Button
                                  variant="secondary"
                                  label={isApplyingPromo ? "Applying..." : "Apply"}
                                  onClick={handleApplyPromo}
                                  isDisabled={!promoCodeInput.trim() || isApplyingPromo}
                                />
                              </HStack>
                              {promoError && <p className="text-sm text-red-600">{promoError}</p>}
                              {appliedPromo && (
                                <HStack hAlign="between" className="text-sm text-ocean-600 font-medium">
                                  <span>Applied: {appliedPromo.code} (-{appliedPromo.percent}%)</span>
                                  <button onClick={() => setAppliedPromo(null)} className="underline hover:text-ocean-700">Remove</button>
                                </HStack>
                              )}
                            </VStack>
                          </Card>

                          {canDeposit && !awaitingPayment && (
                            <fieldset className="rounded-none bg-white p-4 ring-1 ring-obsidian-900/[0.07]">
                              <legend className="px-1 text-sm font-semibold text-obsidian-900">How would you like to pay?</legend>
                              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                                {(
                                  [
                                    { value: "FULL", title: `Pay in full · ${money(total)}`, detail: "Nothing more to pay before your trip." },
                                    {
                                      value: "DEPOSIT",
                                      title: `Pay ${DEPOSIT_PERCENT}% now · ${money(depositNow)}`,
                                      detail: `The rest, ${money(round2(total - depositNow))}, is due by ${balanceDueLabel}. We'll email you a reminder and you pay it from your voucher.`,
                                    },
                                  ] as const
                                ).map((option) => (
                                  <label
                                    key={option.value}
                                    className={`flex cursor-pointer gap-3 rounded-xl p-3 ring-1 transition-colors ${
                                      plan === option.value ? "bg-ocean-50 ring-ocean-600" : "ring-obsidian-900/[0.12] hover:bg-obsidian-50"
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name="payment-plan"
                                      value={option.value}
                                      checked={plan === option.value}
                                      onChange={() => setPaymentPlan(option.value)}
                                      className="mt-1 h-4 w-4 accent-ocean-700"
                                    />
                                    <span className="flex flex-col gap-1">
                                      <span className="text-sm font-semibold text-obsidian-900">{option.title}</span>
                                      <span className="text-sm text-slate-600">{option.detail}</span>
                                    </span>
                                  </label>
                                ))}
                              </div>
                              {plan === "DEPOSIT" && <p className="mt-3 text-sm text-slate-600">{depositPolicy(departure.tour?.category ?? "SHUTTLE")}</p>}
                            </fieldset>
                          )}

                          {awaitingPayment ? (
                            <Card padding={4}>
                              {paymentState === "pay" ? (
                                <VStack gap={3}>
                                  <Text weight="bold">Pay by card</Text>
                                  <StripeCheckoutForm
                                    clientSecret={awaitingPayment.clientSecret}
                                    amountLabel={`${money(awaitingPayment.amount)}`}
                                    onPaid={() => waitForConfirmation(awaitingPayment.booking)}
                                  />
                                </VStack>
                              ) : paymentState === "confirming" ? (
                                <Banner status="info" title="Confirming your payment…" description="This usually takes a few seconds. Please keep this page open." />
                              ) : (
                                <Banner
                                  status="info"
                                  title="Payment received"
                                  description={`Your confirmation is taking longer than usual. It will reach ${customerEmail.trim()} shortly; your booking reference is ${awaitingPayment.booking.bookingReference}.`}
                                />
                              )}
                            </Card>
                          ) : stripeConfigured ? (
                            <Banner
                              status="info"
                              icon={<Icon icon={CreditCard} size="sm" />}
                              title="Secure card payment"
                              description="Continue to pay by card. Card details go straight to our payment provider, Stripe; your booking is confirmed as soon as the payment goes through."
                            />
                          ) : (
                            <Banner
                              status="info"
                              icon={<Icon icon={CreditCard} size="sm" />}
                              title="Test mode"
                              description="Card payments aren't set up on this site, so no card is charged."
                            />
                          )}
                          {submitError && (
                            <Banner status="error" title={submitError} />
                          )}
                        </VStack>
                      )}

                      {!confirmed && !awaitingPayment && actions}
                    </VStack>
                  </div>
                </StackItem>

                {!isNarrow && (
                  <StackItem style={summaryColumn}>{summaryCard}</StackItem>
                )}
              </Stack>
            </VStack>
          </LayoutContent>
        }
      />
    </div>
  );
}
