"use client";

// Interactive booking flow for multi-day private tours (Three-Day Rockies Discovery,
// Four-Day Rockies & Jasper). Replaces contact/request forms with the actual booking process.
// Allows guests to select each day's date independently without forcing consecutive dates.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Lock,
  MapPin,
  Plane,
  Sparkles,
  Users,
} from "lucide-react";
import { openDatePicker } from "@/lib/utils/datePicker";
import { PhoneField } from "@/components/forms/PhoneField";
import { dialCode } from "@/lib/countries";
import {
  AirportTransferToggle,
  AirportTransferDetails,
  EMPTY_AIRPORT_TRANSFER,
  type AirportTransferValue,
} from "@/components/booking/AirportTransferFields";

export interface MultiDayBookingPanelProps {
  packageSlug: string;
  title: string;
  dayCount: number;
  dayLabels?: string[];
  summerDayPrice?: number; // e.g. 1575
  winterDayPrice?: number; // e.g. 1240
}

const FIELD =
  "h-12 w-full rounded-xl border border-white/20 bg-white/10 px-3.5 text-sm text-white placeholder:text-white/40 focus:border-summit-400 focus:outline-none focus:ring-2 focus:ring-summit-400/30";

export function MultiDayBookingPanel({
  packageSlug,
  title,
  dayCount,
  dayLabels = [],
  summerDayPrice = 1575,
  winterDayPrice = 1240,
}: MultiDayBookingPanelProps) {
  const today = new Date().toISOString().slice(0, 10);

  const [guests, setGuests] = useState(2);
  const [dates, setDates] = useState<string[]>(Array.from({ length: dayCount }, () => ""));
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("CA");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");

  const [airport, setAirport] = useState(false);
  const [airportTransfer, setAirportTransfer] = useState<AirportTransferValue>(EMPTY_AIRPORT_TRANSFER);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ reference: string; total: number; dates: string[] } | null>(null);

  const handleDateChange = (index: number, newDate: string) => {
    setDates((prev) => {
      const next = [...prev];
      next[index] = newDate;
      return next;
    });
  };

  // Determine season and rate based on Day 1 date (Summer: June 1 to October 10)
  const isSummer = useMemo(() => {
    const d1 = dates[0];
    if (!d1) return true;
    const md = d1.slice(5, 10);
    return md >= "06-01" && md <= "10-10";
  }, [dates]);

  const dailyRate = isSummer ? summerDayPrice : winterDayPrice;
  const tourTotal = dailyRate * dayCount;
  const airportTotal = airport && guests >= 2 ? (guests <= 6 ? 364 : 850) : 0;
  const grandTotal = tourTotal + airportTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate inputs
    for (let i = 0; i < dayCount; i++) {
      if (!dates[i]) {
        setError(`Please select a date for Day ${i + 1}.`);
        return;
      }
    }
    // Check duplicate dates
    const uniqueDates = new Set(dates);
    if (uniqueDates.size !== dates.length) {
      setError("Please choose a different date for each day of the tour.");
      return;
    }

    if (!customerName.trim() || customerName.trim().length < 2) {
      setError("Please enter the lead guest's full name.");
      return;
    }
    if (!customerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customerEmail.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!phoneLocal.trim() || phoneLocal.replace(/\D/g, "").length < 6) {
      setError("Please enter a mobile phone number.");
      return;
    }
    if (!pickupLocation.trim()) {
      setError("Please enter your accommodation or pickup location.");
      return;
    }

    setSubmitting(true);
    try {
      const phone = `+${dialCode(phoneCountry)} ${phoneLocal.trim()}`;
      const payload = {
        packageSlug,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: phone,
        customerCountry: phoneCountry,
        pickupCustomText: pickupLocation.trim(),
        partySize: guests,
        dates,
        airportTransfer: airport && guests >= 2 ? airportTransfer : undefined,
        specialRequests: specialRequests.trim() || undefined,
      };

      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payload.customerName,
          email: payload.customerEmail,
          phone: payload.customerPhone,
          tourSlug: packageSlug,
          date: dates.join(", "),
          guests,
          message: [
            `Multi-Day Private Tour Booking: ${title}`,
            `Dates: ${dates.map((d, i) => `Day ${i + 1}: ${d}`).join("; ")}`,
            `Guests: ${guests} (Private vehicle)`,
            `Pickup: ${payload.pickupCustomText}`,
            airport ? `Airport Transfer: Yes (${airportTransfer.area || "Banff"}, Arrival: ${airportTransfer.arrivalDate} ${airportTransfer.arrivalTime})` : "Airport Transfer: No",
            payload.specialRequests ? `Special Requests: ${payload.specialRequests}` : "",
            `Calculated Total: CAD $${grandTotal.toLocaleString()}`,
          ]
            .filter(Boolean)
            .join("\n"),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "We couldn't submit your booking. Please try again.");
      }

      setConfirmed({
        reference: `VC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        total: grandTotal,
        dates,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmed) {
    return (
      <div className="rounded-none bg-emerald-950/80 p-6 sm:p-8 text-white border border-emerald-500/40">
        <div className="flex items-center gap-3 text-emerald-400">
          <CheckCircle2 className="h-7 w-7 shrink-0" />
          <h3 className="text-2xl font-light">Booking Request Confirmed!</h3>
        </div>
        <p className="mt-3 text-sm text-emerald-100">
          Thank you, <strong className="text-white">{customerName}</strong>. Your reservation request for the{" "}
          <strong className="text-white">{title}</strong> has been received.
        </p>

        <div className="mt-6 divide-y divide-white/10 rounded-xl bg-white/5 p-4 text-sm">
          <div className="flex justify-between py-2">
            <span className="text-white/70">Reference:</span>
            <span className="font-mono font-medium text-summit-300">{confirmed.reference}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-white/70">Selected Dates:</span>
            <span className="text-right text-white">
              {confirmed.dates.map((d, i) => (
                <span key={d} className="block">
                  Day {i + 1}: {d}
                </span>
              ))}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-white/70">Guests:</span>
            <span className="text-white">{guests} (Private vehicle)</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-white/70">Pickup:</span>
            <span className="text-white">{pickupLocation}</span>
          </div>
          <div className="flex justify-between py-2 font-medium">
            <span className="text-white/90">Total (Taxes included):</span>
            <span className="text-summit-300">CAD ${confirmed.total.toLocaleString()}</span>
          </div>
        </div>

        <p className="mt-5 text-xs leading-relaxed text-emerald-200/80">
          We have sent a confirmation email with your booking summary to <strong className="text-white">{customerEmail}</strong>.
          Our operations team will verify your private vehicle schedule and contact you with final voucher details.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header & Pricing */}
      <div className="border-b border-white/10 pb-5">
        <span className="text-xs uppercase tracking-[0.2em] text-summit-300">Instant Booking</span>
        <h3 className="mt-1 text-2xl font-light text-white">{title}</h3>
        <p className="mt-3 flex items-baseline gap-2 text-white">
          <span className="text-xs text-white/60">From</span>
          <span className="text-3xl font-light tabular-nums text-white">
            CAD ${tourTotal.toLocaleString()}
          </span>
          <span className="text-xs text-white/70">({dayCount} days)</span>
        </p>
        <p className="mt-1 text-xs text-white/60">
          CAD ${dailyRate.toLocaleString()} per day / vehicle · Private, up to 13 guests.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2 text-[0.7rem] text-white/75">
          <span className="rounded bg-white/10 px-2 py-0.5">
            Summer (Jun 1–Oct 10): ${summerDayPrice}/day
          </span>
          <span className="rounded bg-white/10 px-2 py-0.5">
            Winter (Oct 11–May 31): ${winterDayPrice}/day
          </span>
        </div>
      </div>

      {/* Guest Party Size */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-summit-300 font-medium mb-1.5">
          Group Size (Private Vehicle)
        </label>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-white/20 bg-white/10 p-1">
            <button
              type="button"
              disabled={guests <= 1}
              onClick={() => setGuests((g) => Math.max(1, g - 1))}
              className="h-10 w-10 flex items-center justify-center rounded-lg text-lg text-white hover:bg-white/10 disabled:opacity-30"
              aria-label="Decrease guests"
            >
              −
            </button>
            <span className="w-12 text-center text-base font-medium text-white">{guests}</span>
            <button
              type="button"
              disabled={guests >= 13}
              onClick={() => setGuests((g) => Math.min(13, g + 1))}
              className="h-10 w-10 flex items-center justify-center rounded-lg text-lg text-white hover:bg-white/10 disabled:opacity-30"
              aria-label="Increase guests"
            >
              +
            </button>
          </div>
          <span className="text-xs text-white/70">Private, up to 13 guests</span>
        </div>
      </div>

      {/* Manual Independent Day-by-Day Date Selection */}
      <div className="space-y-3.5">
        <label className="block text-xs uppercase tracking-wider text-summit-300 font-medium">
          Select Each Day&apos;s Date (Custom / Non-Consecutive Allowed)
        </label>
        <p className="text-xs text-white/65">
          Choose your preferred date for each day individually. Dates do not have to be consecutive.
        </p>

        <div className="grid gap-3 sm:grid-cols-1">
          {Array.from({ length: dayCount }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/15 bg-white/5 p-3">
              <span className="block text-xs font-medium text-white mb-1.5">
                {dayLabels[i] ?? `Day ${i + 1}`}
              </span>
              <div className="relative">
                <input
                  type="date"
                  required
                  min={today}
                  value={dates[i]}
                  onChange={(e) => handleDateChange(i, e.target.value)}
                  onClick={openDatePicker}
                  onFocus={openDatePicker}
                  className={`${FIELD} [color-scheme:dark]`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Airport Transfer: available only for 2+ guests */}
      {guests >= 2 && (
        <div className="rounded-xl border border-white/15 bg-white/5 p-4 space-y-3">
          <AirportTransferToggle checked={airport} onChange={setAirport} />
          {airport && (
            <AirportTransferDetails
              value={airportTransfer}
              onChange={setAirportTransfer}
            />
          )}
        </div>
      )}

      {/* Lead Guest Contact Information */}
      <div className="space-y-3 pt-2">
        <label className="block text-xs uppercase tracking-wider text-summit-300 font-medium">
          Lead Guest Details
        </label>
        <div>
          <input
            type="text"
            required
            placeholder="Full Name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <input
            type="email"
            required
            placeholder="Email Address"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className={FIELD}
          />
        </div>
        <div className="text-obsidian-900">
          <PhoneField
            label=""
            country={phoneCountry}
            onCountryChange={setPhoneCountry}
            value={phoneLocal}
            onChange={setPhoneLocal}
            heightClass="h-12"
            roundedClass="rounded-xl"
          />
        </div>
        <div>
          <input
            type="text"
            required
            placeholder="Pickup Hotel or Address (Banff / Canmore / Lake Louise)"
            value={pickupLocation}
            onChange={(e) => setPickupLocation(e.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <textarea
            placeholder="Special requests or notes (optional)"
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            className={`${FIELD} h-20 py-2.5 resize-none`}
          />
        </div>
      </div>

      {/* Summary Total */}
      <div className="rounded-xl bg-white/5 p-4 border border-white/10 text-sm space-y-2">
        <div className="flex justify-between text-white/80">
          <span>
            {dayCount} Days Private Tour ({guests} {guests === 1 ? "guest" : "guests"}):
          </span>
          <span className="font-medium text-white">CAD ${tourTotal.toLocaleString()}</span>
        </div>
        {airport && guests >= 2 && (
          <div className="flex justify-between text-white/80">
            <span>Calgary Airport Transfer (both ways):</span>
            <span className="font-medium text-white">CAD ${airportTotal.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-white/10 pt-2 text-base font-semibold text-white">
          <span>Total:</span>
          <span className="text-summit-300">CAD ${grandTotal.toLocaleString()}</span>
        </div>
        <p className="text-[0.7rem] text-white/60">
          Taxes and park admission included. Doorstep pickup in Banff, Canmore, or Lake Louise.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/50 bg-red-950/70 p-3 text-xs text-red-200" role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="golden-summit-btn flex h-13 w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-medium uppercase tracking-[0.14em] text-obsidian-900 shadow-xl transition-all hover:scale-[1.01] disabled:opacity-60"
      >
        <Lock className="h-4 w-4" />
        {submitting ? "Booking…" : "Book This Private Tour"}
      </button>

      <p className="text-center text-xs text-white/60">
        Free cancellation up to 72 hours before departure. Guaranteed vehicle reservation.
      </p>
    </form>
  );
}
