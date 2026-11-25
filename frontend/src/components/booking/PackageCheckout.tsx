"use client";

/**
 * Checkout for a package of day tours: the shared Two-Day Rockies Explorer and the private Two-, Three-
 * and Four-Day journeys (`vehicle`). One form, a calendar for each day where the guest picks that
 * day's date themselves (any dates, not necessarily in a row; owner 2026-11-06), one payment. The
 * server books each day, prices it with the package discount for its season and starts a single
 * Stripe payment for the sum (backend modules/bookings/package-booking.ts). The figures shown here
 * are an estimate made the same way; the server's total is what the guest pays.
 *
 * One column on phones; on wide screens the summary sits beside the form and stays in view.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { CalendarDays, Check, ChevronDown, Lock, Mail, MapPin, Plane, Tag, Ticket, Users, X } from "lucide-react";
import { QuantityInput } from "@/components/forms/QuantityInput";
import { DepartureCalendar } from "@/components/booking/DepartureCalendar";
import {
  AirportTransferDetails,
  AirportTransferToggle,
  airportTransferError,
  airportTransferPayload,
  airportTransferQuote,
  airportTransferSummaryLabel,
  EMPTY_AIRPORT_TRANSFER,
  useAirportTransferPrices,
  type AirportTransferValue,
} from "@/components/booking/AirportTransferFields";
import { ActivityAddOnToggle, PackageActivityPicker } from "@/components/booking/ActivityAddOnFields";
import {
  activityAddOnsRequestLine,
  activityGuestCount,
  activityGuestsFor,
  activityGuestsLabel,
  loadPackageActivityPrices,
  PACKAGE_ACTIVITIES,
  packageActivityPrice,
  type PackageActivityPrices,
  type ActivityGuests,
  type PackageActivityChoice,
} from "@/lib/activityAddOns";
import { Dropdown } from "@/components/forms/Dropdown";
import { PhoneField } from "@/components/forms/PhoneField";
import { dialCode } from "@/lib/countries";
import { StripeCheckoutForm, stripeConfigured } from "@/components/booking/StripeCheckoutForm";
import { balanceDueDate, DEPOSIT_PERCENT, depositAvailable, depositFor, formatCancellationDeadline, formatRockiesDate } from "@/lib/policy";
import { trackAdsPurchase } from "@/lib/googleAds";
import { CheckoutLinksInNewTab } from "@/components/booking/CheckoutLinksInNewTab";

export interface PackageDeparture {
  id: string;
  date: string;
  departureTime: string;
  seatsAvailable: number;
  /** Seats (private: the vehicle) on the departure; a private day is bookable only while all are free. */
  capacityTotal: number;
  /** Dollars per adult; youth pay childPrice when set. */
  price: number;
  childPrice?: number | null;
  /** Dollars per infant (0–5); when set, infants pay it and take a seat, otherwise ride free. */
  infantPrice?: number | null;
  currency: string;
}

/** One place or activity of a day, shown under "What this day includes" (owner, 2026-11-18: in place, not a link). */
export interface PackageDayStop {
  name: string;
  desc: string;
  optional?: boolean;
  /** Only from June 1 to October 10. */
  summerOnly?: boolean;
}

export interface PackageDay {
  title: string;
  label: string;
  /** Product page for the day. */
  href: string;
  departures: PackageDeparture[];
  /** The day's places and activities, shown in a dropdown under its calendar. */
  includes?: PackageDayStop[];
}

export interface PackageStop {
  id: string;
  name: string;
  town: string;
  address: string;
  instructions: string;
}

interface BookingRef {
  bookingReference: string;
  voucherUrl: string;
  voucherToken: string;
  totalAmount: number;
  status: string;
}

const OUTSIDE_BANFF_CANMORE = /\b(lake\s*louise|calgary|jasper|golden|field|revelstoke|edmonton|airdrie|cochrane|radium|invermere)\b/i;

const SHARED_MAX_GUESTS = 12;

/** June 1 to October 10 (the summer season of the prices and discounts). */
const inSummer = (date: string) => {
  const md = date.slice(5, 10);
  return md >= "06-01" && md <= "10-10";
};

/** The day after / before a YYYY-MM-DD date. */
const shiftDay = (date: string, by: number) => {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + by)).toISOString().slice(0, 10);
};

/** Where the Four-Day's return tour finishes (owner, 2026-11-24): three included, Calgary extra. */
export const FINAL_DESTINATIONS = [
  { value: "BANFF", label: "Banff", description: "Included" },
  { value: "CANMORE", label: "Canmore", description: "Included" },
  { value: "LAKE_LOUISE", label: "Lake Louise", description: "Included" },
  { value: "CALGARY", label: "Calgary (extra cost)", description: "Separate arrangement; our team confirms the price and timing" },
  { value: "CALGARY_AIRPORT", label: "Calgary Airport (extra cost)", description: "Separate arrangement; our team confirms the price and flight timing" },
] as const;
type FinalArea = (typeof FINAL_DESTINATIONS)[number]["value"];
const isCalgary = (a: string) => a === "CALGARY" || a === "CALGARY_AIRPORT";

const cad = (n: number) => `CAD $${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Mon, Oct 26, 2026", spelled out by hand so the server and every browser print the same text. */
const dayLabel = (date: string) => {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${MONTHS[m - 1]} ${d}, ${y}`;
};

const timeLabel = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** A day's fare in cents with the package discount, rounded the way the server rounds. */
function dayCents(d: PackageDeparture | undefined, adults: number, children: number, infants: number, discountPercent: number, vehicle = false, isIcefield = false) {
  if (!d) return { fare: 0, discount: 0, total: 0 };
  let adultPrice = d.price;
  let childPrice = d.childPrice ?? d.price;
  let infantPrice = d.infantPrice != null ? d.infantPrice : 0;
  if (!vehicle && isIcefield) {
    if (inSummer(d.date)) {
      adultPrice = 320;
      childPrice = 280;
      infantPrice = 170;
    } else {
      adultPrice = 220;
      childPrice = 220;
      infantPrice = 170;
    }
  }
  const fare = vehicle
    ? Math.round(d.price * 100)
    : Math.round(adultPrice * 100) * adults +
      Math.round(childPrice * 100) * children +
      Math.round(infantPrice * 100) * infants;
  const discount = Math.round((fare * discountPercent) / 100);
  return { fare, discount, total: fare - discount };
}

export function PackageCheckout({
  packageSlug,
  title,
  discountPercent,
  winterDiscountPercent,
  days,
  stops,
  vehicle = false,
  maxGuests,
  requestHref = `/contact-us?package=${packageSlug}`,
  cancellationNote = "Cancel the entire package at least 24 hours before your first scheduled tour for a full refund. This deadline applies to the whole package, not separately to each day.",
  depositAllowed = false,
  compact = false,
  wholePage = false,
  consecutive = [],
  guestNote,
  datesNote,
  cancellationCutoffHours,
  banffCanmorePickup = false,
  banffCanmoreTransferOnly = false,
  directActivities = false,
  hidePickupTimes = false,
  arrivalStartsDeadline = false,
}: {
  packageSlug: string;
  title: string;
  /** Package discount; from October 11 to May 31 `winterDiscountPercent` when given (same as the server). */
  discountPercent: number;
  winterDiscountPercent?: number;
  days: PackageDay[];
  stops: PackageStop[];
  /** Private journey: one vehicle a day for the group, priced per vehicle, optional airport transfer. */
  vehicle?: boolean;
  maxGuests?: number;
  /** Where to ask about other dates when none are free. */
  requestHref?: string;
  cancellationNote?: string;
  /** Private journeys: offer "continue with a 20% deposit" beside full payment (owner, 2026-11-11). */
  depositAllowed?: boolean;
  /** Inside the AI concierge's chat panel: one narrow column, links open in a new tab (no redirect). */
  compact?: boolean;
  /** The page is only this checkout (/two-day-rockies-explorer/book, …/private): every link on it opens in a new tab. */
  wholePage?: boolean;
  /** Pairs of days [i, j] that must be booked on consecutive dates (day j the day after day i). */
  consecutive?: [number, number][];
  /** Under the guest count (private journeys). */
  guestNote?: string;
  /** Above the calendars, instead of the default "any order" line. */
  datesNote?: string;
  /** Hours before the first service the cancellation deadline falls (default: 72 private, 24 shared). */
  cancellationCutoffHours?: number;
  /** Three-Day (owner, 2026-11-24): every tour picks up in Banff or Canmore, never Lake Louise. */
  banffCanmorePickup?: boolean;
  /** Airport transfers booked online to Banff or Canmore only; Lake Louise through Special requests. */
  banffCanmoreTransferOnly?: boolean;
  /** Each activity is requested on its own with a participant count (no generic "Add-on activities" box). */
  directActivities?: boolean;
  /** Don't show the shared tours' 7:30/8:00 pickup start times (not confirmed for private packages). */
  hidePickupTimes?: boolean;
  /** An arrival transfer before the tours starts the cancellation deadline (Four-Day always does). */
  arrivalStartsDeadline?: boolean;
}) {
  // Every link in the checkout opens in a new tab, so the guest never leaves it (owner, 2026-11-18).
  const newTab = { target: "_blank", rel: "noopener" } as const;
  const MAX_GUESTS = maxGuests ?? SHARED_MAX_GUESTS;
  const discountOn = (date: string | undefined) => (date && !inSummer(date) && winterDiscountPercent != null ? winterDiscountPercent : discountPercent);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [picks, setPicks] = useState<string[]>(days.map(() => ""));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("CA");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [stopId, setStopId] = useState("");
  const [customPickup, setCustomPickup] = useState("");
  const [samePickup, setSamePickup] = useState(true);
  const [tourPickups, setTourPickups] = useState<{ stopId: string; customPickup: string }[]>(() =>
    days.map(() => ({ stopId: "", customPickup: "" })),
  );
  const [childSeatRequested, setChildSeatRequested] = useState(false);
  const isFourDay = days.length === 4 || packageSlug.includes("four-day");
  const [day4JasperPickup, setDay4JasperPickup] = useState("");
  // Four-Day (owner, 2026-11-24): where the return tour finishes; Calgary is an extra-cost request.
  const [finalArea, setFinalArea] = useState<FinalArea | "">("");
  const [finalAddress, setFinalAddress] = useState("");
  // The outbound tours (all but the Jasper return) pick up in Banff or Canmore, never Lake Louise.
  const outboundDays = isFourDay ? days.map((_, i) => i).slice(0, -1) : [];
  const banffCanmoreOnly = isFourDay || banffCanmorePickup;
  const pickupStops = banffCanmoreOnly ? stops.filter((st) => !/lake louise/i.test(st.town)) : stops;
  const cutoffHours = cancellationCutoffHours ?? (vehicle ? 72 : 24);
  const [requests, setRequests] = useState("");
  // Promo code (owner, 2026-11-20): taken off on top of the package price. A percent code comes off
  // every day; a fixed amount comes off Day 1 only. The server checks and prices it again.
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState("");
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; percent: number; amountOff: number; message: string } | null>(null);
  const applyPromo = async () => {
    setPromoError("");
    setApplyingPromo(true);
    try {
      const res = await fetch("/api/pricing/promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promoCode: promoInput.trim(), packageSlug }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setPromoError(data.error || "Invalid promo code");
        setAppliedPromo(null);
      } else {
        setAppliedPromo({ code: data.promoCode, percent: Number(data.discountPercent) || 0, amountOff: Number(data.amountOff) || 0, message: data.message || `Code ${data.promoCode} applied.` });
        setPromoInput("");
      }
    } catch {
      setPromoError("We couldn't check that code. Please try again.");
    } finally {
      setApplyingPromo(false);
    }
  };
  // Private journeys: "Add-on activities" (owner, 2026-11-09), arranged by the team and paid separately.
  const [activities, setActivities] = useState(false);
  // Who joins the activities, with ages (owner, 2026-11-11); null until the guest changes it.
  const [activityGuestsPicked, setActivityGuests] = useState<ActivityGuests | null>(null);
  // Private journeys: each optional activity and who joins it (owner, 2026-11-18).
  const packageActivities = vehicle ? (PACKAGE_ACTIVITIES[packageSlug] ?? []) : [];
  const [activityChoice, setActivityChoice] = useState<PackageActivityChoice>({});
  // Per-person activity prices from the server; null price = confirmed by our team, not charged.
  const [activityPrices, setActivityPrices] = useState<PackageActivityPrices | null>(null);
  useEffect(() => {
    if (packageActivities.length > 0) void loadPackageActivityPrices().then(setActivityPrices);
  }, [packageActivities.length]);
  // "Some days can't be booked" pop-up (owner, 2026-11-18); closed by the guest until the dates change.
  const [unavailableDismissed, setUnavailableDismissed] = useState("");
  const [airport, setAirport] = useState(false);
  const [airportTransfer, setAirportTransfer] = useState<AirportTransferValue>(EMPTY_AIRPORT_TRANSFER);
  const transferPrices = useAirportTransferPrices();
  const [paymentPlan, setPaymentPlan] = useState<"FULL" | "DEPOSIT">("FULL");
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [awaiting, setAwaiting] = useState<{ bookings: BookingRef[]; clientSecret: string; amount: number } | null>(null);
  const [confirming, setConfirming] = useState<"no" | "yes" | "slow">("no");
  const [confirmed, setConfirmed] = useState<BookingRef[] | null>(null);
  const keyRef = useRef("");

  // Google Ads "Purchase" conversion once the package is confirmed (owner, 16 Nov 2026): one
  // conversion for the whole package, under the first day's booking reference.
  useEffect(() => {
    if (!confirmed?.length) return;
    trackAdsPurchase({
      transactionId: confirmed[0]!.bookingReference,
      value: confirmed.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0),
      currency: "CAD",
    });
  }, [confirmed]);

  const guests = vehicle ? adults : adults + children + infants;
  const activityGuests = activityGuestsPicked ?? activityGuestsFor(adults);
  // Seats a departure needs for the party: infants take one where they pay (same rule as the server);
  // a private day needs the whole vehicle.
  const seatsFor = (d: PackageDeparture) => (vehicle ? d.capacityTotal : adults + children + (d.infantPrice != null ? infants : 0));
  // Airport transfer: private journeys with two or more guests only (owner, 2026-11-06).
  const offersAirport = vehicle && guests >= 2;
  const withAirport = offersAirport && airport;
  const chosen = picks.map((id, i) => days[i].departures.find((d) => d.id === id));

  // A date that no longer has room for the party, or that clashes with the other day, is cleared.
  useEffect(() => {
    setPicks((current) =>
      current.map((id, i) => {
        const d = days[i].departures.find((x) => x.id === id);
        if (!d || d.seatsAvailable < seatsFor(d)) return "";
        const clash = current.some((otherId, j) => j !== i && days[j].departures.find((x) => x.id === otherId)?.date === d.date);
        return clash && i > 0 ? "" : id;
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seatsFor reads adults, children, infants
  }, [adults, children, infants, days]);

  const dateOf = (i: number, id = picks[i]) => days[i].departures.find((x) => x.id === id)?.date.slice(0, 10);
  // Consecutive pairs (Four-Day: Icefields to Jasper, then Jasper return the next day): when the first
  // date changes and the second no longer follows it, the second is cleared to be chosen again.
  useEffect(() => {
    if (consecutive.length === 0) return;
    setPicks((current) => {
      let next = current;
      for (const [a, b] of consecutive) {
        const da = dateOf(a, current[a]);
        const db = dateOf(b, current[b]);
        if (da && db && shiftDay(da, 1) !== db) next = next.map((x, k) => (k === b ? "" : x));
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dateOf reads days
  }, [picks, consecutive, days]);

  // A day's calendar offers the dates with room for the party that no other day has taken, and for a
  // consecutive pair only dates whose partner day is (or can still be) the day before or after.
  const fitsDay = (i: number) => {
    const taken = new Set(chosen.filter((_, j) => j !== i).map((d) => d?.date.slice(0, 10)));
    const free = (j: number, date: string) => days[j].departures.some((x) => x.date.slice(0, 10) === date && x.seatsAvailable >= seatsFor(x) && !taken.has(date));
    return (d: PackageDeparture) => {
      const date = d.date.slice(0, 10);
      if (d.seatsAvailable < seatsFor(d) || taken.has(date)) return false;
      for (const [a, b] of consecutive) {
        if (i === a) {
          const db = chosen[b]?.date.slice(0, 10);
          if (db ? shiftDay(date, 1) !== db : !free(b, shiftDay(date, 1))) return false;
        }
        if (i === b) {
          const da = chosen[a]?.date.slice(0, 10);
          if (da ? shiftDay(da, 1) !== date : !free(a, shiftDay(date, -1))) return false;
        }
      }
      return true;
    };
  };

  const isIcefieldsDay = (day: PackageDay) =>
    day.href.toLowerCase().includes("icefields") || day.title.toLowerCase().includes("icefield");

  const lines = chosen.map((d, i) =>
    dayCents(d, adults, children, infants, discountOn(d?.date), vehicle, isIcefieldsDay(days[i])),
  );
  const fare = lines.reduce((n, l) => n + l.fare, 0);
  const saving = lines.reduce((n, l) => n + l.discount, 0);

  const icefieldsIndex = days.findIndex(isIcefieldsDay);
  const icefieldsChosen = icefieldsIndex >= 0 ? chosen[icefieldsIndex] : null;
  const showWinterIcefieldsNotice = Boolean(icefieldsChosen && !inSummer(icefieldsChosen.date));

  const allPicked = chosen.every(Boolean);

  const pickedList = days.map((day, i) => ({
    day,
    departure: chosen[i],
    index: i,
    line: lines[i],
  }));

  const displayList = allPicked
    ? [...pickedList].sort((a, b) => (a.departure && b.departure ? a.departure.date.localeCompare(b.departure.date) : 0))
    : pickedList;
  // The transfer (owner, 2026-11-17): the server's price per one-way transfer by where the guest
  // stays, twice for a round trip; added to Day 1, never discounted. The server prices it again.
  const transferQuote = withAirport ? airportTransferQuote(airportTransfer, guests, transferPrices) : null;
  const transferDollars = transferQuote?.total ?? null;
  // Ticked activities: each priced for the guests joining it, added to Day 1 (the server prices them again).
  // Direct activity requests (Three-Day): the requests themselves are the choice, no outer tick box.
  const activitiesOn = directActivities ? Object.keys(activityChoice).length > 0 : activities;
  const chosenActivityList = vehicle && activitiesOn ? packageActivities.filter((a) => activityChoice[a.id]) : [];
  const activityPriceOf = (id: string) => packageActivityPrice(activityPrices, id, activityChoice[id]!);
  const activitiesDollars = chosenActivityList.reduce((n, a) => n + (activityPriceOf(a.id) ?? 0), 0);
  // Each day's promo saving (cents), from the day's package price; never the transfer or activities.
  const promoCents = lines.map((l, i) =>
    !appliedPromo ? 0 : appliedPromo.amountOff > 0 ? (i === 0 ? Math.min(Math.round(appliedPromo.amountOff * 100), l.total) : 0) : Math.round((l.total * appliedPromo.percent) / 100),
  );
  const promoSaving = promoCents.reduce((n, c) => n + c, 0);
  const total = lines.reduce((n, l) => n + l.total, 0) - promoSaving + (transferDollars ?? 0) * 100 + Math.round(activitiesDollars * 100);
  // 20% deposit: each day's own deposit (the server rounds per day), when every day is 15+ days away.
  const canDeposit = depositAllowed && allPicked && total > 0 && chosen.every((d) => d && depositAvailable(d.date.slice(0, 10), d.departureTime));
  const plan = canDeposit ? paymentPlan : "FULL";
  const dayTotals = lines.map((l, i) => (l.total - promoCents[i]) / 100 + (i === 0 ? (transferDollars ?? 0) + activitiesDollars : 0));
  const depositNow = Math.round(dayTotals.reduce((n, t) => n + depositFor(t), 0) * 100) / 100;
  const firstDay = chosen.filter(Boolean).map((d) => d!).sort((a, b) => a.date.localeCompare(b.date))[0];
  const balanceDueLabel = firstDay ? formatRockiesDate(balanceDueDate(firstDay.date.slice(0, 10), firstDay.departureTime)) : "";
  const dayWord = days.length === 2 ? "both days" : `all ${days.length} days`;
  const numberWord = ["", "one", "two", "three", "four", "five"][days.length] ?? String(days.length);
  const tourWord = days.length === 2 ? "both tours" : `all ${numberWord} tours`;
  // The cancellation deadline runs from the first booked service: for the Four-Day, an arrival
  // transfer before the tours (its pickup, the flight's arrival time), otherwise the first tour.
  const arrivalFirst =
    (isFourDay || arrivalStartsDeadline) && withAirport && airportTransfer.type !== "DEPARTURE" && airportTransfer.arrivalDate && airportTransfer.arrivalTime && firstDay
      ? `${airportTransfer.arrivalDate} ${airportTransfer.arrivalTime}` < `${firstDay.date.slice(0, 10)} ${firstDay.departureTime.slice(0, 5)}`
      : false;
  const deadlineFrom = arrivalFirst ? { date: airportTransfer.arrivalDate!, time: airportTransfer.arrivalTime! } : firstDay ? { date: firstDay.date.slice(0, 10), time: firstDay.departureTime } : null;
  const finalLabel = FINAL_DESTINATIONS.find((f) => f.value === finalArea);

  const phone = phoneLocal.trim() ? `+${dialCode(phoneCountry)} ${phoneLocal.trim()}` : "";
  // Journeys without an activity list still send a request line; listed activities go as data.
  const activitiesRequestLine = vehicle && activities && packageActivities.length === 0 ? activityAddOnsRequestLine([], activityGuests) : "";

  // A day with no date left that fits (sold out, or every free date taken by another day): the
  // whole journey can't be booked online, so a pop-up asks the guest to contact us.
  const blockedDays = days.map((_, i) => i).filter((i) => !picks[i] && !days[i].departures.some(fitsDay(i)));
  const blockedKey = `${blockedDays.join(",")}|${picks.join(",")}|${adults}`;
  // Only once the guest reaches the booking form (it sits low on the journey pages).
  const rootRef = useRef<HTMLDivElement>(null);
  const [formSeen, setFormSeen] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || formSeen) return;
    if (typeof IntersectionObserver === "undefined") {
      setFormSeen(true);
      return;
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setFormSeen(true), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [formSeen]);
  const showUnavailable = formSeen && blockedDays.length > 0 && unavailableDismissed !== blockedKey && !awaiting;
  const unavailableRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = unavailableRef.current;
    if (!dialog) return;
    if (showUnavailable && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute("open", "");
      }
    } else if (!showUnavailable && dialog.open) dialog.close();
  }, [showUnavailable]);
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    days.forEach((day, i) => {
      if (!picks[i]) e[`day${i}`] = `Choose a date for ${day.title}.`;
    });
    if (name.trim().length < 2) e.name = "Enter the lead guest's full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Enter a valid email address.";
    if (phoneLocal.replace(/\D/g, "").length < 6) e.phone = "Enter a mobile number for pickup-day updates.";
    if (samePickup) {
      if (!stopId && (!vehicle || !customPickup.trim())) {
        e.stop = vehicle
          ? "Choose your Banff or Canmore pickup hotel, or enter your accommodation address in Canmore or Banff."
          : "Choose your listed Banff or Canmore pickup hotel.";
      } else if (vehicle && customPickup.trim() && OUTSIDE_BANFF_CANMORE.test(customPickup)) {
        e.stop = "Custom pickup addresses on private tours are available in Canmore and Banff only.";
      }
    } else {
      days.forEach((day, i) => {
        if (isFourDay && !outboundDays.includes(i)) return;
        const p = tourPickups[i];
        if (!p?.stopId && (!vehicle || !p?.customPickup.trim())) {
          e[`stop_${i}`] = vehicle
            ? `Choose a pickup hotel or enter a Canmore/Banff accommodation for ${day.title}.`
            : `Choose a listed pickup hotel for ${day.title}.`;
        } else if (vehicle && p?.customPickup.trim() && OUTSIDE_BANFF_CANMORE.test(p.customPickup)) {
          e[`stop_${i}`] = `Custom pickup addresses on private tours are available in Canmore and Banff only.`;
        }
      });
    }
    if (isFourDay && !day4JasperPickup.trim()) e.jasperPickup = `Enter your Jasper accommodation for ${days[days.length - 1].title}.`;
    if (isFourDay && !finalArea) e.finalArea = `Choose where ${days[days.length - 1].title} finishes.`;
    const transfer = withAirport ? airportTransferError(airportTransfer) : null;
    if (transfer) e.airport = transfer;
    if (vehicle && activitiesOn && packageActivities.length > 0) {
      const chosenActivities = Object.values(activityChoice);
      if (chosenActivities.length === 0) e.activities = "Choose at least one activity, or untick Add-on activities.";
      else if (chosenActivities.some((g) => activityGuestCount(g) < 1 || activityGuestCount(g) > adults)) e.activities = `Choose 1 to ${adults} guests for each activity.`;
    } else {
      const activityCount = activityGuests.adults + activityGuests.children + activityGuests.infants;
      if (vehicle && activities && (activityCount < 1 || activityCount > adults)) e.activities = `Choose 1 to ${adults} guests for the add-on activities.`;
    }
    return e;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- outboundDays follows isFourDay and days
  }, [days, picks, name, email, phoneLocal, samePickup, stopId, customPickup, tourPickups, isFourDay, day4JasperPickup, finalArea, withAirport, airportTransfer, vehicle, activities, activitiesOn, activityGuests, adults, activityChoice, packageActivities.length]);

  const missingFieldList = useMemo(() => {
    const list: string[] = [];
    days.forEach((day, i) => {
      if (!picks[i]) list.push(`Date for ${day.title}`);
    });
    if (name.trim().length < 2) list.push("Lead guest full name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) list.push("Valid email address");
    if (phoneLocal.replace(/\D/g, "").length < 6) list.push("Mobile phone number");
    if (samePickup) {
      if (!stopId && (!vehicle || !customPickup.trim())) {
        list.push(vehicle ? "Pickup accommodation in Banff or Canmore" : "Listed pickup hotel in Banff or Canmore");
      }
    } else {
      days.forEach((day, i) => {
        if (isFourDay && !outboundDays.includes(i)) return;
        if (!tourPickups[i]?.stopId && (!vehicle || !tourPickups[i]?.customPickup.trim())) {
          list.push(`Pickup hotel for ${day.title}`);
        }
      });
    }
    if (isFourDay && !day4JasperPickup.trim()) list.push(`Jasper accommodation for ${days[days.length - 1].title}`);
    if (isFourDay && !finalArea) list.push("Final drop-off destination");
    if (withAirport) {
      const transfer = airportTransferError(airportTransfer);
      if (transfer) list.push(`Airport transfer: ${transfer}`);
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- outboundDays follows isFourDay and days
  }, [days, picks, name, email, phoneLocal, samePickup, stopId, customPickup, tourPickups, isFourDay, day4JasperPickup, finalArea, withAirport, airportTransfer]);

  const show = (k: string) => (attempted ? errors[k] : undefined);
  const status = (k: string) => (show(k) ? { type: "error" as const, message: errors[k] } : undefined);

  const submit = async () => {
    setAttempted(true);
    setError("");
    if (Object.keys(errors).length > 0) {
      document.querySelector("[data-first-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const unavailableIndex = chosen.findIndex((d) => !d || d.seatsAvailable < seatsFor(d));
    if (unavailableIndex >= 0) {
      const tourName = days[unavailableIndex].title;
      setError(
        vehicle
          ? `${tourName}: the private vehicle is no longer free on the date you chose. Please choose another date for ${tourName}.`
          : `${tourName}: the date you chose no longer has enough seats for your party. Please choose another date for ${tourName}.`,
      );
      return;
    }
    if (!keyRef.current) keyRef.current = `pkg-${crypto.randomUUID()}`;
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings/package", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": keyRef.current },
        body: JSON.stringify({
          packageSlug,
          departureIds: picks,
          customerName: name.trim(),
          customerEmail: email.trim(),
          customerPhone: phone,
          customerCountry: phoneCountry,
          pickupStopId: stopId || undefined,
          pickupCustomText: vehicle ? customPickup.trim() || undefined : undefined,
          day4JasperPickup: isFourDay ? day4JasperPickup.trim() : undefined,
          finalDestination: isFourDay && finalArea ? { area: finalArea, address: finalAddress.trim() || undefined } : undefined,
          dayPickups: isFourDay
            ? days.map((_, i) =>
                !outboundDays.includes(i)
                  ? { pickupCustomText: `Jasper: ${day4JasperPickup.trim()}` }
                  : samePickup
                    ? { pickupStopId: stopId || undefined, pickupCustomText: vehicle ? customPickup.trim() || undefined : undefined }
                    : { pickupStopId: tourPickups[i]?.stopId || undefined, pickupCustomText: vehicle ? tourPickups[i]?.customPickup.trim() || undefined : undefined },
              )
            : samePickup
              ? days.map(() => ({ pickupStopId: stopId || undefined, pickupCustomText: vehicle ? customPickup.trim() || undefined : undefined }))
              : tourPickups.map((p) => ({ pickupStopId: p.stopId || undefined, pickupCustomText: vehicle ? p.customPickup.trim() || undefined : undefined })),
          adultsCount: adults,
          childrenCount: vehicle ? 0 : children,
          infantsCount: vehicle ? 0 : infants,
          specialRequests: [
            requests.trim(),
            childSeatRequested ? "Complimentary child seat / booster requested (requires advance confirmation by team)" : "",
            activitiesRequestLine,
          ].filter(Boolean).join("\n") || undefined,
          airportTransfer: withAirport ? airportTransferPayload(airportTransfer) : undefined,
          promoCode: appliedPromo?.code,
          packageActivities: chosenActivityList.map((a) => ({ id: a.id, ...activityChoice[a.id]! })),
          paymentPlan: plan,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        if (res.status !== 429) keyRef.current = "";
        setError(data.error || "We couldn't book these dates. Please try again.");
        return;
      }
      if (data.payment?.clientSecret) setAwaiting({ bookings: data.bookings, clientSecret: data.payment.clientSecret, amount: data.payment.amount });
      else if (data.nextStep === "CONFIRMED") setConfirmed(data.bookings);
      else {
        keyRef.current = "";
        setError("These bookings were released before payment completed. Please try again.");
      }
    } catch {
      setError("We couldn't reach the booking server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // After Stripe accepts the card, wait for the server to confirm every day (Stripe webhook).
  const waitForConfirmation = async (bookings: BookingRef[]) => {
    setConfirming("yes");
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((r) => setTimeout(r, 1500));
      const states = await Promise.all(
        bookings.map(async (b) => {
          const res = await fetch(`/api/bookings?ref=${encodeURIComponent(b.bookingReference)}&t=${b.voucherToken}`).catch(() => null);
          const data = res?.ok ? await res.json().catch(() => null) : null;
          return data?.booking?.status as string | undefined;
        }),
      );
      if (states.every((s) => s === "CONFIRMED" || s === "PAID_UNSYNCED")) {
        setAwaiting(null);
        setConfirmed(bookings.map((b, i) => ({ ...b, status: states[i]! })));
        return;
      }
      if (states.some((s) => s === "CANCELLED" || s === "EXPIRED")) {
        keyRef.current = "";
        setAwaiting(null);
        setConfirming("no");
        setError("The payment didn't complete, so the seats were released. Please try again.");
        return;
      }
    }
    setConfirming("slow");
  };

  if (confirmed) {
    return (
      <section className={`mx-auto max-w-2xl rounded-none bg-white text-center ring-1 ring-obsidian-900/[0.07] ${compact ? "p-4" : "p-6 sm:p-10"}`} aria-live="polite">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <Check className="h-7 w-7" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-3xl font-light text-obsidian-900">You&rsquo;re booked for {dayWord}</h2>
        <p className="mt-3 text-base text-slate-600">
          We&rsquo;ve emailed a confirmation and voucher for each day to {email.trim()}. Show the voucher to your guide at pickup.
        </p>
        <ul className="mt-6 space-y-3 text-left">
          {confirmed.map((b, i) => (
            <li key={b.bookingReference} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-obsidian-50 px-4 py-3">
              <span>
                <span className="block text-base font-medium text-obsidian-900">{days[i].title}</span>
                <span className="block text-sm text-slate-600">
                  {chosen[i] ? `${dayLabel(chosen[i]!.date)} · ${timeLabel(chosen[i]!.departureTime)} · ` : ""}
                  {b.bookingReference}
                </span>
              </span>
              <span className="flex flex-wrap gap-2">
                <a href={b.voucherUrl} {...newTab} className="inline-flex h-10 items-center rounded-full bg-obsidian-950 px-5 text-sm text-white hover:bg-obsidian-900">
                  Open voucher
                </a>
                {compact && (
                  <a
                    href={`/api/bookings/voucher.pdf?ref=${encodeURIComponent(b.bookingReference)}&t=${encodeURIComponent(b.voucherToken)}`}
                    download={`vista-chase-voucher-${b.bookingReference}.pdf`}
                    className="inline-flex h-10 items-center rounded-full px-5 text-sm text-ocean-700 ring-1 ring-obsidian-900/15 hover:bg-ocean-50"
                  >
                    Download PDF
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div ref={rootRef} className={compact ? "grid items-start gap-4 pb-28" : "grid items-start gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12 pb-28 lg:pb-36"}>
      {wholePage && <CheckoutLinksInNewTab />}
      <dialog
        ref={unavailableRef}
        aria-labelledby="package-unavailable-title"
        onCancel={() => setUnavailableDismissed(blockedKey)}
        className="w-[min(28rem,calc(100vw-2rem))] rounded-none bg-white p-0 text-obsidian-900 shadow-high backdrop:bg-obsidian-950/60 backdrop:backdrop-blur-sm"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id="package-unavailable-title" className="text-xl font-light">
              {blockedDays.length === days.length ? `These dates aren't available online` : `We can't fit ${dayWord} online`}
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setUnavailableDismissed(blockedKey)}
              className="-mr-2 -mt-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-obsidian-50"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-3 text-base text-slate-700">
            {blockedDays.length === 1
              ? `There's no free date left for ${days[blockedDays[0]].title}`
              : `There are no free dates left for ${blockedDays.map((i) => days[i].title).join(" and ")}`}
            {picks.some(Boolean) ? " with the dates you've chosen" : ""}, so the whole {title} can&rsquo;t be booked here right now. Please contact us and we&rsquo;ll help you plan your days.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={requestHref}
              {...newTab}
              className="inline-flex h-11 items-center rounded-full bg-obsidian-950 px-6 text-sm text-white hover:bg-obsidian-900"
            >
              Contact us
            </a>
            <button
              type="button"
              onClick={() => setUnavailableDismissed(blockedKey)}
              className="inline-flex h-11 items-center rounded-full px-6 text-sm text-ocean-700 ring-1 ring-obsidian-900/15 hover:bg-ocean-50"
            >
              {picks.some(Boolean) ? "Change my dates" : "Close"}
            </button>
          </div>
        </div>
      </dialog>
      <div className="space-y-6">
        <Section compact={compact} icon={Users} title="Who's coming">
          {vehicle ? (
            <>
              <div className="max-w-xs">
                <QuantityInput label="Guests" description="All ages, one private vehicle" value={adults} onChange={setAdults} min={1} max={MAX_GUESTS} />
              </div>
              <p className="mt-3 text-sm text-slate-600">{guestNote ?? `Private, up to ${MAX_GUESTS} guests. The price is per vehicle, whatever the group size.`}</p>
            </>
          ) : (
            <>
              <div className={compact ? "grid gap-4" : "grid gap-4 sm:grid-cols-3"}>
                <QuantityInput label="Adults" description="Ages 16–99" value={adults} onChange={setAdults} min={1} max={MAX_GUESTS - children - infants} />
                <QuantityInput label="Youth" description="Ages 6–15" value={children} onChange={setChildren} min={0} max={MAX_GUESTS - adults - infants} />
                <QuantityInput label="Infants" description="Ages 0–5, take a seat" value={infants} onChange={setInfants} min={0} max={Math.min(4, MAX_GUESTS - adults - children)} />
              </div>
              <p className="mt-3 text-sm font-medium text-obsidian-900">Maximum 12 guests per vehicle each day.</p>
              <p className="mt-1 text-sm text-slate-600">Small groups on each tour, with more time with your guide.</p>
              {(children > 0 || infants > 0) && (
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-obsidian-900/10 bg-obsidian-50/70 p-3.5 transition-colors hover:bg-obsidian-50">
                  <input
                    type="checkbox"
                    checked={childSeatRequested}
                    onChange={(e) => setChildSeatRequested(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-obsidian-900/20 text-ocean-700 focus:ring-ocean-500"
                  />
                  <span className="flex flex-col gap-0.5 text-sm">
                    <span className="font-medium text-obsidian-900">Request complimentary child seat or booster</span>
                    <span className="text-slate-600">Complimentary child seats and boosters are available in limited supply and require advance confirmation by our team.</span>
                  </span>
                </label>
              )}
            </>
          )}
        </Section>

        <Section compact={compact} icon={CalendarDays} title="Choose your dates">
          <div className="space-y-6">
            <p className="text-sm text-slate-600">
              {datesNote ?? "Choose an available date for each tour, in either order. Dates do not need to be consecutive, but each tour must have a different date."}
            </p>
            {showWinterIcefieldsNotice && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm" role="status">
                <p className="font-semibold text-amber-950">Winter itinerary notice</p>
                <p className="mt-1">
                  Abraham Lake replaces Ice Explorer and Skywalk; guests bring lunch or request a morning food stop.
                </p>
              </div>
            )}
            {days.map((day, i) => {
              const fits = fitsDay(i);
              const open = day.departures.some(fits);
              return (
                <div key={`${day.title}-${i}`} {...(show(`day${i}`) ? { "data-first-error": true } : {})}>
                  <p className="text-lg font-medium text-obsidian-900">
                    {day.title} <span className="text-sm font-normal text-slate-600">· {day.label}</span>
                  </p>
                  <div className="mt-2">
                    {open || picks[i] ? (
                      <DepartureCalendar
                        departures={day.departures.map((d) => ({ ...d, returnTime: null, capacityBooked: d.capacityTotal - d.seatsAvailable, capacityHeld: 0, status: "ACTIVE" }))}
                        isBookable={(d) => fits(d as PackageDeparture)}
                        value={picks[i]}
                        onChange={(id) => setPicks((p) => p.map((x, j) => (j === i ? id : x)))}
                        describe={(d) =>
                          vehicle
                            ? `CAD $${d.price.toLocaleString("en-CA")} per vehicle before the package price`
                            : d.seatsAvailable <= 4
                              ? `Only ${d.seatsAvailable} seats left`
                              : `${d.seatsAvailable} seats available`
                        }
                        collapseOnSelect
                      />
                    ) : (
                      <p className="rounded-xl bg-obsidian-50 px-4 py-3 text-sm text-slate-700">
                        {vehicle ? "No free vehicle dates for this day right now." : `No dates with ${guests} free seats right now.`}{" "}
                        <Link href={requestHref} {...newTab} className="text-ocean-700 underline underline-offset-2">
                          Ask us about other dates
                        </Link>
                        .
                      </p>
                    )}
                    {show(`day${i}`) && (
                      <p id={`day${i}-error`} role="alert" className="mt-1.5 text-sm text-red-700">
                        {errors[`day${i}`]}
                      </p>
                    )}
                  </div>
                  {day.includes && day.includes.length > 0 ? (
                    <details className="group mt-2 rounded-xl bg-obsidian-50 ring-1 ring-obsidian-900/[0.06]">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm text-ocean-700 [&::-webkit-details-marker]:hidden">
                        What this day includes
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                      </summary>
                      <ul className="space-y-2.5 px-4 pb-4 text-sm">
                        {day.includes.map((stop) => (
                          <li key={stop.name}>
                            <span className="block text-obsidian-900">
                              {stop.name}
                              {stop.optional && <span className="ml-1.5 text-xs text-slate-600">(optional, costs extra)</span>}
                              {stop.summerOnly && !stop.optional && <span className="ml-1.5 text-xs text-slate-600">(June 1 to October 10)</span>}
                            </span>
                            <span className="block text-slate-600">{stop.desc}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <Link href={day.href} {...newTab} className="mt-1.5 inline-block text-sm text-ocean-700 underline underline-offset-2">
                      What this day includes
                    </Link>
                  )}
                </div>
              );
            })}
            <p className="text-sm text-slate-600">Accommodation is not included.</p>
          </div>
        </Section>


        {/* Owner, 2026-11-19: after the guests come the dates, then the airport transfer, then add-ons. */}
        {vehicle && offersAirport && (
          <Section compact={compact} icon={Plane} title="Airport arrival & departure">
              {offersAirport && (
                <div className="space-y-3" {...(show("airport") ? { "data-first-error": true } : {})}>
                  <AirportTransferToggle checked={airport} onChange={setAirport} />
                  {airport && (
                    <AirportTransferDetails
                      value={airportTransfer}
                      onChange={setAirportTransfer}
                      error={show("airport")}
                      guests={guests}
                      {...(banffCanmoreTransferOnly
                        ? { areas: ["BANFF", "CANMORE"] as const, areaNote: "Staying in Lake Louise? Add your transfer request in Special requests or contact our team to confirm it." }
                        : {})}
                    />
                  )}
                </div>
              )}
          </Section>
        )}

        {vehicle && (
          <Section compact={compact} icon={Ticket} title="Add-on activities">
              <div {...(show("activities") ? { "data-first-error": true } : {})}>
                {directActivities && packageActivities.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">
                      Request any optional experience below and say how many guests join it. Our team arranges the tickets and sends a separate invoice: nothing is charged now, and requests are not confirmed reservations. Reserved activities may mean other stops are shortened or skipped.
                    </p>
                    <PackageActivityPicker activities={packageActivities} value={activityChoice} onChange={setActivityChoice} partySize={adults} prices={activityPrices} />
                  </div>
                ) : packageActivities.length > 0 ? (
                  <ActivityAddOnToggle checked={activities} onChange={setActivities}>
                    <PackageActivityPicker activities={packageActivities} value={activityChoice} onChange={setActivityChoice} partySize={adults} prices={activityPrices} />
                  </ActivityAddOnToggle>
                ) : (
                  <ActivityAddOnToggle checked={activities} onChange={setActivities} guests={activityGuests} onGuestsChange={setActivityGuests} maxGuests={adults} />
                )}
                {show("activities") && (
                  <p role="alert" className="mt-1.5 text-sm text-red-700">
                    {errors.activities}
                  </p>
                )}
              </div>
          </Section>
        )}

        <Section compact={compact} icon={Mail} title="Lead guest">
          <div className="space-y-4">
            <div {...(show("name") ? { "data-first-error": true } : {})}>
              <TextInput label="Full name" value={name} onChange={setName} autoComplete="name" status={status("name")} />
            </div>
            <div className={compact ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
              <div {...(show("email") ? { "data-first-error": true } : {})}>
                <TextInput label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" description={days.length === 2 ? "Both vouchers are sent here." : "Your vouchers are sent here."} status={status("email")} />
              </div>
              <div {...(show("phone") ? { "data-first-error": true } : {})}>
                <PhoneField label="Mobile phone" country={phoneCountry} onCountryChange={setPhoneCountry} value={phoneLocal} onChange={setPhoneLocal} description="For pickup-day updates." error={show("phone")} />
              </div>
            </div>
          </div>
        </Section>

        <Section compact={compact} icon={MapPin} title={isFourDay ? "Pickup & final drop-off" : "Pickup"}>
          <div className="space-y-4" {...(show("stop") || show("jasperPickup") || show("finalArea") || Object.keys(errors).some((k) => k.startsWith("stop_")) ? { "data-first-error": true } : {})}>
            {isFourDay && (
              <p className="text-sm text-slate-600">
                Your {outboundDays.map((i) => days[i].title).join(", ").replace(/, ([^,]*)$/, " and $1")} tours pick up from your accommodation in Banff or Canmore. {days[days.length - 1].title} picks up in Jasper.
              </p>
            )}
            {days.length > 1 && (
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-obsidian-900">
                <input
                  type="checkbox"
                  checked={samePickup}
                  onChange={(e) => setSamePickup(e.target.checked)}
                  className="h-4 w-4 rounded border-obsidian-900/20 text-ocean-700 focus:ring-ocean-500"
                />
                <span>
                  {isFourDay
                    ? `Same Banff or Canmore pickup for all ${["", "one", "two", "three", "four"][outboundDays.length] ?? outboundDays.length} tours`
                    : days.length === 2
                      ? "Same pickup for both tours"
                      : `Same pickup for all ${numberWord} tours`}
                </span>
              </label>
            )}

            {samePickup ? (
              <>
                {pickupStops.length > 0 && (
                  <Dropdown
                    label={banffCanmoreOnly ? "Pickup hotel in Banff or Canmore" : `Pickup hotel (Banff or Canmore)`}
                    labelClassName="mb-1.5 block text-sm text-obsidian-900"
                    options={pickupStops.map((s) => ({ value: s.id, label: s.name, description: `${s.town} · ${s.address}` }))}
                    value={stopId}
                    onChange={setStopId}
                    searchable
                    searchPlaceholder="Search hotels"
                    placeholder="Choose your hotel"
                    invalid={Boolean(show("stop"))}
                  />
                )}
                {vehicle && (
                  <TextInput
                    label="Staying somewhere else? (Canmore & Banff only)"
                    isOptional
                    value={customPickup}
                    onChange={setCustomPickup}
                    placeholder="Hotel name or address in Canmore or Banff"
                    description="Private tours only: custom pickup addresses are available in Canmore and Banff and require team confirmation."
                  />
                )}
                {show("stop") && (
                  <p role="alert" className="text-sm text-red-700">
                    {errors.stop}
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-5 pt-1">
                {days.map((day, i) =>
                  isFourDay && !outboundDays.includes(i) ? null : (
                  <div key={`tour-pickup-${day.title}-${i}`} className="rounded-xl border border-obsidian-900/10 bg-obsidian-50/50 p-4 space-y-3">
                    <p className="text-sm font-semibold text-obsidian-900">Pickup for {day.title}</p>
                    {pickupStops.length > 0 && (
                      <Dropdown
                        label={banffCanmoreOnly ? "Pickup hotel in Banff or Canmore" : "Pickup hotel"}
                        labelClassName="mb-1.5 block text-xs text-obsidian-900"
                        options={pickupStops.map((s) => ({ value: s.id, label: s.name, description: `${s.town} · ${s.address}` }))}
                        value={tourPickups[i]?.stopId ?? ""}
                        onChange={(val) =>
                          setTourPickups((prev) =>
                            prev.map((p, j) => (j === i ? { ...p, stopId: val } : p)),
                          )
                        }
                        searchable
                        searchPlaceholder="Search hotels"
                        placeholder="Choose your hotel"
                        invalid={Boolean(show(`stop_${i}`))}
                      />
                    )}
                    {vehicle && (
                      <TextInput
                        label="Staying somewhere else for this tour? (Canmore & Banff only)"
                        isOptional
                        value={tourPickups[i]?.customPickup ?? ""}
                        onChange={(val) =>
                          setTourPickups((prev) =>
                            prev.map((p, j) => (j === i ? { ...p, customPickup: val } : p)),
                          )
                        }
                        placeholder="Hotel name or address in Canmore or Banff"
                        description="Private tours only: Canmore and Banff addresses require team confirmation."
                      />
                    )}
                    {show(`stop_${i}`) && (
                      <p role="alert" className="text-sm text-red-700">
                        {errors[`stop_${i}`]}
                      </p>
                    )}
                  </div>
                  ),
                )}
              </div>
            )}

            {isFourDay && (
              <div className="mt-4 space-y-4 border-t border-obsidian-900/10 pt-4">
                <div className="space-y-2">
                  <TextInput
                    label={`Jasper accommodation (pickup for ${days[days.length - 1].title})`}
                    value={day4JasperPickup}
                    onChange={setDay4JasperPickup}
                    placeholder="Jasper hotel name or address"
                    description="You book this Jasper night yourself, after your Icefields-to-Jasper tour. Your driver-guide picks you up here the next morning."
                  />
                  {show("jasperPickup") && (
                    <p role="alert" className="text-sm text-red-700">
                      {errors.jasperPickup}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Dropdown
                    label="Final drop-off"
                    labelClassName="mb-1.5 block text-sm text-obsidian-900"
                    options={FINAL_DESTINATIONS.map((f) => ({ value: f.value, label: f.label, description: f.description }))}
                    value={finalArea}
                    onChange={(v) => setFinalArea(v as FinalArea)}
                    placeholder="Where should your journey finish?"
                    invalid={Boolean(show("finalArea"))}
                  />
                  <p className="text-sm text-slate-600">Banff, Canmore or Lake Louise is included. Calgary, including the airport, needs a separate arrangement at extra cost.</p>
                  {finalArea && isCalgary(finalArea) && (
                    <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="status">
                      Calgary drop-off is an extra-cost request: it isn&apos;t charged now. Our team confirms the price, route and flight timing with you before your trip.
                    </p>
                  )}
                  {finalArea && (
                    <TextInput
                      label={isCalgary(finalArea) ? "Calgary address or flight details" : "Final drop-off address"}
                      isOptional
                      value={finalAddress}
                      onChange={setFinalAddress}
                      placeholder={isCalgary(finalArea) ? "Hotel, address or flight number and time" : "Hotel name or address"}
                    />
                  )}
                  {show("finalArea") && (
                    <p role="alert" className="text-sm text-red-700">
                      {errors.finalArea}
                    </p>
                  )}
                </div>
                <p className="text-sm text-slate-600">
                  Luggage for your Jasper overnight is welcome: our vans normally fit one checked bag and personal items per guest, including a group of 14. Tell us about oversized items or extra bags in Special requests.
                </p>
              </div>
            )}

            <p className="text-sm text-slate-600">
              {hidePickupTimes
                ? `Pickup and drop-off are in Banff or Canmore. You can use a different confirmed address for each tour; untick the box above to enter them. We confirm your exact pickup time before each tour.`
                : "Pickups start at 7:30 AM in Canmore and 8:00 AM in Banff. We confirm your exact pickup time before each tour."}
            </p>
            <TextArea label="Special requests" isOptional rows={3} maxLength={500} value={requests} onChange={setRequests} placeholder={isFourDay ? "Luggage, dietary needs, mobility, celebrations…" : "Dietary needs, mobility, celebrations…"} />
          </div>
        </Section>

        <Section compact={compact} icon={Tag} title="Promo code">
          {appliedPromo ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-none bg-ocean-50 px-4 py-3 text-sm text-obsidian-900">
              <p role="status">
                {appliedPromo.message}
                {promoSaving > 0 ? ` You save ${cad(promoSaving / 100)}.` : ""}
              </p>
              <button type="button" onClick={() => setAppliedPromo(null)} className="min-h-11 text-ocean-700 underline underline-offset-2">
                Remove <span className="sr-only">promo code {appliedPromo.code}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <TextInput label="Promo code" isOptional value={promoInput} onChange={setPromoInput} placeholder="Enter your code" autoComplete="off" />
                </div>
                <Button label={applyingPromo ? "Checking…" : "Apply"} variant="secondary" isDisabled={!promoInput.trim() || applyingPromo} onClick={applyPromo} />
              </div>
              {promoError && (
                <p role="alert" className="text-sm text-red-700">
                  {promoError}
                </p>
              )}
            </div>
          )}
        </Section>
      </div>

      <aside className={compact ? "rounded-none bg-obsidian-950 p-5 text-white" : "rounded-none bg-obsidian-950 p-6 text-white sm:p-8 lg:sticky lg:top-[calc(var(--vc-header-h,80px)+24px)]"} aria-label="Your package">
        <p className="text-sm uppercase tracking-[0.22em] text-summit-300">{title}</p>
        <ul className="mt-5 space-y-4">
          {displayList.map((item) => (
            <li key={item.day.title} className="border-b border-white/10 pb-4">
              <p className="text-base font-medium text-white">
                {item.day.title}
              </p>
              <p className="text-sm text-white/70">
                {item.departure ? `${dayLabel(item.departure.date)} · ${timeLabel(item.departure.departureTime)}` : "Date not chosen yet"}
              </p>
              {item.departure && (
                <p className="mt-1 text-sm text-white/70">
                  {cad(item.line.fare / 100)} · {vehicle ? "per vehicle" : `${adults} adult${adults > 1 ? "s" : ""}${children > 0 ? `, ${children} youth` : ""}${infants > 0 ? `, ${infants} infant${infants > 1 ? "s" : ""}` : ""}`}
                </p>
              )}
            </li>
          ))}
        </ul>
        {allPicked ? (
          <dl className="mt-4 space-y-2 text-base">
            <div className="flex justify-between text-white/80">
              <dt>Regular subtotal</dt>
              <dd>{cad(fare / 100)}</dd>
            </div>
            {saving > 0 && (
              <div className="flex justify-between text-summit-200">
                <dt>10% package savings already applied</dt>
                <dd>−{cad(saving / 100)}</dd>
              </div>
            )}
            {withAirport && (
              <div className="flex justify-between text-white/80">
                <dt>{airportTransferSummaryLabel(airportTransfer, transferQuote)}</dt>
                <dd>{transferDollars != null ? cad(transferDollars) : guests > (transferPrices?.maxGuests ?? 12) ? "Confirmed by our team" : "Choose above"}</dd>
              </div>
            )}
            {chosenActivityList.map((a) => {
              const price = activityPriceOf(a.id);
              return (
                <div key={a.id} className="flex justify-between gap-4 text-white/80">
                  <dt>
                    {a.name} · {activityGuestsLabel(activityChoice[a.id]!)}
                  </dt>
                  <dd className="shrink-0 text-right">{price != null ? cad(price) : "Confirmed by our team"}</dd>
                </div>
              );
            })}
            {appliedPromo && promoSaving > 0 && (
              <div className="flex justify-between text-summit-200">
                <dt>Promo {appliedPromo.code}</dt>
                <dd>−{cad(promoSaving / 100)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-white/15 pt-3 text-xl font-light">
              <dt>Total</dt>
              <dd>{cad(total / 100)} CAD</dd>
            </div>
            {plan === "DEPOSIT" && (
              <>
                <div className="flex justify-between text-summit-200">
                  <dt>Due today ({DEPOSIT_PERCENT}% deposit)</dt>
                  <dd>{cad(depositNow)}</dd>
                </div>
                <div className="flex justify-between text-white/80">
                  <dt>Balance, by {balanceDueLabel}</dt>
                  <dd>{cad(total / 100 - depositNow)}</dd>
                </div>
              </>
            )}
            {chosenActivityList.some((a) => activityPriceOf(a.id) == null) && (
              <p className="text-sm text-white/70">Activities marked &ldquo;Confirmed by our team&rdquo; aren&apos;t charged now: we confirm their price with you before your trip.</p>
            )}
            <p className="text-sm text-white/60">Taxes, park admission and mandatory fees included.</p>
            {isFourDay && finalLabel && (
              <div className="flex justify-between gap-4 text-white/80">
                <dt className="shrink-0">Final drop-off</dt>
                <dd className="min-w-0 text-right">{isCalgary(finalLabel.value) ? `${finalLabel.label.replace(" (extra cost)", "")}: extra cost, confirmed by our team` : `${finalLabel.label}, included`}</dd>
              </div>
            )}
            {deadlineFrom && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3.5 text-xs text-white/80 space-y-1">
                <p className="font-semibold text-white">Cancellation deadline:</p>
                <p className="text-summit-200">{formatCancellationDeadline(deadlineFrom.date, deadlineFrom.time, cutoffHours)} (Alberta local time)</p>
                <p className="text-white/60">{cancellationNote}</p>
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-white/70">
            {vehicle ? `Choose a date for each tour to see your total.` : `Choose an available date for each tour to see your total with 10% savings.`}
          </p>
        )}

        {/* The 20% option needs every day 15+ days away; say so instead of leaving guests guessing. */}
        {depositAllowed && allPicked && total > 0 && !canDeposit && !awaiting && (
          <p className="mt-6 border border-white/20 p-3 text-sm text-white/75">
            Pay {DEPOSIT_PERCENT}% now is available when every tour day is at least 15 days away. For these dates, the full amount is paid at booking.
          </p>
        )}
        {depositAllowed && !allPicked && !awaiting && (
          <p className="mt-6 text-sm text-white/70">Choose your dates to see the option to pay {DEPOSIT_PERCENT}% now (tours 15+ days away).</p>
        )}
        {canDeposit && !awaiting && (
          <fieldset className="mt-6">
            <legend className="text-sm uppercase tracking-[0.18em] text-summit-300">How would you like to pay?</legend>
            <div className="mt-3 grid gap-3">
              {(
                [
                  { value: "FULL", title: `Pay in full · ${cad(total / 100)}`, detail: "Nothing more to pay before your trip." },
                  {
                    value: "DEPOSIT",
                    title: `Continue with ${DEPOSIT_PERCENT}% payment · ${cad(depositNow)}`,
                    detail: `Pay the rest, ${cad(total / 100 - depositNow)}, by ${balanceDueLabel} (7 days before your first tour day) from your vouchers. We email you a reminder.${vehicle ? ` The non-refundable ${DEPOSIT_PERCENT}% is of the total package price, whatever you have paid.` : ""}`,
                  },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer gap-3 p-3 ring-1 transition-colors ${plan === option.value ? "bg-white/10 ring-summit-300" : "ring-white/20 hover:bg-white/5"}`}
                >
                  <input
                    type="radio"
                    name="package-payment-plan"
                    value={option.value}
                    checked={plan === option.value}
                    onChange={() => setPaymentPlan(option.value)}
                    className="mt-1 h-4 w-4 shrink-0 accent-summit-500"
                  />
                  <span className="flex flex-col gap-1">
                    <span className="text-sm text-white">{option.title}</span>
                    <span className="text-sm text-white/70">{option.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="mt-6">
          {attempted && missingFieldList.length > 0 && (
            <div role="alert" className="mb-4 rounded-xl border border-red-500/40 bg-red-950/40 p-4 text-xs text-red-200">
              <p className="font-semibold text-white">Please complete the required details before payment:</p>
              <ul className="mt-1.5 list-disc pl-4 space-y-0.5 text-white/80">
                {missingFieldList.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {awaiting ? (
            confirming === "no" ? (
              stripeConfigured ? (
                <div className="rounded-2xl bg-white p-4 text-obsidian-900">
                  <StripeCheckoutForm clientSecret={awaiting.clientSecret} amountLabel={cad(awaiting.amount)} onPaid={() => waitForConfirmation(awaiting.bookings)} />
                </div>
              ) : (
                <Banner status="warning" title="Card payments aren't set up on this site yet" description="Please contact us to finish this booking." />
              )
            ) : (
              <p className="text-base text-white/85" aria-live="polite">
                {confirming === "yes"
                  ? `Payment received. Confirming ${dayWord}…`
                  : "Your payment went through and we're still confirming. You'll get your vouchers by email shortly; there's no need to pay again."}
              </p>
            )
          ) : (
            <Button
              label={submitting ? "Booking your dates…" : !allPicked ? "Select tour dates to continue" : "Continue to payment"}
              variant="primary"
              width="100%"
              isDisabled={!allPicked || submitting}
              isLoading={submitting}
              onClick={submit}
            />
          )}
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          )}
          <div className="mt-4 space-y-2 text-sm text-white/75">
            <p className="flex items-start gap-2">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-summit-300" aria-hidden="true" />
              <span>
                One secure payment for {tourWord}, with {discountPercent}% savings already included. {cancellationNote}
              </span>
            </p>
            <p className="pl-6 text-xs leading-relaxed text-white/60">
              {vehicle
                ? `Your private tours run for your group alone: none of ${tourWord === "both tours" ? "them" : `your ${numberWord} tours`} is cancelled for minimum passenger numbers.`
                : "Neither booked day will be cancelled because of minimum passenger numbers."}{" "}
              Weather, road closures or other events beyond our control may still affect departures. Meals and accommodation are not included.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Section({ icon: Icon, title, children, compact = false }: { icon: typeof Users; title: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <section className={compact ? "rounded-none bg-white p-4 ring-1 ring-obsidian-900/[0.07]" : "rounded-none bg-white p-5 ring-1 ring-obsidian-900/[0.07] sm:p-7"}>
      <h2 className="mb-4 flex items-center gap-2.5 text-xl font-light text-obsidian-900">
        <Icon className="h-5 w-5 text-ocean-600" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  );
}
