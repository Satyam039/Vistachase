"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { canCancelFree, departureInstant } from "@/lib/policy";
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
      image?: string;
      featuredImage?: string;
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
    return departureInstant(b.tourDeparture.date, b.tourDeparture.departureTime) >= now;
  });

  const pastBookings = bookings.filter((b) => {
    if (b.status === "CANCELLED") return false;
    return departureInstant(b.tourDeparture.date, b.tourDeparture.departureTime) < now;
  });

  const cancelledBookings = bookings.filter((b) => b.status === "CANCELLED");

  const displayBookings =
    activeTab === "upcoming"
      ? upcomingBookings
      : activeTab === "past"
      ? pastBookings
      : cancelledBookings;

  const tabs = [
    { id: "upcoming" as const, label: "Upcoming", count: upcomingBookings.length },
    { id: "past" as const, label: "Past", count: pastBookings.length },
    { id: "cancelled" as const, label: "Cancelled", count: cancelledBookings.length },
  ];
  const showList = !!user || bookings.length > 0;

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      {/* Header band */}
      <section className="relative isolate overflow-hidden bg-ocean-950 text-white">
        <Image
          src="/media/photos/moraine-lake-perfect-reflection.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover opacity-50"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ocean-950 via-ocean-950/60 to-ocean-950/20" />
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-page pb-12 pt-14 sm:pb-16 sm:pt-20 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-3 text-sm uppercase tracking-[0.22em] text-summit-300">Your Rockies journeys</p>
            <h1 className="text-4xl font-light tracking-tight text-white sm:text-5xl lg:text-6xl">My trips</h1>
            <p className="mt-3 max-w-xl text-lg font-light text-white/85">
              {user ? (
                <>
                  Welcome back, <span className="text-white">{user.name}</span>. Your vouchers, pickups and reviews are all here.
                </>
              ) : (
                "Vouchers, pickup times and trip details for every booking, in one place."
              )}
            </p>
          </div>
          {user && (
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-11 items-center gap-2 self-start rounded-full border border-white/25 px-5 text-sm text-white hover:bg-white/10 md:self-auto"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-page py-10 sm:py-14">
        {/* Signed out: find a booking, or sign in */}
        {!user && !loading && bookings.length === 0 && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <section aria-labelledby="find-heading" className="rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07] sm:p-8">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-ocean-50 text-ocean-700">
                <Ticket className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 id="find-heading" className="mt-5 text-2xl font-light text-obsidian-900 sm:text-3xl">
                Find your booking
              </h2>
              <p className="mt-2 text-base text-slate-600">
                Booked without an account? Enter the reference from your confirmation email to see your voucher and pickup.
              </p>
              <form onSubmit={handleLookupSingleBooking} className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm text-slate-700">Booking reference</span>
                  <input
                    type="text"
                    placeholder="VC-2026-98412"
                    value={searchRef}
                    onChange={(e) => setSearchRef(e.target.value)}
                    required
                    autoCapitalize="characters"
                    className="h-12 w-full rounded-xl border border-obsidian-900/15 bg-white px-4 font-mono text-base text-obsidian-900 placeholder:text-slate-400 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/30"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm text-slate-700">Email used to book</span>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="h-12 w-full rounded-xl border border-obsidian-900/15 bg-white px-4 text-base text-obsidian-900 placeholder:text-slate-400 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/30"
                  />
                </label>
                <button
                  type="submit"
                  className="golden-summit-btn inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-base sm:col-span-2 sm:justify-self-start"
                >
                  Find my booking
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </form>
              {lookupError && (
                <p role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {lookupError}
                </p>
              )}
              <p className="mt-6 text-sm text-slate-600">
                Can&rsquo;t find your reference?{" "}
                <Link href="/contact-us" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-900">
                  Contact us
                </Link>{" "}
                and we&rsquo;ll resend it.
              </p>
            </section>

            <section aria-labelledby="signin-heading" className="flex flex-col rounded-[1.75rem] bg-ocean-950 p-6 text-white sm:p-8">
              <h2 id="signin-heading" className="text-2xl font-light text-white sm:text-3xl">
                See every trip in one place
              </h2>
              <ul className="mt-5 space-y-3 text-base text-white/85">
                {["All your bookings and vouchers", "Pickup times as soon as they're set", "Cancel free up to 72 hours before", "Review your guide after the tour"].map(
                  (t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-summit-400" aria-hidden="true" />
                      {t}
                    </li>
                  ),
                )}
              </ul>
              <div className="mt-auto flex flex-wrap gap-3 pt-8">
                <Link href="/login" className="golden-summit-btn inline-flex h-12 items-center rounded-full px-7 text-base">
                  Sign in
                </Link>
                <Link href="/register" className="inline-flex h-12 items-center rounded-full border border-white/25 px-6 text-base text-white hover:bg-white/10">
                  Create account
                </Link>
              </div>
            </section>
          </div>
        )}

        {loading && (
          <div className="py-24 text-center" role="status">
            <RefreshCw className="mx-auto mb-3 h-7 w-7 animate-spin text-ocean-600" aria-hidden="true" />
            <p className="text-base text-slate-600">Loading your trips…</p>
          </div>
        )}

        {!loading && showList && (
          <>
            {/* Segmented tabs with counts */}
            <div
              role="group"
              aria-label="Show trips"
              // Sticks 16px below the navbar, like the other in-page bars.
              className="sticky top-[calc(var(--vc-header-h,80px)+16px)] z-20 inline-flex rounded-full bg-white p-1.5 shadow-[0_12px_24px_-20px_rgba(12,31,33,0.45)] ring-1 ring-obsidian-900/[0.07]"
            >
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={activeTab === t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm transition-colors ${
                    activeTab === t.id ? "bg-obsidian-900 text-white" : "text-slate-700 hover:bg-obsidian-900/[0.05]"
                  }`}
                >
                  {t.label}
                  <span
                    className={`inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-xs ${
                      activeTab === t.id ? "bg-white/15 text-white" : "bg-obsidian-900/[0.06] text-slate-700"
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            <section aria-label={`${tabs.find((t) => t.id === activeTab)?.label} trips`} className="mt-8">
              {displayBookings.length === 0 ? (
                <div className="flex flex-col items-center rounded-[1.75rem] bg-white px-6 py-16 text-center ring-1 ring-obsidian-900/[0.07]">
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-ocean-50 text-ocean-700">
                    <Calendar className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <h2 className="mt-5 text-2xl font-light text-obsidian-900">
                    {activeTab === "upcoming" ? "No upcoming trips yet" : activeTab === "past" ? "No past trips yet" : "No cancelled trips"}
                  </h2>
                  <p className="mt-2 max-w-md text-base text-slate-600">
                    {activeTab === "upcoming"
                      ? "When you book a tour or shuttle, it shows up here with your voucher and pickup details."
                      : "Trips will appear here once they've happened."}
                  </p>
                  {activeTab === "upcoming" && (
                    <Link href="/search" className="golden-summit-btn mt-7 inline-flex h-12 items-center gap-2 rounded-full px-7 text-base">
                      Explore experiences
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              ) : (
                <ul className="space-y-5">
                  {displayBookings.map((b) => {
                    const title = b.tourDeparture.tour?.title || b.tourDeparture.shuttleRoute?.name || "Vista Chase tour";
                    const image = b.tourDeparture.tour?.featuredImage || b.tourDeparture.tour?.image || "/media/photos/moraine-lake-perfect-reflection.webp";
                    const date = new Date(`${b.tourDeparture.date}T00:00:00`);
                    const valid = !Number.isNaN(date.getTime());
                    const statusTone =
                      b.status === "CONFIRMED"
                        ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                        : b.status === "CANCELLED"
                        ? "bg-red-50 text-red-800 ring-red-200"
                        : "bg-slate-100 text-slate-700 ring-slate-200";
                    return (
                      <li key={b.id}>
                        <article className="grid overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-obsidian-900/[0.07] md:grid-cols-[16rem_minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)_16rem]">
                          {/* Photo with date badge */}
                          <div className="relative aspect-[16/9] md:aspect-auto md:min-h-full">
                            <Image src={image} alt="" fill sizes="(max-width: 768px) 100vw, 18rem" className="object-cover" />
                            {valid && (
                              <span className="absolute left-4 top-4 flex flex-col items-center rounded-2xl bg-white px-3 py-2 text-center shadow-lg">
                                <span className="text-xs uppercase tracking-wider text-ocean-700">
                                  {date.toLocaleDateString("en-CA", { month: "short" })}
                                </span>
                                <span className="text-2xl font-light leading-none text-obsidian-900">{date.getDate()}</span>
                              </span>
                            )}
                          </div>

                          {/* Details */}
                          <div className="space-y-4 p-6">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-3 py-1 text-xs ring-1 ${statusTone}`}>
                                {b.status.charAt(0) + b.status.slice(1).toLowerCase()}
                              </span>
                              <span className="rounded-full bg-obsidian-900/[0.05] px-3 py-1 font-mono text-xs text-obsidian-800">{b.bookingReference}</span>
                            </div>
                            <h3 className="text-xl leading-snug text-obsidian-900 sm:text-2xl sm:font-light">
                              {b.tourDeparture.tour?.slug ? (
                                <Link href={`/${b.tourDeparture.tour.slug}`} className="hover:text-ocean-700">
                                  {title}
                                </Link>
                              ) : (
                                title
                              )}
                            </h3>
                            <dl className="grid gap-x-6 gap-y-2 text-sm text-slate-700 sm:grid-cols-3">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
                                <dt className="sr-only">Date</dt>
                                <dd>
                                  {valid
                                    ? date.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
                                    : b.tourDeparture.date}
                                </dd>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
                                <dt className="sr-only">Departure</dt>
                                <dd>Departs {b.tourDeparture.departureTime || "08:00"}</dd>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
                                <dt className="sr-only">Guests</dt>
                                <dd>
                                  {b.adultsCount} adult{b.adultsCount === 1 ? "" : "s"}
                                  {b.childrenCount > 0 ? `, ${b.childrenCount} child${b.childrenCount === 1 ? "" : "ren"}` : ""}
                                </dd>
                              </div>
                            </dl>
                            <div className="flex items-start gap-3 rounded-2xl bg-obsidian-50 p-4">
                              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-ocean-600" aria-hidden="true" />
                              <div className="text-sm">
                                <p className="text-obsidian-900">
                                  Pickup: {b.pickupStop ? b.pickupStop.name : b.pickupCustomText || "We'll confirm your pickup by email"}
                                </p>
                                {b.pickupStop?.address && (
                                  <p className="text-slate-600">
                                    {b.pickupStop.address}, {b.pickupStop.town}
                                  </p>
                                )}
                                {b.pickupTime && <p className="mt-0.5 text-ocean-700">Pickup at {b.pickupTime}</p>}
                              </div>
                            </div>
                            {b.review && (
                              <p className="flex items-center gap-2 text-sm text-slate-700">
                                <Star className="h-4 w-4 fill-summit-500 text-summit-500" aria-hidden="true" />
                                You rated this {b.review.rating}/5 · &ldquo;{b.review.title}&rdquo;
                              </p>
                            )}
                          </div>

                          {/* Total + actions */}
                          <div className="flex flex-col gap-3 border-t border-obsidian-900/[0.07] p-6 md:col-span-2 lg:col-span-1 lg:border-l lg:border-t-0">
                            <div>
                              <p className="text-sm text-slate-600">Total paid</p>
                              <p className="text-2xl font-light text-obsidian-900">
                                ${b.totalAmount.toFixed(2)} <span className="text-sm text-slate-600">{b.currency}</span>
                              </p>
                            </div>
                            <div className="mt-auto grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                              <Link
                                href={`/booking/${b.bookingReference}/voucher`}
                                className="golden-summit-btn inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm"
                              >
                                <Ticket className="h-4 w-4" aria-hidden="true" />
                                View voucher
                              </Link>
                              {b.status !== "CANCELLED" && !b.review && b.tourDeparture.tour && activeTab === "past" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewModalBooking(b);
                                    setReviewRating(5);
                                    setReviewTitle("");
                                    setReviewBody("");
                                  }}
                                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-obsidian-900/15 px-5 text-sm text-obsidian-900 hover:bg-obsidian-50"
                                >
                                  <Star className="h-4 w-4 text-summit-600" aria-hidden="true" />
                                  Write a review
                                </button>
                              )}
                              {b.status === "CONFIRMED" && activeTab === "upcoming" && !canCancelFree(b.tourDeparture.date, b.tourDeparture.departureTime) && (
                                <p className="text-sm leading-snug text-slate-600">
                                  Within 72 hours of departure: free cancellation has ended.{" "}
                                  <Link href="/contact-us" className="text-ocean-600 underline underline-offset-4">
                                    Contact us
                                  </Link>{" "}
                                  for changes.
                                </p>
                              )}
                              {b.status === "CONFIRMED" && activeTab === "upcoming" && canCancelFree(b.tourDeparture.date, b.tourDeparture.departureTime) && (
                                <button
                                  type="button"
                                  onClick={() => setCancellingBooking(b)}
                                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-5 text-sm text-red-700 transition-colors hover:border-red-700 hover:bg-red-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                                >
                                  <XCircle className="h-4 w-4" aria-hidden="true" />
                                  Cancel booking
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}

        {/* Cancellation dialog */}
        {cancellingBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/70 p-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-labelledby="cancel-title" className="w-full max-w-md space-y-5 rounded-[1.75rem] bg-white p-6 shadow-2xl sm:p-8">
              <h2 id="cancel-title" className="text-2xl font-light text-obsidian-900">
                Cancel this booking?
              </h2>
              <p className="text-base text-slate-700">
                <span className="font-mono">{cancellingBooking.bookingReference}</span> ·{" "}
                {cancellingBooking.tourDeparture.tour?.title || "Vista Chase tour"} on {cancellingBooking.tourDeparture.date}
              </p>
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="text-base">Free cancellation up to 72 hours before</p>
                <p className="mt-1">
                  Groups of 1–6 get a full refund. For groups of 7 or more and multi-day trips, the 20% deposit is non-refundable. Within 72 hours the
                  booking can&rsquo;t be refunded. Refunds take 5–10 business days.
                </p>
              </div>
              {cancelMessage && (
                <p
                  role="alert"
                  className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                    cancelMessage.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                  }`}
                >
                  {cancelMessage.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> : <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  {cancelMessage.text}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  disabled={cancellingLoading}
                  onClick={() => {
                    setCancellingBooking(null);
                    setCancelMessage(null);
                  }}
                  className="inline-flex h-11 items-center rounded-full border border-obsidian-900/15 px-5 text-sm text-obsidian-900 hover:bg-obsidian-50"
                >
                  Keep booking
                </button>
                <button
                  type="button"
                  disabled={cancellingLoading}
                  onClick={handleCancelConfirm}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-red-700 px-5 text-sm text-white hover:bg-red-800"
                >
                  {cancellingLoading && <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Cancel booking
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Review dialog */}
        {reviewModalBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/70 p-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-labelledby="review-title" className="w-full max-w-lg space-y-5 rounded-[1.75rem] bg-white p-6 shadow-2xl sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="review-title" className="text-2xl font-light text-obsidian-900">
                    How was your day?
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">{reviewModalBooking.tourDeparture.tour?.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewModalBooking(null)}
                  aria-label="Close"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-obsidian-900/15 text-obsidian-900 hover:bg-obsidian-50"
                >
                  <XCircle className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div>
                  <span id="review-rating-label" className="mb-1.5 block text-sm text-slate-700">
                    Your rating
                  </span>
                  <div role="radiogroup" aria-labelledby="review-rating-label" className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        role="radio"
                        aria-checked={reviewRating === star}
                        aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
                        onClick={() => setReviewRating(star)}
                        className="rounded-lg p-1.5 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean-600"
                      >
                        <Star className={`h-7 w-7 ${star <= reviewRating ? "fill-summit-500 text-summit-500" : "text-slate-300"}`} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-sm text-slate-700">Headline</span>
                  <input
                    type="text"
                    required
                    placeholder="An unforgettable sunrise at Moraine Lake"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    className="h-12 w-full rounded-xl border border-obsidian-900/15 px-4 text-base text-obsidian-900 placeholder:text-slate-400 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/30"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm text-slate-700">Your review</span>
                  <textarea
                    rows={4}
                    required
                    placeholder="Your guide, the stops, the views…"
                    value={reviewBody}
                    onChange={(e) => setReviewBody(e.target.value)}
                    className="w-full rounded-xl border border-obsidian-900/15 p-4 text-base text-obsidian-900 placeholder:text-slate-400 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/30"
                  />
                </label>
                {reviewStatus && reviewStatus !== "SUCCESS" && (
                  <p role="alert" className="flex items-center gap-2 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {reviewStatus}
                  </p>
                )}
                {reviewStatus === "SUCCESS" && (
                  <p role="status" className="flex items-center gap-2 text-sm text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Thank you, your review is posted.
                  </p>
                )}
                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setReviewModalBooking(null)}
                    className="inline-flex h-11 items-center rounded-full border border-obsidian-900/15 px-5 text-sm text-obsidian-900 hover:bg-obsidian-50"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={submittingReview} className="golden-summit-btn inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm">
                    {submittingReview && <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Post review
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
