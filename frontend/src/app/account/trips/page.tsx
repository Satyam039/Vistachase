"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Ticket,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Star,
  ArrowRight,
  LogOut,
  RefreshCw,
} from "lucide-react";

interface TripBooking {
  id: string;
  bookingReference: string;
  voucherCode: string;
  customerName: string;
  customerEmail: string;
  totalSeats: number;
  adultsCount: number;
  childrenCount: number;
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  pickupTime?: string;
  pickupCustomText?: string;
  tourDeparture: {
    id: string;
    date: string;
    departureTime: string;
    tour?: {
      id: string;
      title: string;
      slug: string;
      image: string;
    };
    shuttleRoute?: {
      id: string;
      name: string;
      origin: string;
      destination: string;
    };
  };
  pickupStop?: {
    id: string;
    name: string;
    address: string;
    town: string;
  };
  review?: {
    id: string;
    rating: number;
    title: string;
    body: string;
  };
}

export default function MyTripsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [bookings, setBookings] = useState<TripBooking[]>([]);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "cancelled">("upcoming");

  // Lookup by Reference fallback state (for guests not logged in)
  const [searchRef, setSearchRef] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [lookupError, setLookupError] = useState("");

  // Review modal state
  const [reviewModalBooking, setReviewModalBooking] = useState<TripBooking | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);

  // Cancellation modal state
  const [cancellingBooking, setCancellingBooking] = useState<TripBooking | null>(null);
  const [cancellingLoading, setCancellingLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  async function checkAuthAndLoad() {
    setLoading(true);
    try {
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();

      if (meData.authenticated && meData.user) {
        setUser(meData.user);
        const tripsRes = await fetch("/api/account/trips");
        const tripsData = await tripsRes.json();
        if (tripsData.bookings) {
          setBookings(tripsData.bookings);
        }
      }
    } catch (e) {
      console.error("Failed to load customer trips", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setBookings([]);
    router.push("/login");
  }

  async function handleLookupSingleBooking(e: React.FormEvent) {
    e.preventDefault();
    setLookupError("");
    try {
      const res = await fetch(`/api/bookings?ref=${encodeURIComponent(searchRef.trim())}`);
      const data = await res.json();
      if (!res.ok || !data.booking) {
        setLookupError("Booking not found. Please verify reference and try again.");
        return;
      }
      if (
        searchEmail &&
        data.booking.customerEmail.toLowerCase() !== searchEmail.trim().toLowerCase()
      ) {
        setLookupError("Email does not match this booking record.");
        return;
      }
      // Add or replace booking
      setBookings([data.booking]);
    } catch {
      setLookupError("Unable to retrieve booking at this time.");
    }
  }

  async function handleCancelConfirm() {
    if (!cancellingBooking) return;
    setCancellingLoading(true);
    setCancelMessage(null);

    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingReference: cancellingBooking.bookingReference,
          email: cancellingBooking.customerEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setCancelMessage({
          type: "error",
          text: data.error || "Failed to cancel booking.",
        });
      } else {
        setCancelMessage({
          type: "success",
          text: "Booking has been cancelled and seats released. A confirmation email has been sent.",
        });
        // Update local state
        setBookings((prev) =>
          prev.map((b) =>
            b.bookingReference === cancellingBooking.bookingReference
              ? { ...b, status: "CANCELLED" }
              : b
          )
        );
        setTimeout(() => {
          setCancellingBooking(null);
          setCancelMessage(null);
        }, 2500);
      }
    } catch {
      setCancelMessage({
        type: "error",
        text: "Network error occurred while cancelling booking.",
      });
    } finally {
      setCancellingLoading(false);
    }
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewModalBooking) return;
    setSubmittingReview(true);
    setReviewStatus(null);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingReference: reviewModalBooking.bookingReference,
          rating: reviewRating,
          title: reviewTitle,
          body: reviewBody,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setReviewStatus(data.error || "Failed to submit review.");
      } else {
        setReviewStatus("SUCCESS");
        // Update local booking
        setBookings((prev) =>
          prev.map((b) =>
            b.id === reviewModalBooking.id
              ? {
                  ...b,
                  review: {
                    id: data.review.id,
                    rating: data.review.rating,
                    title: data.review.title,
                    body: data.review.body,
                  },
                }
              : b
          )
        );
        setTimeout(() => {
          setReviewModalBooking(null);
          setReviewStatus(null);
          setReviewTitle("");
          setReviewBody("");
        }, 1500);
      }
    } catch {
      setReviewStatus("Network error submitting review.");
    } finally {
      setSubmittingReview(false);
    }
  }

  // Filter bookings into categories
  const now = new Date();
  const upcomingBookings = bookings.filter((b) => {
    if (b.status === "CANCELLED") return false;
    const departureTime = new Date(`${b.tourDeparture.date}T${b.tourDeparture.departureTime || "08:00"}`);
    return departureTime >= now;
  });

  const pastBookings = bookings.filter((b) => {
    if (b.status === "CANCELLED") return false;
    const departureTime = new Date(`${b.tourDeparture.date}T${b.tourDeparture.departureTime || "08:00"}`);
    return departureTime < now;
  });

  const cancelledBookings = bookings.filter((b) => b.status === "CANCELLED");

  const displayBookings =
    activeTab === "upcoming"
      ? upcomingBookings
      : activeTab === "past"
      ? pastBookings
      : cancelledBookings;

  return (
    <div className="min-h-screen bg-forest-950 text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-8 border-b border-forest-800 gap-4">
          <div>
            <div className="flex items-center gap-2 text-gold-400 text-xs font-semibold tracking-wider uppercase mb-1">
              <span>Customer Portal</span>
              <span>•</span>
              <span>Vista Chase Canadian Rockies</span>
            </div>
            <h1 className="text-3xl font-display font-bold text-white">My Trips &amp; Vouchers</h1>
            {user ? (
              <p className="text-sm text-slate-400 mt-1">
                Welcome back, <span className="text-white font-medium">{user.name}</span> ({user.email})
              </p>
            ) : (
              <p className="text-sm text-slate-400 mt-1">
                Manage your Canadian Rockies reservations, digital QR boarding passes, and reviews.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-forest-900 border border-forest-800 hover:border-red-500/50 text-slate-300 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-forest-800 hover:bg-forest-700 text-white border border-forest-700 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 rounded-xl text-sm font-semibold gold-gradient text-forest-950 shadow-glow hover:opacity-95 transition-all"
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Guest Lookup Box if not logged in */}
        {!user && !loading && bookings.length === 0 && (
          <div className="my-8 p-6 rounded-2xl bg-forest-900/80 border border-forest-800 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-gold-400" />
              <span>Looking for your reservation as a Guest?</span>
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Enter your booking reference (e.g. <code className="text-gold-300">VC-2026-98412</code>) and email to look up your digital boarding pass voucher.
            </p>
            <form onSubmit={handleLookupSingleBooking} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                aria-label="Booking reference"
                placeholder="Booking Ref (e.g. VC-2026-98412)"
                value={searchRef}
                onChange={(e) => setSearchRef(e.target.value)}
                required
                className="bg-forest-950 border border-forest-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-gold-400"
              />
              <input
                type="email"
                aria-label="Email used for the booking"
                autoComplete="email"
                placeholder="Customer Email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="bg-forest-950 border border-forest-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-gold-400"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl font-semibold text-forest-950 gold-gradient shadow-glow hover:opacity-95 transition-all text-sm flex items-center justify-center gap-2"
              >
                <span>Find Reservation</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
            {lookupError && (
              <p role="alert" className="text-sm text-red-400 mt-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{lookupError}</span>
              </p>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-4 mt-8 border-b border-forest-800 pb-2">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`pb-2 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === "upcoming"
                ? "border-gold-400 text-gold-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Upcoming Trips</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-forest-800 text-slate-300">
              {upcomingBookings.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("past")}
            className={`pb-2 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === "past"
                ? "border-gold-400 text-gold-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Past Journeys</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-forest-800 text-slate-300">
              {pastBookings.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("cancelled")}
            className={`pb-2 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === "cancelled"
                ? "border-gold-400 text-gold-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Cancelled</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-forest-800 text-slate-300">
              {cancelledBookings.length}
            </span>
          </button>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-gold-400 animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Loading your reservations...</p>
          </div>
        )}

        {/* Trips List */}
        {!loading && displayBookings.length === 0 && (
          <div className="py-16 text-center bg-forest-900/40 rounded-2xl border border-forest-800 mt-6">
            <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white">No {activeTab} trips found</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 mb-6">
              {activeTab === "upcoming"
                ? "You don't have any upcoming departures scheduled with Vista Chase."
                : `No reservations found under ${activeTab}.`}
            </p>
            <Link
              href="/banff-highlights-tour"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-forest-950 gold-gradient shadow-glow hover:opacity-95 transition-all text-sm"
            >
              <span>Explore Banff Experiences</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {!loading && displayBookings.length > 0 && (
          <div className="grid grid-cols-1 gap-6 mt-6">
            {displayBookings.map((b) => {
              const tourTitle =
                b.tourDeparture.tour?.title ||
                b.tourDeparture.shuttleRoute?.name ||
                "Vista Chase Rockies Journey";

              return (
                <div
                  key={b.id}
                  className="rounded-2xl bg-forest-900 border border-forest-800 hover:border-forest-700 transition-all p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                >
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-forest-950 text-gold-400 border border-forest-800">
                        {b.bookingReference}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                          b.status === "CONFIRMED"
                            ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60"
                            : b.status === "CANCELLED"
                            ? "bg-red-950/80 text-red-400 border border-red-800/60"
                            : "bg-forest-800 text-slate-300"
                        }`}
                      >
                        {b.status}
                      </span>
                      <span className="text-xs text-slate-400">
                        Voucher: <strong className="text-white">{b.voucherCode}</strong>
                      </span>
                    </div>

                    <h3 className="text-xl font-display font-bold text-white hover:text-gold-300 transition-colors">
                      {tourTitle}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300 pt-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gold-400 flex-shrink-0" />
                        <span>Date: <strong>{b.tourDeparture.date}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gold-400 flex-shrink-0" />
                        <span>Departure: <strong>{b.tourDeparture.departureTime || "08:00 AM"}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gold-400 flex-shrink-0" />
                        <span>
                          Passengers: <strong>{b.totalSeats} seats</strong> ({b.adultsCount} Adult{b.adultsCount > 1 ? "s" : ""}{b.childrenCount > 0 ? `, ${b.childrenCount} Child` : ""})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-xs text-slate-400 bg-forest-950/60 p-2.5 rounded-xl border border-forest-800/50">
                      <MapPin className="w-4 h-4 text-gold-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-300">
                          Pickup: {b.pickupStop ? b.pickupStop.name : b.pickupCustomText || "Banff Central Dispatch Point"}
                        </span>
                        {b.pickupStop?.address && (
                          <span className="block text-[11px] text-slate-400">
                            {b.pickupStop.address}, {b.pickupStop.town}
                          </span>
                        )}
                        {b.pickupTime && (
                          <span className="block text-gold-400 text-[11px] font-medium mt-0.5">
                            Scheduled Pickup: {b.pickupTime}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Review snippet if already reviewed */}
                    {b.review && (
                      <div className="flex items-center gap-2 text-xs text-gold-400 bg-gold-950/20 border border-gold-800/40 p-2 rounded-xl">
                        <Star className="w-4 h-4 fill-gold-400 text-gold-400" />
                        <span>
                          You reviewed: <strong>{b.review.rating} / 5 Stars</strong> — &quot;{b.review.title}&quot;
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-stretch lg:items-end justify-between gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-forest-800 min-w-[200px]">
                    <div className="text-right sm:text-left lg:text-right">
                      <div className="text-xs text-slate-400">Total Paid</div>
                      <div className="text-xl font-bold text-white font-mono">
                        ${b.totalAmount.toFixed(2)} <span className="text-xs text-slate-400">{b.currency}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      <Link
                        href={`/booking/${b.bookingReference}/voucher`}
                        className="px-4 py-2.5 rounded-xl font-semibold text-forest-950 gold-gradient shadow-glow hover:opacity-95 transition-all text-xs text-center flex items-center justify-center gap-2"
                      >
                        <Ticket className="w-3.5 h-3.5" />
                        <span>Digital Boarding Pass</span>
                      </Link>

                      {b.status === "CONFIRMED" && (
                        <button
                          onClick={() => setCancellingBooking(b)}
                          className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-red-400 bg-forest-950 border border-forest-800 hover:border-red-900 transition-colors"
                        >
                          Cancel (48h Policy)
                        </button>
                      )}

                      {b.status !== "CANCELLED" && !b.review && b.tourDeparture.tour && (
                        <button
                          onClick={() => {
                            setReviewModalBooking(b);
                            setReviewRating(5);
                            setReviewTitle("");
                            setReviewBody("");
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-medium text-gold-300 bg-gold-950/30 border border-gold-800/40 hover:bg-gold-950/60 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Star className="w-3.5 h-3.5 text-gold-400" />
                          <span>Leave Verified Review</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Cancellation Modal */}
        {cancellingBooking && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-forest-900 border border-forest-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center gap-3 text-red-400">
                <AlertCircle className="w-6 h-6 flex-shrink-0" />
                <h3 className="text-lg font-bold text-white">Cancel Reservation</h3>
              </div>
              <p className="text-sm text-slate-300">
                Are you sure you want to cancel booking{" "}
                <strong className="text-white font-mono">{cancellingBooking.bookingReference}</strong> for{" "}
                <strong className="text-white">
                  {cancellingBooking.tourDeparture.tour?.title || "Vista Chase Rockies Tour"}
                </strong>{" "}
                on {cancellingBooking.tourDeparture.date}?
              </p>
              <div className="p-3 rounded-xl bg-forest-950 border border-forest-800 text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-gold-400">48-Hour Cancellation Policy</p>
                <p>
                  Reservations cancelled 48 hours or more prior to departure are eligible for a full cancellation and release of seats. Cancellations within 48 hours are non-refundable.
                </p>
              </div>

              {cancelMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    cancelMessage.type === "success"
                      ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                      : "bg-red-950 text-red-300 border border-red-800"
                  }`}
                >
                  {cancelMessage.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span>{cancelMessage.text}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={cancellingLoading}
                  onClick={() => {
                    setCancellingBooking(null);
                    setCancelMessage(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-forest-800 hover:bg-forest-700 text-slate-300 transition-colors"
                >
                  Keep Reservation
                </button>
                <button
                  type="button"
                  disabled={cancellingLoading}
                  onClick={handleCancelConfirm}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors flex items-center gap-2"
                >
                  {cancellingLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Cancellation</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Review Modal */}
        {reviewModalBooking && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-forest-900 border border-forest-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Write a Verified Review</h3>
                  <p className="text-xs text-slate-400">
                    Booking: {reviewModalBooking.bookingReference} • {reviewModalBooking.tourDeparture.tour?.title}
                  </p>
                </div>
                <button
                  onClick={() => setReviewModalBooking(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-4">
                {/* Rating selection */}
                <div>
                  <span id="review-rating-label" className="block text-xs font-medium text-slate-300 mb-1.5">Overall Rating</span>
                  <div role="radiogroup" aria-labelledby="review-rating-label" className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        role="radio"
                        aria-checked={reviewRating === star}
                        aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
                        onClick={() => setReviewRating(star)}
                        className="p-1 rounded hover:scale-110 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-summit-500"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= reviewRating
                              ? "fill-gold-400 text-gold-400"
                              : "text-slate-600"
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-sm font-semibold text-gold-400 ml-2" aria-hidden="true">
                      {reviewRating} of 5 Stars
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor="app-account-trips-headline-title" className="block text-xs font-medium text-slate-300 mb-1">Headline / Title</label>
                  <input id="app-account-trips-headline-title"
                    type="text"
                    required
                    placeholder="e.g. Unforgettable day at Moraine Lake with Vista Chase!"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    className="w-full bg-forest-950 border border-forest-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-gold-400"
                  />
                </div>

                <div>
                  <label htmlFor="app-account-trips-your-review" className="block text-xs font-medium text-slate-300 mb-1">Your Review</label>
                  <textarea id="app-account-trips-your-review"
                    rows={4}
                    required
                    placeholder="Tell other travelers about your experience, punctuality, driver, and scenic views..."
                    value={reviewBody}
                    onChange={(e) => setReviewBody(e.target.value)}
                    className="w-full bg-forest-950 border border-forest-700 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-gold-400"
                  />
                </div>

                {reviewStatus && reviewStatus !== "SUCCESS" && (
                  <p className="text-xs text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{reviewStatus}</span>
                  </p>
                )}

                {reviewStatus === "SUCCESS" && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Your verified review has been submitted successfully!</span>
                  </p>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setReviewModalBooking(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-forest-800 hover:bg-forest-700 text-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold text-forest-950 gold-gradient shadow-glow hover:opacity-95 transition-all flex items-center gap-2"
                  >
                    {submittingReview && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Submit Review</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
