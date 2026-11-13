"use client";

// Checkout inside the AI concierge chat (owner, 2026-11-11: "keep the entire experience inside the
// AI Concierge"). It is a compact version of the /book checkout and talks to the same endpoints,
// so prices, seat holds (with the Bókun seat check), Stripe payment, confirmation email, PDF voucher
// and Bókun sync all run through the website's existing booking logic:
//   GET    /api/departures/checkout   departure, live seats, prices, pickup stops
//   GET    /api/reservations/hold      adopt a hold the concierge placed
//   POST   /api/reservations/hold      hold seats for 10 minutes (Bókun seats checked)
//   DELETE /api/reservations/hold      release a hold whose party size changed
//   POST   /api/bookings               booking (PENDING_PAYMENT) + Stripe PaymentIntent, Idempotency-Key
//   GET    /api/bookings?ref=&t=       poll until Stripe's webhook has confirmed it
// The booking is only confirmed by the server once Stripe reports the payment; card details go
// straight from the browser to Stripe (Payment Element), never to Vista Chase or the concierge.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock, Download, Loader2, Lock, Mail, MapPin, ShieldCheck, Ticket, Users } from "lucide-react";
import { QuantityInput } from "@/components/forms/QuantityInput";
import { PhoneField } from "@/components/forms/PhoneField";
import { Dropdown } from "@/components/forms/Dropdown";
import { StripeCheckoutForm } from "@/components/booking/StripeCheckoutForm";
import { dialCode } from "@/lib/countries";
import { moneyExact } from "@/lib/pricing";

type Stop = { id: string; name: string; town: string; address: string };
type Departure = {
  id: string;
  date: string;
  departureTime: string;
  capacityTotal: number;
  seatsAvailable: number;
  bookable?: boolean;
  notBookableReason?: string | null;
  price: number;
  childPrice: number | null;
  infantPrice: number | null;
  currency: string;
  tour?: { title: string; category: string } | null;
  shuttleRoute?: { name: string } | null;
};
type Booking = { bookingReference: string; voucherToken?: string; voucherUrl?: string; voucherCode?: string; status?: string; totalAmount?: number; qrCodeUrl?: string | null };

export interface ConciergeCheckoutProps {
  departureId: string;
  /** Website name of the tour (the database title can be an old one). */
  title?: string;
  holdToken?: string;
  pickupStopId?: string;
  guests?: number;
  customerName?: string;
  customerEmail?: string;
  /** Tells the chat the booking is confirmed (the concierge can mention it). */
  onConfirmed?: (bookingReference: string) => void;
}

const HOLD_SECONDS = 600;
const round2 = (n: number) => Math.round(n * 100) / 100;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const INPUT = "h-10 w-full rounded-lg border border-obsidian-900/15 bg-white px-3 text-sm text-obsidian-900 focus-visible:border-ocean-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600/30";
const PRIMARY = "golden-summit-btn flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm disabled:opacity-60";
const SECONDARY = "inline-flex h-11 items-center justify-center rounded-full border border-obsidian-900/15 px-4 text-sm text-obsidian-900 hover:bg-obsidian-50";

const shortDate = (d: string) => {
  const p = new Date(`${d}T00:00:00`);
  return Number.isNaN(p.getTime()) ? d : p.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
};
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

type Step = "party" | "details" | "review" | "pay" | "confirming" | "confirmed";

export function ConciergeCheckout(props: ConciergeCheckoutProps) {
  const { departureId, onConfirmed } = props;
  const [dep, setDep] = useState<Departure | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState<Step>("party");

  const [adults, setAdults] = useState(Math.max(1, props.guests ?? 2));
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [pickupStopId, setPickupStopId] = useState(props.pickupStopId ?? "");
  const [customPickup, setCustomPickup] = useState("");
  const [name, setName] = useState(props.customerName ?? "");
  const [email, setEmail] = useState(props.customerEmail ?? "");
  const [phoneCountry, setPhoneCountry] = useState("CA");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [requests, setRequests] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [hold, setHold] = useState<{ token: string; seats: number; expiresAt: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [payment, setPayment] = useState<{ booking: Booking; clientSecret: string; amount: number } | null>(null);
  const [confirmed, setConfirmed] = useState<Booking | null>(null);
  const idempotencyKey = useRef("");

  const isVehicle = dep?.tour?.category === "PRIVATE";
  const title = props.title || dep?.tour?.title || dep?.shuttleRoute?.name || "Your Vista Chase trip";

  // Departure, prices, live seats and pickup stops: the same data the /book page uses.
  const load = useCallback(async () => {
    const res = await fetch(`/api/departures/checkout?departureId=${encodeURIComponent(departureId)}`).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (!data?.departure || data.departure.id !== departureId) {
      setLoadError("This departure couldn't be loaded. Please ask me for other dates.");
      return null;
    }
    setDep(data.departure);
    setStops((data.stops ?? []).map((s: Stop) => ({ id: s.id, name: s.name, town: s.town, address: s.address })));
    return data.departure as Departure;
  }, [departureId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Adopt the hold the concierge placed (its seats and remaining time).
  useEffect(() => {
    if (!props.holdToken) return;
    fetch(`/api/reservations/hold?token=${encodeURIComponent(props.holdToken)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.active && data.hold) {
          setHold({ token: data.hold.holdToken, seats: data.hold.seatsCount, expiresAt: Date.parse(data.hold.expiresAt) });
          if (!data.hold.isVehicle) setAdults(Math.max(1, data.hold.seatsCount));
          if (data.hold.customerName) setName((v) => v || data.hold.customerName);
          if (data.hold.customerEmail) setEmail((v) => v || data.hold.customerEmail);
        }
      })
      .catch(() => undefined);
  }, [props.holdToken]);

  useEffect(() => {
    if (!hold) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hold]);

  const remaining = hold ? Math.max(0, Math.round((hold.expiresAt - now) / 1000)) : 0;
  useEffect(() => {
    if (hold && remaining === 0 && step !== "pay" && step !== "confirming" && step !== "confirmed") {
      setHold(null);
      setNotice("Your 10-minute seat hold ended. Seats are held again when you continue to payment.");
    }
  }, [hold, remaining, step]);

  // Same pricing rules as the server and the /book page (it recomputes and charges its own total).
  const childPrice = dep?.childPrice ?? dep?.price ?? 0;
  const infantsPay = !isVehicle && dep?.infantPrice != null;
  const seats = adults + children + (infantsPay ? infants : 0);
  const total = useMemo(() => {
    if (!dep) return 0;
    if (isVehicle) return dep.price;
    return round2(dep.price * adults + childPrice * children + (infantsPay ? (dep.infantPrice ?? 0) * infants : 0));
  }, [dep, isVehicle, adults, children, infants, childPrice, infantsPay]);
  const capacity = dep ? (isVehicle ? dep.capacityTotal : dep.seatsAvailable + (hold?.seats ?? 0)) : 0;
  const selectedStop = stops.find((s) => s.id === pickupStopId);

  const checkParty = () => {
    if (!dep) return false;
    if (dep.bookable === false) {
      setNotice(dep.notBookableReason || "This departure can't be booked online.");
      return false;
    }
    if (adults + children + infants > capacity) {
      setNotice(capacity > 0 ? `Only ${capacity} seat${capacity === 1 ? " is" : "s are"} left on this departure.` : "This departure is sold out.");
      return false;
    }
    setNotice("");
    return true;
  };

  const checkDetails = () => {
    const e: Record<string, string> = {};
    if (!pickupStopId && !customPickup.trim()) e.pickup = "Choose your pickup hotel.";
    if (name.trim().length < 2) e.name = "Enter the lead guest's full name.";
    if (!EMAIL.test(email.trim())) e.email = "Enter a valid email address.";
    if (phoneLocal.replace(/\D/g, "").length < 6) e.phone = "Enter a mobile number.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const releaseHold = async (token: string) => {
    await fetch(`/api/reservations/hold?token=${encodeURIComponent(token)}`, { method: "DELETE" }).catch(() => undefined);
  };

  // A hold that covers this party, placed (or re-placed after a party change) right before booking.
  const ensureHold = async (): Promise<string | null> => {
    const partyMatches = hold && (isVehicle || hold.seats === seats);
    if (hold && partyMatches && hold.expiresAt - Date.now() > 15_000) return hold.token;
    if (hold) await releaseHold(hold.token);
    const res = await fetch("/api/reservations/hold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departureId, seatsCount: seats, customerName: name.trim(), customerEmail: email.trim(), customerPhone: phone }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    if (!res?.ok || !data?.success) {
      setHold(null);
      setNotice(data?.error || "We couldn't hold these seats. Please try again.");
      void load();
      return null;
    }
    setHold({ token: data.holdToken, seats: data.seatsHeld ?? seats, expiresAt: Date.parse(data.expiresAt) || Date.now() + HOLD_SECONDS * 1000 });
    return data.holdToken as string;
  };

  const phone = phoneLocal.trim() ? `+${dialCode(phoneCountry)} ${phoneLocal.trim()}` : "";

  const waitForConfirmation = async (booking: Booking) => {
    setStep("confirming");
    for (let i = 0; i < 40; i += 1) {
      await new Promise((r) => setTimeout(r, 1500));
      const res = await fetch(`/api/bookings?ref=${encodeURIComponent(booking.bookingReference)}&t=${booking.voucherToken ?? ""}`).catch(() => null);
      const data = res?.ok ? await res.json().catch(() => null) : null;
      const status = data?.booking?.status as string | undefined;
      if (status === "CONFIRMED" || status === "PAID_UNSYNCED") {
        const done = {
          ...booking,
          ...data.booking,
          voucherUrl: data.booking?.voucherUrl || booking.voucherUrl,
          voucherToken: data.booking?.voucherToken || booking.voucherToken,
        };
        setConfirmed(done);
        setStep("confirmed");
        onConfirmed?.(booking.bookingReference);
        return;
      }
      if (status === "CANCELLED" || status === "EXPIRED") {
        idempotencyKey.current = "";
        setPayment(null);
        setStep("review");
        setNotice("The payment didn't complete, so the booking was released and you weren't charged. Please try again.");
        return;
      }
    }
    // Paid, but Stripe's confirmation hasn't reached us yet: the email follows when it does.
    setConfirmed({ ...booking, status: "PROCESSING" });
    setStep("confirmed");
  };

  const book = async () => {
    if (busy) return; // one submission at a time
    setBusy(true);
    setNotice("");
    try {
      const token = await ensureHold();
      if (!token) return;
      if (!idempotencyKey.current) idempotencyKey.current = newKey();
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey.current },
        body: JSON.stringify({
          departureId,
          holdToken: token,
          customerName: name.trim(),
          customerEmail: email.trim(),
          customerPhone: phone,
          customerCountry: phoneCountry,
          pickupStopId: pickupStopId || undefined,
          pickupCustomText: customPickup.trim() || undefined,
          adultsCount: adults,
          childrenCount: children,
          infantsCount: infants,
          specialRequests: [requests.trim(), "Booked through the AI concierge chat."].filter(Boolean).join("\n"),
          paymentPlan: "FULL",
        }),
      }).catch(() => null);
      const data = res ? await res.json().catch(() => null) : null;
      if (!res?.ok || !data?.success) {
        if (res?.status !== 429) idempotencyKey.current = "";
        setNotice(data?.error || "We couldn't reach the booking system. Please try again.");
        return;
      }
      setHold(null); // the booking now owns the seats
      if (data.payment?.clientSecret) {
        setPayment({ booking: data.booking, clientSecret: data.payment.clientSecret, amount: data.payment.amount });
        setStep("pay");
      } else if (data.booking?.status === "CONFIRMED" || data.booking?.status === "PAID_UNSYNCED") {
        setConfirmed(data.booking);
        setStep("confirmed");
        onConfirmed?.(data.booking.bookingReference);
      } else {
        idempotencyKey.current = "";
        setNotice("This booking was released before payment completed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{loadError}</p>;
  if (!dep)
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-obsidian-900/10 bg-white p-4 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading checkout…
      </p>
    );

  const stepIndex = { party: 0, details: 1, review: 2, pay: 3, confirming: 3, confirmed: 4 }[step];
  const priceLine = isVehicle
    ? `Private vehicle, up to ${dep.capacityTotal} guests`
    : [
        `${adults} × ${moneyExact(dep.price)}${children || (infantsPay && infants) ? " (adult)" : ""}`,
        children ? `${children} × ${moneyExact(childPrice)} (youth)` : "",
        infantsPay && infants ? `${infants} × ${moneyExact(dep.infantPrice ?? 0)} (infant)` : "",
      ]
        .filter(Boolean)
        .join(" + ");

  return (
    <section aria-label="Book in chat" className="w-full rounded-2xl border border-summit-500/60 bg-white p-4 text-sm text-obsidian-900">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base leading-snug">{title}</p>
          <p className="mt-0.5 text-xs text-slate-600">
            {shortDate(dep.date)} · {dep.departureTime}
          </p>
        </div>
        {hold && step !== "confirmed" && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-summit-100 px-2.5 py-0.5 font-mono text-xs">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
            <span className="sr-only"> left on your seat hold</span>
          </span>
        )}
      </header>

      {step !== "confirmed" && (
        <ol className="mt-3 grid grid-cols-4 gap-1" aria-label="Checkout steps">
          {["Guests", "Details", "Review", "Pay"].map((label, i) => (
            <li key={label} className="min-w-0">
              <span className={`block h-1 rounded-full ${i <= stepIndex ? "bg-ocean-600" : "bg-obsidian-900/10"}`} />
              <span className={`mt-1 block truncate text-xs ${i === stepIndex ? "text-obsidian-900" : "text-slate-500"}`} aria-current={i === stepIndex ? "step" : undefined}>
                {label}
              </span>
            </li>
          ))}
        </ol>
      )}

      {notice && (
        <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
          {notice}
        </p>
      )}

      {step === "party" && (
        <div className="mt-4 space-y-3">
          <QuantityInput label="Adults" description="Age 16–99" value={adults} onChange={setAdults} min={1} max={Math.max(1, capacity - children - (infantsPay ? infants : 0))} />
          <QuantityInput label="Youth" description="Age 6–15" value={children} onChange={setChildren} min={0} max={Math.max(0, capacity - adults - (infantsPay ? infants : 0))} />
          <QuantityInput label="Infants" description={infantsPay ? "Age 0–5" : "Age 0–5 · free on a lap"} value={infants} onChange={setInfants} min={0} max={Math.max(0, capacity - adults - children)} />
          <button type="button" className={PRIMARY} onClick={() => checkParty() && setStep("details")}>
            Continue
          </button>
        </div>
      )}

      {step === "details" && (
        <div className="mt-4 space-y-3">
          {stops.length > 0 && (
            <div>
              <Dropdown
                label="Pickup hotel"
                labelClassName="mb-1.5 block text-sm text-obsidian-900"
                options={stops.map((s) => ({ value: s.id, label: s.name, description: `${s.town} · ${s.address}` }))}
                value={pickupStopId}
                onChange={(v) => {
                  setPickupStopId(v);
                  setCustomPickup("");
                }}
                searchable
                searchPlaceholder="Search hotels"
                placeholder="Choose your hotel"
              />
              {errors.pickup && <p role="alert" className="mt-1 text-xs text-red-700">{errors.pickup}</p>}
            </div>
          )}
          {isVehicle && (
            <label className="block">
              <span className="mb-1.5 block text-sm">Or your accommodation address (private tours)</span>
              <input className={INPUT} value={customPickup} onChange={(e) => { setCustomPickup(e.target.value); if (e.target.value) setPickupStopId(""); }} placeholder="Hotel name or address" />
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm">Lead guest full name</span>
            <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={Boolean(errors.name)} />
            {errors.name && <span role="alert" className="mt-1 block text-xs text-red-700">{errors.name}</span>}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm">Email (for your voucher)</span>
            <input className={INPUT} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={Boolean(errors.email)} />
            {errors.email && <span role="alert" className="mt-1 block text-xs text-red-700">{errors.email}</span>}
          </label>
          <PhoneField label="Mobile phone" country={phoneCountry} onCountryChange={setPhoneCountry} value={phoneLocal} onChange={setPhoneLocal} error={errors.phone} heightClass="h-10" />
          <label className="block">
            <span className="mb-1.5 block text-sm">Requests (optional)</span>
            <input className={INPUT} value={requests} onChange={(e) => setRequests(e.target.value)} placeholder="Dietary needs, child seats, celebrations…" maxLength={500} />
          </label>
          <div className="flex gap-2">
            <button type="button" className={SECONDARY} onClick={() => setStep("party")}>
              Back
            </button>
            <button type="button" className={PRIMARY} onClick={() => checkDetails() && setStep("review")}>
              Review booking
            </button>
          </div>
        </div>
      )}

      {(step === "review" || step === "pay" || step === "confirming") && (
        <div className="mt-4 space-y-3">
          <dl className="space-y-1.5 rounded-xl bg-obsidian-50 p-3">
            <Row icon={Users} label="Guests" value={[`${adults} adult${adults === 1 ? "" : "s"}`, children ? `${children} youth` : "", infants ? `${infants} infant${infants === 1 ? "" : "s"}` : ""].filter(Boolean).join(", ")} />
            <Row icon={MapPin} label="Pickup" value={selectedStop?.name ?? customPickup ?? ""} />
            <Row icon={Mail} label="Voucher to" value={email.trim()} />
            <div className="border-t border-obsidian-900/10 pt-2">
              <div className="flex justify-between gap-3 text-xs text-slate-600">
                <span>{priceLine}</span>
                <span className="shrink-0">{moneyExact(total)}</span>
              </div>
              <div className="flex justify-between gap-3 text-xs text-slate-600">
                <span>Taxes and required fees</span>
                <span className="shrink-0">Included</span>
              </div>
              <div className="mt-1 flex justify-between gap-3 text-base">
                <span>Total</span>
                <span>{moneyExact(payment?.amount ?? total)}</span>
              </div>
            </div>
          </dl>
          {step === "review" && (
            <>
              <p className="text-xs text-slate-600">
                By paying you accept our{" "}
                <a href="/terms-and-conditions" target="_blank" rel="noopener" className="underline">terms</a> and{" "}
                <a href="/privacy-policy-vista-chase" target="_blank" rel="noopener" className="underline">cancellation policy</a>.
              </p>
              <div className="flex gap-2">
                <button type="button" className={SECONDARY} onClick={() => setStep("details")} disabled={busy}>
                  Back
                </button>
                <button type="button" className={PRIMARY} onClick={book} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
                  Continue to payment
                </button>
              </div>
            </>
          )}
          {step === "pay" && payment && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs text-slate-600">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                Secure card payment by Stripe. Your card details never reach Vista Chase or this chat.
              </p>
              <StripeCheckoutForm clientSecret={payment.clientSecret} amountLabel={moneyExact(payment.amount)} onPaid={() => waitForConfirmation(payment.booking)} />
            </div>
          )}
          {step === "confirming" && (
            <p className="flex items-center gap-2 rounded-xl bg-ocean-50 p-3 text-sm" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Confirming your payment… please keep this chat open.
            </p>
          )}
        </div>
      )}

      {step === "confirmed" && confirmed && (
        <div className="mt-3 space-y-3" role="status">
          <p className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            {confirmed.status === "PROCESSING" ? "Payment received, confirming your booking" : "Booking confirmed"}
          </p>
          <div className="rounded-xl bg-obsidian-50 p-3">
            <p className="text-xs text-slate-600">Booking reference</p>
            <p className="font-mono text-lg">{confirmed.bookingReference}</p>
            {confirmed.voucherCode && <p className="mt-1 text-xs text-slate-600">Voucher code: <span className="font-mono">{confirmed.voucherCode}</span></p>}
          </div>
          <p className="text-xs text-slate-600">
            {confirmed.status === "PROCESSING"
              ? `Your confirmation email and PDF voucher will reach ${email.trim()} in a few minutes.`
              : `We've emailed your confirmation and PDF voucher to ${email.trim()}. Your guide confirms the exact pickup time the day before.`}
          </p>
          {confirmed.bookingReference && (() => {
            const voucherHref = confirmed.voucherUrl
              ? confirmed.voucherUrl.replace(/^https?:\/\/[^/]+/, "")
              : `/booking/${encodeURIComponent(confirmed.bookingReference)}/voucher${confirmed.voucherToken ? `?t=${encodeURIComponent(confirmed.voucherToken)}` : ""}`;
            // Same as the website's confirmation: the voucher (boarding pass) and its real PDF.
            const pdfHref = `/api/bookings/voucher.pdf?ref=${encodeURIComponent(confirmed.bookingReference)}${confirmed.voucherToken ? `&t=${encodeURIComponent(confirmed.voucherToken)}` : ""}`;
            return (
              <>
                {confirmed.qrCodeUrl && (
                  <div className="flex flex-col items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a data/remote QR image, as on the voucher page */}
                    <img src={confirmed.qrCodeUrl} alt="Boarding pass QR code" width={140} height={140} />
                    <p className="text-xs text-slate-600">Show this QR code or your voucher at pickup.</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <a
                    href={voucherHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="golden-summit-btn inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium"
                  >
                    <Ticket className="h-4 w-4" aria-hidden="true" />
                    View voucher
                  </a>
                  <a
                    href={pdfHref}
                    download={`vista-chase-voucher-${confirmed.bookingReference}.pdf`}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm text-ocean-700 ring-1 ring-obsidian-900/15 hover:bg-ocean-50"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Download PDF
                  </a>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </section>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-xs text-slate-600">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="min-w-0 text-right text-sm break-words">{value}</dd>
    </div>
  );
}
