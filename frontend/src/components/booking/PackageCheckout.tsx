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
import { CalendarDays, Check, Lock, Mail, MapPin, Users } from "lucide-react";
import { QuantityInput } from "@/components/forms/QuantityInput";
import { DepartureCalendar } from "@/components/booking/DepartureCalendar";
import {
  AirportTransferDetails,
  AirportTransferToggle,
  airportTransferError,
  airportTransferPrice,
  EMPTY_AIRPORT_TRANSFER,
  type AirportTransferValue,
} from "@/components/booking/AirportTransferFields";
import { ActivityAddOnToggle } from "@/components/booking/ActivityAddOnFields";
import { activityAddOnsRequestLine, activityGuestsFor, type ActivityGuests } from "@/lib/activityAddOns";
import { Dropdown } from "@/components/forms/Dropdown";
import { PhoneField } from "@/components/forms/PhoneField";
import { dialCode } from "@/lib/countries";
import { StripeCheckoutForm, stripeConfigured } from "@/components/booking/StripeCheckoutForm";
import { balanceDueDate, DEPOSIT_PERCENT, depositAvailable, depositFor, formatRockiesDate } from "@/lib/policy";

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

export interface PackageDay {
  title: string;
  label: string;
  /** Product page for the day. */
  href: string;
  departures: PackageDeparture[];
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

const SHARED_MAX_GUESTS = 12;

/** June 1 to October 10 (the summer season of the prices and discounts). */
const inSummer = (date: string) => {
  const md = date.slice(5, 10);
  return md >= "06-01" && md <= "10-10";
};

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
function dayCents(d: PackageDeparture | undefined, adults: number, children: number, infants: number, discountPercent: number, vehicle = false) {
  if (!d) return { fare: 0, discount: 0, total: 0 };
  const fare = vehicle
    ? Math.round(d.price * 100)
    : Math.round(d.price * 100) * adults +
      Math.round((d.childPrice ?? d.price) * 100) * children +
      (d.infantPrice != null ? Math.round(d.infantPrice * 100) * infants : 0);
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
  cancellationNote = "Each day can be cancelled for a full refund up to 24 hours before it starts.",
  depositAllowed = false,
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
}) {
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
  const [requests, setRequests] = useState("");
  // Private journeys: "Add-on activities" (owner, 2026-11-09), arranged by the team and paid separately.
  const [activities, setActivities] = useState(false);
  // Who joins the activities, with ages (owner, 2026-11-11); null until the guest changes it.
  const [activityGuestsPicked, setActivityGuests] = useState<ActivityGuests | null>(null);
  const [airport, setAirport] = useState(false);
  const [airportTransfer, setAirportTransfer] = useState<AirportTransferValue>(EMPTY_AIRPORT_TRANSFER);
  const [paymentPlan, setPaymentPlan] = useState<"FULL" | "DEPOSIT">("FULL");
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [awaiting, setAwaiting] = useState<{ bookings: BookingRef[]; clientSecret: string; amount: number } | null>(null);
  const [confirming, setConfirming] = useState<"no" | "yes" | "slow">("no");
  const [confirmed, setConfirmed] = useState<BookingRef[] | null>(null);
  const keyRef = useRef("");

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

  // A day's calendar offers the dates with room for the party that no other day has taken.
  const fitsDay = (i: number) => {
    const taken = new Set(chosen.filter((_, j) => j !== i).map((d) => d?.date.slice(0, 10)));
    return (d: PackageDeparture) => d.seatsAvailable >= seatsFor(d) && !taken.has(d.date.slice(0, 10));
  };

  const lines = chosen.map((d) => dayCents(d, adults, children, infants, discountOn(d?.date), vehicle));
  const fare = lines.reduce((n, l) => n + l.fare, 0);
  const saving = lines.reduce((n, l) => n + l.discount, 0);
  // The transfer: CAD 364 per transfer (owner, 2026-11-11), added to Day 1; never discounted.
  const transferDollars = withAirport ? airportTransferPrice(airportTransfer, guests) : null;
  const total = lines.reduce((n, l) => n + l.total, 0) + (transferDollars ?? 0) * 100;
  const allPicked = chosen.every(Boolean);
  // 20% deposit: each day's own deposit (the server rounds per day), when every day is 15+ days away.
  const canDeposit = depositAllowed && allPicked && total > 0 && chosen.every((d) => d && depositAvailable(d.date.slice(0, 10), d.departureTime));
  const plan = canDeposit ? paymentPlan : "FULL";
  const dayTotals = lines.map((l, i) => l.total / 100 + (i === 0 ? (transferDollars ?? 0) : 0));
  const depositNow = Math.round(dayTotals.reduce((n, t) => n + depositFor(t), 0) * 100) / 100;
  const firstDay = chosen.filter(Boolean).map((d) => d!).sort((a, b) => a.date.localeCompare(b.date))[0];
  const balanceDueLabel = firstDay ? formatRockiesDate(balanceDueDate(firstDay.date.slice(0, 10), firstDay.departureTime)) : "";
  const dayWord = days.length === 2 ? "both days" : `all ${days.length} days`;

  const phone = phoneLocal.trim() ? `+${dialCode(phoneCountry)} ${phoneLocal.trim()}` : "";
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    days.forEach((_, i) => {
      if (!picks[i]) e[`day${i}`] = "Choose a date for this tour.";
    });
    if (name.trim().length < 2) e.name = "Enter the lead guest's full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Enter a valid email address.";
    if (phoneLocal.replace(/\D/g, "").length < 6) e.phone = "Enter a mobile number for pickup-day updates.";
    if (!stopId && !customPickup.trim()) e.stop = "Choose your pickup hotel, or tell us where you're staying.";
    const transfer = withAirport ? airportTransferError(airportTransfer) : null;
    if (transfer) e.airport = transfer;
    const activityCount = activityGuests.adults + activityGuests.children + activityGuests.infants;
    if (vehicle && activities && (activityCount < 1 || activityCount > adults)) e.activities = `Choose 1 to ${adults} guests for the add-on activities.`;
    return e;
  }, [days, picks, name, email, phoneLocal, stopId, customPickup, withAirport, airportTransfer, vehicle, activities, activityGuests, adults]);
  const show = (k: string) => (attempted ? errors[k] : undefined);
  const status = (k: string) => (show(k) ? { type: "error" as const, message: errors[k] } : undefined);

  const submit = async () => {
    setAttempted(true);
    setError("");
    if (Object.keys(errors).length > 0) {
      document.querySelector("[data-first-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
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
          pickupCustomText: customPickup.trim() || undefined,
          adultsCount: adults,
          childrenCount: vehicle ? 0 : children,
          infantsCount: vehicle ? 0 : infants,
          specialRequests: [requests.trim(), vehicle && activities ? activityAddOnsRequestLine([], activityGuests) : ""].filter(Boolean).join("\n") || undefined,
          airportTransfer: withAirport ? { ...airportTransfer, area: airportTransfer.area || undefined } : undefined,
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
      <section className="mx-auto max-w-2xl rounded-none bg-white p-6 text-center ring-1 ring-obsidian-900/[0.07] sm:p-10" aria-live="polite">
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
                <span className="block text-sm uppercase tracking-[0.18em] text-ocean-700">Day {i + 1}</span>
                <span className="block text-base text-obsidian-900">{days[i].title}</span>
                <span className="block text-sm text-slate-600">
                  {chosen[i] ? `${dayLabel(chosen[i]!.date)} · ${timeLabel(chosen[i]!.departureTime)} · ` : ""}
                  {b.bookingReference}
                </span>
              </span>
              <a href={b.voucherUrl} className="inline-flex h-10 items-center rounded-full bg-obsidian-950 px-5 text-sm text-white hover:bg-obsidian-900">
                Open voucher
              </a>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12">
      <div className="space-y-6">
        <Section icon={Users} title="Who's coming">
          {vehicle ? (
            <>
              <div className="max-w-xs">
                <QuantityInput label="Guests" description="All ages, one private vehicle" value={adults} onChange={setAdults} min={1} max={MAX_GUESTS} />
              </div>
              <p className="mt-3 text-sm text-slate-600">Private, up to {MAX_GUESTS} guests. The price is per vehicle, whatever the group size.</p>
              {offersAirport && (
                <div className="mt-4 space-y-3" {...(show("airport") ? { "data-first-error": true } : {})}>
                  <AirportTransferToggle checked={airport} onChange={setAirport} />
                  {airport && <AirportTransferDetails value={airportTransfer} onChange={setAirportTransfer} error={show("airport")} />}
                </div>
              )}
              <div className="mt-3" {...(show("activities") ? { "data-first-error": true } : {})}>
                <ActivityAddOnToggle checked={activities} onChange={setActivities} guests={activityGuests} onGuestsChange={setActivityGuests} maxGuests={adults} />
                {show("activities") && (
                  <p role="alert" className="mt-1.5 text-sm text-red-700">
                    {errors.activities}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <QuantityInput label="Adults" description="Ages 16–99" value={adults} onChange={setAdults} min={1} max={MAX_GUESTS - children - infants} />
                <QuantityInput label="Youth" description="Ages 6–15" value={children} onChange={setChildren} min={0} max={MAX_GUESTS - adults - infants} />
                <QuantityInput label="Infants" description="Ages 0–5, take a seat" value={infants} onChange={setInfants} min={0} max={Math.min(4, MAX_GUESTS - adults - children)} />
              </div>
              <p className="mt-3 text-sm text-slate-600">Small groups on each tour, with more time with your guide.</p>
            </>
          )}
        </Section>

        <Section icon={CalendarDays} title="Choose your dates">
          <div className="space-y-6">
            <p className="text-sm text-slate-600">
              Pick the date you want for each day. They don&rsquo;t have to be in a row, but each day is a full-day tour, so every day needs its own date.
            </p>
            {days.map((day, i) => {
              const fits = fitsDay(i);
              const open = day.departures.some(fits);
              return (
                <div key={`${day.title}-${i}`} {...(show(`day${i}`) ? { "data-first-error": true } : {})}>
                  <p className="text-sm uppercase tracking-[0.18em] text-ocean-700">Day {i + 1}</p>
                  <p className="text-lg text-obsidian-900">
                    {day.title} <span className="text-sm text-slate-600">· {day.label}</span>
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
                        <Link href={requestHref} className="text-ocean-700 underline underline-offset-2">
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
                  <Link href={day.href} className="mt-1.5 inline-block text-sm text-ocean-700 underline underline-offset-2">
                    What this day includes
                  </Link>
                </div>
              );
            })}
            <p className="text-sm text-slate-600">Accommodation is not included.</p>
          </div>
        </Section>

        <Section icon={Mail} title="Lead guest">
          <div className="space-y-4">
            <div {...(show("name") ? { "data-first-error": true } : {})}>
              <TextInput label="Full name" value={name} onChange={setName} autoComplete="name" status={status("name")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div {...(show("email") ? { "data-first-error": true } : {})}>
                <TextInput label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" description={days.length === 2 ? "Both vouchers are sent here." : "Your vouchers are sent here."} status={status("email")} />
              </div>
              <div {...(show("phone") ? { "data-first-error": true } : {})}>
                <PhoneField label="Mobile phone" country={phoneCountry} onCountryChange={setPhoneCountry} value={phoneLocal} onChange={setPhoneLocal} description="For pickup-day updates." error={show("phone")} />
              </div>
            </div>
          </div>
        </Section>

        <Section icon={MapPin} title="Pickup">
          <div className="space-y-4" {...(show("stop") ? { "data-first-error": true } : {})}>
            {stops.length > 0 && (
              <Dropdown
                label={`Pickup hotel (same for ${dayWord})`}
                labelClassName="mb-1.5 block text-sm text-obsidian-900"
                options={stops.map((s) => ({ value: s.id, label: s.name, description: `${s.town} · ${s.address}` }))}
                value={stopId}
                onChange={setStopId}
                searchable
                searchPlaceholder="Search hotels"
                placeholder="Choose your hotel"
                invalid={Boolean(show("stop"))}
              />
            )}
            <TextInput label="Staying somewhere else?" isOptional value={customPickup} onChange={setCustomPickup} placeholder="Hotel name or address in Banff or Canmore" />
            {show("stop") && (
              <p role="alert" className="text-sm text-red-700">
                {errors.stop}
              </p>
            )}
            <p className="text-sm text-slate-600">Pickups start at 7:30 AM in Canmore and 8:00 AM in Banff. We confirm your exact pickup time before each tour.</p>
            <TextArea label="Special requests" isOptional rows={3} maxLength={500} value={requests} onChange={setRequests} placeholder="Dietary needs, mobility, celebrations…" />
          </div>
        </Section>
      </div>

      <aside className="rounded-none bg-obsidian-950 p-6 text-white sm:p-8 lg:sticky lg:top-[calc(var(--vc-header-h,80px)+24px)]" aria-label="Your package">
        <p className="text-sm uppercase tracking-[0.22em] text-summit-300">{title}</p>
        <ul className="mt-5 space-y-4">
          {days.map((day, i) => (
            <li key={day.title} className="border-b border-white/10 pb-4">
              <p className="text-base text-white">
                Day {i + 1}: {day.title}
              </p>
              <p className="text-sm text-white/70">{chosen[i] ? `${dayLabel(chosen[i]!.date)} · ${timeLabel(chosen[i]!.departureTime)}` : "Date not chosen yet"}</p>
              {chosen[i] && (
                <p className="mt-1 text-sm text-white/70">
                  {cad(lines[i].fare / 100)} {vehicle ? "per vehicle" : `for ${guests} ${guests === 1 ? "guest" : "guests"}`}
                </p>
              )}
            </li>
          ))}
        </ul>
        {allPicked ? (
          <dl className="mt-4 space-y-2 text-base">
            <div className="flex justify-between text-white/80">
              <dt>{days.length === 2 ? "Both tours" : `All ${days.length} days`}</dt>
              <dd>{cad(fare / 100)}</dd>
            </div>
            {saving > 0 && (
              <div className="flex justify-between text-summit-200">
                <dt>{vehicle ? "Package price" : `Package saving (${discountPercent}%)`}</dt>
                <dd>−{cad(saving / 100)}</dd>
              </div>
            )}
            {withAirport && (
              <div className="flex justify-between text-white/80">
                <dt>Calgary airport transfer</dt>
                <dd>{transferDollars != null ? cad(transferDollars) : "Confirmed by our team"}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-white/15 pt-3 text-xl">
              <dt>Total</dt>
              <dd>{cad(total / 100)}</dd>
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
            <p className="text-sm text-white/60">Taxes and park admission included.</p>
          </dl>
        ) : (
          <p className="mt-4 text-sm text-white/70">
            {vehicle ? `Choose a date for each day to see your total.` : `Choose both dates to see your total with ${discountPercent}% off.`}
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
                    detail: `Pay the rest, ${cad(total / 100 - depositNow)}, by ${balanceDueLabel} (14 days before each day) from your vouchers. We email you a reminder.`,
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
            <Button label={submitting ? "Booking your dates…" : "Continue to payment"} variant="primary" width="100%" isLoading={submitting} onClick={submit} />
          )}
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          )}
          <p className="mt-4 flex items-start gap-2 text-sm text-white/60">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {plan === "DEPOSIT" ? `One secure ${DEPOSIT_PERCENT}% deposit payment for ${dayWord}.` : `One secure payment for ${dayWord}.`} {cancellationNote}
          </p>
        </div>
      </aside>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Users; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-none bg-white p-5 ring-1 ring-obsidian-900/[0.07] sm:p-7">
      <h2 className="mb-4 flex items-center gap-2.5 text-xl font-light text-obsidian-900">
        <Icon className="h-5 w-5 text-ocean-600" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  );
}
