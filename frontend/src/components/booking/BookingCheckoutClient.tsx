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
 *   3. Pickup & extras hotel pickup, custom address, add-ons, special requests
 *   4. Review & pay    the booking request; the server prices it and, with Stripe, the guest
 *                      pays in Stripe's Payment Element (card details never touch this page)
 *
 * Every figure in the summary is derived from the same state the form writes, so the
 * total updates as the guest changes the party or add-ons.
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
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
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
import { Dropdown } from "@/components/forms/Dropdown";
import { PhoneField } from "@/components/forms/PhoneField";
import { dialCode } from "@/lib/countries";
import { SEATS_MESSAGE } from "@/lib/policy";
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
  price: number;
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
}

// ── Data ──────────────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Party", icon: Users },
  { label: "Contact", icon: UserRound },
  { label: "Pickup", icon: MapPin },
  { label: "Payment", icon: CreditCard },
];

// `name` is what the booking API stores, so it stays identical to the previous checkout.
const ADD_ONS = [
  {
    id: "parkPass",
    name: "Parks Canada Discovery Pass Assistance",
    label: "Parks Canada pass assistance",
    description:
      "We prepare your park entry pass in advance so you skip the entrance lines.",
    price: 25,
    perGuest: false,
  },
  {
    id: "hotDrinks",
    name: "Hot Drink & Morning Pastry Package",
    label: "Hot drink & morning pastry",
    description:
      "Artisan croissants and French roast coffee at the Rockpile viewpoint.",
    price: 15,
    perGuest: true,
  },
  {
    id: "lunch",
    name: "Gourmet Rockies Packed Lunch",
    label: "Gourmet packed lunch",
    description:
      "Alpine deli baguette, local fruit, cookies and trail mix for your hike.",
    price: 22,
    perGuest: true,
  },
] as const;

type AddOnId = (typeof ADD_ONS)[number]["id"];

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

const money = (n: number) => `$${n.toFixed(2)}`;
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
    parts.push(`${children} ${children === 1 ? "child" : "children"}`);
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
  initialGuests,
}: {
  departure: DepartureData;
  stops: StopData[];
  initialHoldToken?: string;
  /** Party size chosen on the tour page (?guests=); a concierge hold overrides it. */
  initialGuests?: number;
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
    Math.max(1, Math.min(initialGuests ?? 2, departure.seatsAvailable)),
  );
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);

  // Contact
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("CA");
  const [phoneLocal, setPhoneLocal] = useState("");
  // Stored and sent as one international number, e.g. "+1 403 555 0192".
  const customerPhone = phoneLocal.trim() ? `+${dialCode(phoneCountry)} ${phoneLocal.trim()}` : "";

  // Pickup & extras
  const [pickupStopId, setPickupStopId] = useState(stops[0]?.id ?? "");
  const [customPickup, setCustomPickup] = useState("");
  const [addOns, setAddOns] = useState<Record<AddOnId, boolean>>({
    parkPass: false,
    hotDrinks: false,
    lunch: false,
  });
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
  const [holdNotice, setHoldNotice] = useState<{
    status: "warning" | "error";
    title: string;
  } | null>(null);

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
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
        body: JSON.stringify({ departureId: departure.id, adultsCount: adults, childrenCount: children, promoCode: promoCodeInput.trim() })
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
  const [awaitingPayment, setAwaitingPayment] = useState<{ booking: ConfirmedBooking; clientSecret: string } | null>(null);
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
        setConfirmed({ ...booking, status, qrCodeUrl: data.booking.qrCodeUrl ?? booking.qrCodeUrl });
        return;
      }
      if (status === "CANCELLED") {
        setAwaitingPayment(null);
        setSubmitError("The payment didn't complete, so the booking was released. Please try again.");
        return;
      }
    }
    setPaymentState("slow");
  };

  const totalSeats = adults + children;
  // Private tours sell the whole vehicle: one price, every seat, guests up to the vehicle size.
  const isVehicle = departure.tour?.category === "PRIVATE";
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

  const refreshAvailability = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/departures/checkout?departureId=${encodeURIComponent(departure.id)}`,
      );
      const data = await res.json();
      if (res.ok && typeof data.departure?.seatsAvailable === "number") {
        setLiveSeatsAvailable(data.departure.seatsAvailable);
      }
    } catch {
      // Keep the last known figure; the hold and booking APIs re-check capacity anyway.
    }
  }, [departure.id]);

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

  const selectedAddOns = ADD_ONS.filter((addOn) => addOns[addOn.id]).map(
    (addOn) => {
      const quantity = addOn.perGuest ? totalSeats : 1;
      return { ...addOn, quantity, total: addOn.price * quantity };
    },
  );
const fareSubtotal = isVehicle
    ? departure.price
    : departure.price * totalSeats;
  const addOnsTotal = selectedAddOns.reduce(
    (sum, addOn) => sum + addOn.total,
    0,
  );
  // Same rounding as the server (whole cents). No sales tax is added.
  const discount = appliedPromo ? round2(fareSubtotal * (appliedPromo.percent / 100)) : 0;
  const total = round2(fareSubtotal - discount + addOnsTotal);

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
    if (totalSeats < 1) {
      party.seats = "Add at least one adult.";
    } else if (isVehicle && seatCapacity === 0) {
      party.seats =
        "This private vehicle is already booked for this departure.";
    } else if (isVehicle && totalSeats > seatCapacity) {
      party.seats = `This private vehicle seats up to ${seatCapacity} guests.`;
    } else if (totalSeats > seatCapacity) {
      party.seats = `Only ${seatCapacity} ${seatCapacity === 1 ? "seat is" : "seats are"} left on this departure.`;
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
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departureId: departure.id,
          holdToken: holdToken || undefined,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim(),
          pickupStopId: pickupStopId || undefined,
          pickupCustomText: customPickup.trim() || undefined,
          adultsCount: adults,
          childrenCount: children,
          infantsCount: infants,
          specialRequests: specialRequests.trim() || undefined,
          // The server prices add-ons itself; only the choice is sent.
          addOns: selectedAddOns.map((addOn) => ({ id: addOn.id })),
          promoCode: appliedPromo?.code,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data.error || "We couldn't complete this booking.");
        return;
      }
      clearHold();
      if (data.payment?.clientSecret) {
        // The guest pays in Stripe's form; the booking is confirmed when Stripe tells our server.
        setAwaitingPayment({ booking: data.booking, clientSecret: data.payment.clientSecret });
      } else {
        setConfirmed(data.booking);
      }
    } catch {
      setSubmitError("We couldn't reach the booking server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const goNext = async () => {
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
      Free cancellation up to 72 hours before departure · Instant digital
      boarding pass
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
      </VStack>
      <Divider />
      <VStack gap={2}>
        <SummaryRow
          label={
            isVehicle
              ? `Private vehicle · up to ${departure.capacityTotal} guests`
              : `Fare · ${totalSeats} × ${money(departure.price)}`
          }
          value={money(fareSubtotal)}
        />
        {selectedAddOns.map((addOn) => (
          <SummaryRow
            key={addOn.id}
            label={
              addOn.perGuest
                ? `${addOn.label} × ${addOn.quantity}`
                : addOn.label
            }
            value={money(addOn.total)}
          />
        ))}
        {appliedPromo && discount > 0 && (
          <SummaryRow label={`Promo ${appliedPromo.code} (−${appliedPromo.percent}%)`} value={`−${money(discount)}`} />
        )}
        <Divider />
        <HStack hAlign="between" vAlign="center">
          <Text type="large" weight="bold">
            Total
          </Text>
          <Text type="large" weight="bold">
            {money(total)} {departure.currency}
          </Text>
        </HStack>
      </VStack>
      {!confirmed && holdStatus}
    </VStack>
  );

  // Beside the form it is open and titled; stacked above it, the title row becomes
  // the Collapsible trigger and carries the total.
  const summaryCard = (
    <div
      className={`rounded-[1.75rem] bg-white p-5 ring-1 ring-obsidian-900/[0.07] sm:p-6`}
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
      ? `Continue to payment · ${money(total)}`
      : `Complete booking · ${money(total)}`
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
            label={continueLabel}
            variant="primary"
            width="100%"
            isLoading={isPlacingHold || isSubmitting}
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
            <SummaryRow
              label="Total paid"
              value={`${money(confirmed.totalAmount)} ${confirmed.currency}`}
            />
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
                  <div className="rounded-[1.75rem] bg-white p-5 ring-1 ring-obsidian-900/[0.07] sm:p-7">
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
                          <HStack
                            gap={3}
                            vAlign="center"
                            hAlign="between"
                            wrap="wrap"
                          >
                            <VStack gap={1}>
                              <Heading level={2}>Who&apos;s coming?</Heading>
                              <Text type="supporting" color="secondary">
                                Infants (0–2) don&apos;t take a paid seat.
                              </Text>
                            </VStack>
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
                          </HStack>
                          {/* Counters stack at every width: with their +/- buttons, three side by side
                          don't fit the form column beside the summary. */}
                          <FormLayout>
                            <QuantityInput
                              label="Adults"
                              description="Age 12+"
                              value={adults}
                              onChange={setAdults}
                              min={1}
                              max={Math.max(1, seatCapacity - children)}
                            />
                            <QuantityInput
                              label="Children"
                              description="Age 3–11"
                              value={children}
                              onChange={setChildren}
                              min={0}
                              max={Math.max(0, seatCapacity - adults)}
                            />
                            <QuantityInput
                              label="Infants"
                              description="Age 0–2"
                              value={infants}
                              onChange={setInfants}
                              min={0}
                              max={MAX_INFANTS}
                            />
                          </FormLayout>
                          {currentErrors.seats && (
                            <FieldStatus
                              type="error"
                              variant="detached"
                              message={currentErrors.seats}
                            />
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
                                description="Your boarding pass and confirmation go here."
                                status={fieldError(currentErrors.email)}
                              />
                              <PhoneField
                                label="Mobile phone"
                                country={phoneCountry}
                                onCountryChange={setPhoneCountry}
                                value={phoneLocal}
                                onChange={setPhoneLocal}
                                description="For pickup-day SMS updates."
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
                            <Divider />
                            <VStack gap={3}>
                              <Text type="label">Add-ons</Text>
                              {ADD_ONS.map((addOn) => (
                                <CheckboxInput
                                  key={addOn.id}
                                  label={`${addOn.label} · ${money(addOn.price)}${addOn.perGuest ? " per guest" : ""}`}
                                  description={addOn.description}
                                  value={addOns[addOn.id]}
                                  onChange={(checked) =>
                                    setAddOns((current) => ({
                                      ...current,
                                      [addOn.id]: checked,
                                    }))
                                  }
                                />
                              ))}
                            </VStack>
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

                          {awaitingPayment ? (
                            <Card padding={4}>
                              {paymentState === "pay" ? (
                                <VStack gap={3}>
                                  <Text weight="bold">Pay by card</Text>
                                  <StripeCheckoutForm
                                    clientSecret={awaitingPayment.clientSecret}
                                    amountLabel={`${money(awaitingPayment.booking.totalAmount)} ${awaitingPayment.booking.currency}`}
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
