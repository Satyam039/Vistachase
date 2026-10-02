"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ShieldCheck,
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  CreditCard,
  QrCode,
  Coffee,
  ChevronRight,
  Lock,
} from "lucide-react";
import { useRouter } from "next/navigation";

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

export function BookingCheckoutClient({
  departure,
  stops,
  initialHoldToken,
}: {
  departure: DepartureData;
  stops: StopData[];
  initialHoldToken?: string;
}) {
  const router = useRouter();

  // Passengers
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);

  // Pickup
  const [pickupStopId, setPickupStopId] = useState(stops[0]?.id || "");
  const [customPickup, setCustomPickup] = useState("");

  // Add-ons
  const [addParkPass, setAddParkPass] = useState(false);
  const [addHotDrinks, setAddHotDrinks] = useState(false);
  const [addGourmetLunch, setAddGourmetLunch] = useState(false);

  // Guest Details
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");

  // Hold Timer State
  const [holdToken, setHoldToken] = useState(initialHoldToken || "");
  const [remainingSeconds, setRemainingSeconds] = useState(600);
  const [isHolding, setIsHolding] = useState(false);

  // Submission & Confirmation
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmedBooking, setConfirmedBooking] = useState<{
    bookingReference: string;
    voucherCode: string;
    totalAmount: number;
    currency: string;
    qrCodeUrl: string | null;
  } | null>(null);

  const totalSeats = adults + children;
  const isOverCapacity = totalSeats > departure.seatsAvailable;

  // Pricing
  const baseSubtotal = departure.price * totalSeats;
  const parkPassTotal = addParkPass ? 25.0 : 0.0;
  const hotDrinksTotal = addHotDrinks ? 15.0 * totalSeats : 0.0;
  const lunchTotal = addGourmetLunch ? 22.0 * totalSeats : 0.0;
  const addOnsTotal = parkPassTotal + hotDrinksTotal + lunchTotal;
  const tax = Math.round((baseSubtotal + addOnsTotal) * 0.05 * 100) / 100;
  const finalTotal = Math.round((baseSubtotal + addOnsTotal + tax) * 100) / 100;

  // Countdown timer for 10-minute hold
  useEffect(() => {
    if (!holdToken || remainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setHoldToken("");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [holdToken, remainingSeconds]);

  // Request 10-minute reservation hold
  const handleLockSeats = async () => {
    if (isOverCapacity) return;
    if (!customerName || !customerEmail) {
      setErrorMsg("Please enter your name and email above to place the 10-minute seat hold.");
      return;
    }
    setErrorMsg("");
    setIsHolding(true);

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
        setErrorMsg(data.error || "Failed to place reservation hold");
      } else {
        setHoldToken(data.holdToken);
        setRemainingSeconds(data.remainingSeconds || 600);
      }
    } catch {
      setErrorMsg("Network error placing reservation hold");
    } finally {
      setIsHolding(false);
    }
  };

  // Submit Final Booking
  const handleCompleteBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerEmail) {
      setErrorMsg("Please provide your name and email address.");
      return;
    }
    setErrorMsg("");
    setLoading(true);

    const addOnsPayload = [];
    if (addParkPass) addOnsPayload.push({ name: "Parks Canada Discovery Pass Assistance", price: 25.0, quantity: 1 });
    if (addHotDrinks) addOnsPayload.push({ name: "Hot Drink & Morning Pastry Package", price: 15.0, quantity: totalSeats });
    if (addGourmetLunch) addOnsPayload.push({ name: "Gourmet Rockies Packed Lunch", price: 22.0, quantity: totalSeats });

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departureId: departure.id,
          holdToken: holdToken || undefined,
          customerName,
          customerEmail,
          customerPhone: customerPhone || "+1-555-0192",
          pickupStopId,
          pickupCustomText: customPickup || undefined,
          adultsCount: adults,
          childrenCount: children,
          infantsCount: infants,
          specialRequests,
          addOns: addOnsPayload,
          paymentProvider: "mock",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Booking failed");
      } else {
        setConfirmedBooking(data.booking);
      }
    } catch {
      setErrorMsg("Error communicating with checkout server");
    } finally {
      setLoading(false);
    }
  };

  const selectedStop = stops.find((s) => s.id === pickupStopId);
  const experienceTitle = departure.tour?.title || departure.shuttleRoute?.name || "Canadian Rockies Tour";

  // If confirmed, show confirmation view
  if (confirmedBooking) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 sm:px-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-8 sm:p-12 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="text-xs uppercase tracking-widest font-bold text-emerald-700">Reservation Confirmed</span>
            <h1 className="text-3xl font-bold font-display text-forest-950">
              You&apos;re Heading to the Rockies!
            </h1>
            <p className="text-slate-600 text-sm max-w-md mx-auto">
              Your booking is approved and your digital boarding voucher has been issued. A confirmation email has been dispatched to <strong>{customerEmail}</strong>.
            </p>
          </div>

          {/* Reference Card */}
          <div className="p-6 rounded-2xl bg-forest-50 border border-gold-400/40 text-left space-y-4 max-w-lg mx-auto">
            <div className="flex justify-between items-center border-b border-forest-100 pb-3">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase">Booking Reference</span>
                <p className="text-xl font-bold font-mono text-forest-950">{confirmedBooking.bookingReference}</p>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Voucher Code</span>
                <p className="text-base font-bold font-mono text-gold-600">{confirmedBooking.voucherCode}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs text-slate-700">
              <div>
                <span className="text-slate-500">Date:</span>
                <p className="font-semibold">{departure.date}</p>
              </div>
              <div>
                <span className="text-slate-500">Departure Time:</span>
                <p className="font-semibold">{departure.departureTime}</p>
              </div>
              <div>
                <span className="text-slate-500">Party Size:</span>
                <p className="font-semibold">{totalSeats} Passengers</p>
              </div>
              <div>
                <span className="text-slate-500">Total Paid:</span>
                <p className="font-semibold">${confirmedBooking.totalAmount.toFixed(2)} {confirmedBooking.currency}</p>
              </div>
            </div>

            {selectedStop && (
              <div className="pt-2 border-t border-forest-100 text-xs">
                <span className="text-slate-500">Designated Hotel Pickup:</span>
                <p className="font-semibold text-forest-950">{selectedStop.name} ({selectedStop.town})</p>
                <p className="text-slate-600 text-[11px] mt-0.5">{selectedStop.instructions}</p>
              </div>
            )}
          </div>

          {/* QR Code preview */}
          {confirmedBooking.qrCodeUrl && (
            <div className="flex flex-col items-center justify-center space-y-2 pt-2">
              <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <Image
                  src={confirmedBooking.qrCodeUrl}
                  alt="Boarding Pass QR Code"
                  width={150}
                  height={150}
                  className="rounded-lg"
                />
              </div>
              <span className="text-[11px] text-slate-500">Present this QR code or voucher on mobile at boarding</span>
            </div>
          )}

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={`/booking/${confirmedBooking.bookingReference}/voucher`}
              className="px-6 py-3 rounded-xl font-bold text-xs text-forest-950 gold-gradient hover:opacity-95 shadow transition-all flex items-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              <span>Open Digital Boarding Pass Voucher</span>
            </Link>
            <Link
              href="/"
              className="px-6 py-3 rounded-xl font-semibold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      {/* Step Header */}
      <div className="mb-8 space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/" className="hover:text-forest-900">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-800 font-semibold">Secure Checkout</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold font-display text-forest-950">
          Book: {experienceTitle}
        </h1>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 10-Minute Hold Status Banner */}
      {holdToken && (
        <div className="mb-8 p-4 rounded-2xl bg-forest-950 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl border border-gold-400/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-forest-800 flex items-center justify-center text-gold-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Seats Guaranteed Under Active Reservation Hold</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gold-400 text-forest-950">ACTIVE</span>
              </p>
              <p className="text-xs text-slate-300">
                {totalSeats} seat(s) reserved for you. Please complete details and payment before the timer expires.
              </p>
            </div>
          </div>
          <div className="shrink-0 text-center sm:text-right font-mono text-xl font-bold text-gold-300 px-4 py-1.5 rounded-xl bg-forest-900 border border-forest-800">
            {Math.floor(remainingSeconds / 60).toString().padStart(2, "0")}:
            {(remainingSeconds % 60).toString().padStart(2, "0")}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left 2 Cols: Form Steps */}
        <form onSubmit={handleCompleteBooking} className="lg:col-span-2 space-y-8">
          {/* Step 1: Passenger Breakdown */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-forest-950 font-display">1. Passengers &amp; Seats</h2>
                <p className="text-xs text-slate-500">Select party size to reserve available vehicle capacity.</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800">
                {departure.seatsAvailable} seats available
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Adults */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700">Adults (12+)</span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setAdults(Math.max(1, adults - 1))}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold hover:bg-slate-100"
                  >
                    -
                  </button>
                  <span className="font-bold text-base">{adults}</span>
                  <button
                    type="button"
                    onClick={() => setAdults(adults + 1)}
                    disabled={totalSeats >= departure.seatsAvailable}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold hover:bg-slate-100 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Children */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700">Children (3-11)</span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setChildren(Math.max(0, children - 1))}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold hover:bg-slate-100"
                  >
                    -
                  </button>
                  <span className="font-bold text-base">{children}</span>
                  <button
                    type="button"
                    onClick={() => setChildren(children + 1)}
                    disabled={totalSeats >= departure.seatsAvailable}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold hover:bg-slate-100 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Infants */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700">Infants (0-2)</span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setInfants(Math.max(0, infants - 1))}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold hover:bg-slate-100"
                  >
                    -
                  </button>
                  <span className="font-bold text-base">{infants}</span>
                  <button
                    type="button"
                    onClick={() => setInfants(infants + 1)}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold hover:bg-slate-100"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {isOverCapacity && (
              <p className="text-xs text-red-600 font-semibold">
                You selected {totalSeats} seats, but only {departure.seatsAvailable} seats are available for this departure.
              </p>
            )}
          </div>

          {/* Step 2: Hotel Pickup Point */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-forest-950 font-display">2. Hotel Pickup Location</h2>
              <p className="text-xs text-slate-500">Complimentary door-to-door pickup across Banff, Canmore, and Lake Louise.</p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700">Select Designated Resort / Hotel</label>
              <select
                value={pickupStopId}
                onChange={(e) => setPickupStopId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-forest-800"
              >
                {stops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.town}) — {s.address}
                  </option>
                ))}
              </select>

              {selectedStop && (
                <div className="p-3.5 rounded-2xl bg-forest-50/70 border border-forest-100 text-xs text-slate-700 space-y-1">
                  <p className="font-bold text-forest-950 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Meeting Instructions:</span>
                  </p>
                  <p>{selectedStop.instructions}</p>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold text-slate-600">Staying elsewhere? (Custom Airbnb or hotel)</label>
              <input
                type="text"
                value={customPickup}
                onChange={(e) => setCustomPickup(e.target.value)}
                placeholder="Optional: Enter room number or custom address..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-forest-800"
              />
            </div>
          </div>

          {/* Step 3: Optional Add-Ons */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-forest-950 font-display">3. Optional Trip Add-Ons</h2>
              <p className="text-xs text-slate-500">Enhance your Rockies adventure with pre-arranged amenities.</p>
            </div>

            <div className="space-y-3">
              {/* Addon 1 */}
              <label className="flex items-start gap-3 p-4 rounded-2xl border border-slate-200 hover:border-gold-400 transition-colors cursor-pointer bg-slate-50/50">
                <input
                  type="checkbox"
                  checked={addParkPass}
                  onChange={(e) => setAddParkPass(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-forest-900 focus:ring-forest-800"
                />
                <div className="flex-1 text-xs">
                  <div className="flex justify-between font-bold text-forest-950">
                    <span>Parks Canada Discovery Pass Assistance</span>
                    <span>+$25.00 CAD</span>
                  </div>
                  <p className="text-slate-600 mt-0.5">We prepare your official vehicle entry pass in advance so you skip entrance lines.</p>
                </div>
              </label>

              {/* Addon 2 */}
              <label className="flex items-start gap-3 p-4 rounded-2xl border border-slate-200 hover:border-gold-400 transition-colors cursor-pointer bg-slate-50/50">
                <input
                  type="checkbox"
                  checked={addHotDrinks}
                  onChange={(e) => setAddHotDrinks(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-forest-900 focus:ring-forest-800"
                />
                <div className="flex-1 text-xs">
                  <div className="flex justify-between font-bold text-forest-950">
                    <span>Hot Drink &amp; Morning Pastry Package</span>
                    <span>+$15.00 / guest</span>
                  </div>
                  <p className="text-slate-600 mt-0.5">Artisan croissants and premium French Roast thermos coffee at the Rockpile viewpoint.</p>
                </div>
              </label>

              {/* Addon 3 */}
              <label className="flex items-start gap-3 p-4 rounded-2xl border border-slate-200 hover:border-gold-400 transition-colors cursor-pointer bg-slate-50/50">
                <input
                  type="checkbox"
                  checked={addGourmetLunch}
                  onChange={(e) => setAddGourmetLunch(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-forest-900 focus:ring-forest-800"
                />
                <div className="flex-1 text-xs">
                  <div className="flex justify-between font-bold text-forest-950">
                    <span>Gourmet Rockies Trail Packed Lunch</span>
                    <span>+$22.00 / guest</span>
                  </div>
                  <p className="text-slate-600 mt-0.5">Fresh alpine deli baguette sandwich, local fruit, cookies, and trail mix for your hike.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Step 4: Lead Guest Details */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-forest-950 font-display">4. Lead Guest Information</h2>
              <p className="text-xs text-slate-500">Boarding vouchers and SMS pickup reminders will be sent here.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Sarah Jenkins"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-forest-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Email Address *</label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="sarah@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-forest-800"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">Mobile Phone (for pickup day SMS updates) *</label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+1 (403) 555-0192"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-forest-800"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700">Special Requests / Notes</label>
                <textarea
                  rows={2}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Anniversary trip, window seat preferences, etc..."
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-forest-800"
                />
              </div>
            </div>

            {/* Hold Button Trigger */}
            {!holdToken && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleLockSeats}
                  disabled={isHolding || isOverCapacity}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-forest-900 hover:bg-forest-800 transition-colors flex items-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5 text-gold-400" />
                  <span>{isHolding ? "Locking Seats..." : "Lock These Seats for 10 Minutes"}</span>
                </button>
              </div>
            )}
          </div>

          {/* Step 5: Payment Method & Submit */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-forest-950 font-display">5. Payment &amp; Confirmation</h2>
              <p className="text-xs text-slate-500">PCI-DSS encrypted payment via Vista Chase payment abstraction.</p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>Sandbox Test Simulator Active</span>
              </p>
              <p className="text-slate-600">
                You can test instant checkout without entering a real card. Click Complete Booking to generate your confirmed reservation and digital boarding voucher.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || isOverCapacity}
              className="w-full py-4 rounded-2xl font-bold text-base text-forest-950 gold-gradient hover:opacity-95 shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CreditCard className="w-5 h-5" />
              <span>
                {loading ? "Processing Reservation..." : `Complete Booking • $${finalTotal.toFixed(2)} ${departure.currency}`}
              </span>
            </button>
          </div>
        </form>

        {/* Right 1 Col: Summary Sidebar */}
        <div className="space-y-6">
          <div className="sticky top-28 rounded-3xl bg-white border border-slate-200 shadow-xl p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-xs uppercase font-bold text-gold-600 tracking-wider">Booking Summary</span>
              <h3 className="text-lg font-bold text-forest-950 mt-1">{experienceTitle}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Guaranteed access to Lake Louise &amp; Moraine Lake</p>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-forest-800" />
                  <span>Departure Date:</span>
                </span>
                <span className="font-bold">{departure.date}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-forest-800" />
                  <span>Departure Time:</span>
                </span>
                <span className="font-bold">{departure.departureTime}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-forest-800" />
                  <span>Total Passengers:</span>
                </span>
                <span className="font-bold">{totalSeats} Guests</span>
              </div>
            </div>

            {/* Price Calculations */}
            <div className="border-t border-slate-100 pt-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Base Fare ({totalSeats} × ${departure.price}):</span>
                <span className="font-semibold">${baseSubtotal.toFixed(2)}</span>
              </div>

              {addOnsTotal > 0 && (
                <div className="flex justify-between text-emerald-800">
                  <span>Selected Add-ons:</span>
                  <span className="font-semibold">+${addOnsTotal.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-500">
                <span>Alberta GST (5%):</span>
                <span>${tax.toFixed(2)}</span>
              </div>

              <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline text-forest-950">
                <span className="text-sm font-bold">Total Amount:</span>
                <span className="text-xl font-bold font-mono">
                  ${finalTotal.toFixed(2)} <span className="text-xs font-normal">{departure.currency}</span>
                </span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 text-xs text-slate-600 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Free cancellation up to 48 hours</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Instant digital boarding pass</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
