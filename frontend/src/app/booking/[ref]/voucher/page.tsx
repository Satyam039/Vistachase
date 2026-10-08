// Booking voucher (e-ticket), laid out like the confirmation pages of GetYourGuide and Viator:
// a confirmation band, then the ticket itself (photo, perforation, QR + reference, key facts)
// beside what the guest needs next: pickup with directions, live tracking, price summary,
// free cancellation and help. Prints as a clean ticket (print: variants hide the rest).

import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Users,
} from "lucide-react";
import { getBookingByReference } from "@/lib/api/catalog";
import { PrintButton } from "@/components/booking/PrintButton";
import { canCancelFree } from "@/lib/policy";
import { headers } from "next/headers";

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  return {
    title: `Voucher ${ref} | Vista Chase`,
    description: "Your Vista Chase booking voucher: QR code, pickup and trip details.",
    robots: { index: false },
  };
}

const money = (n: number) => `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "08:30" → "8:30 AM" */
function clock(time?: string | null) {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return time;
  const d = new Date(2000, 0, 1, h, m || 0);
  return d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
}

/** A one-event calendar file (local Rockies time), offered as a download link. */
function calendarHref(title: string, date: string, start: string, hours: number, location: string, ref: string) {
  const stamp = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
  const begin = new Date(`${date}T${start || "08:00"}`);
  if (Number.isNaN(begin.getTime())) return null;
  const end = new Date(begin.getTime() + Math.max(1, hours) * 3600_000);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vista Chase//Voucher//EN",
    "BEGIN:VEVENT",
    `UID:${ref}@vistachase.com`,
    `DTSTART:${stamp(begin)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${title} (Vista Chase)`,
    `LOCATION:${location.replace(/,/g, "\\,")}`,
    `DESCRIPTION:Booking ${ref}. Be at your pickup 10 minutes early.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export default async function VoucherPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { ref } = await params;
  const { t } = await searchParams;
  // The emailed link carries a signed token; signed-in owners and staff open it with their session.
  const cookie = (await headers()).get("cookie") ?? undefined;
  const booking = await getBookingByReference(ref, { token: typeof t === "string" ? t : undefined, cookie });
  if (!booking) notFound();

  const departure = booking.tourDeparture;
  const title = departure.tour?.title || departure.shuttleRoute?.name || "Canadian Rockies tour";
  const image = departure.tour?.featuredImage || "/media/photos/moraine-lake-perfect-reflection.webp";
  const date = new Date(`${departure.date}T00:00:00`);
  const dateLabel = Number.isNaN(date.getTime())
    ? departure.date
    : date.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const cancelled = booking.status === "CANCELLED";
  const pickupName = booking.pickupStop?.name || booking.pickupCustomText || "Pickup to be confirmed by email";
  const pickupAddress = booking.pickupStop?.address || (booking.pickupStop ? booking.pickupStop.town : null);
  const directions =
    booking.pickupStop?.latitude != null && booking.pickupStop?.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${booking.pickupStop.latitude},${booking.pickupStop.longitude}`
      : pickupAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pickupName}, ${pickupAddress}`)}`
      : null;
  const guests = [
    booking.adultsCount ? `${booking.adultsCount} adult${booking.adultsCount === 1 ? "" : "s"}` : null,
    booking.childrenCount ? `${booking.childrenCount} child${booking.childrenCount === 1 ? "" : "ren"}` : null,
    booking.infantsCount ? `${booking.infantsCount} infant${booking.infantsCount === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(", ") || `${booking.totalSeats} guest${booking.totalSeats === 1 ? "" : "s"}`;
  const ics = cancelled
    ? null
    : calendarHref(title, departure.date, booking.pickupTime || departure.departureTime, departure.tour?.durationHours ?? 8, `${pickupName}${pickupAddress ? `, ${pickupAddress}` : ""}`, booking.bookingReference);

  const facts = [
    { icon: CalendarCheck, label: "Date", value: dateLabel },
    { icon: Clock, label: "Departs", value: clock(departure.departureTime) ?? "To be confirmed" },
    { icon: MapPin, label: "Pickup", value: booking.pickupTime ? `${clock(booking.pickupTime)} · ${pickupName}` : pickupName },
    { icon: Users, label: "Guests", value: guests },
  ];

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900 print:bg-white">
      {/* Confirmation band */}
      <section className={`print:hidden ${cancelled ? "bg-red-50" : "bg-obsidian-950"} `}>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-page pb-10 pt-8 sm:pb-12 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/account/trips"
              className={`mb-6 inline-flex items-center gap-1.5 text-sm ${cancelled ? "text-red-900 hover:underline" : "text-white/80 hover:text-white"}`}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              My trips
            </Link>
            {cancelled ? (
              <>
                <p className="text-sm uppercase tracking-[0.22em] text-red-800">Booking cancelled</p>
                <h1 className="mt-2 text-3xl font-light text-red-950 sm:text-4xl">This booking has been cancelled</h1>
                <p className="mt-2 text-base text-red-900">The voucher below is no longer valid.</p>
              </>
            ) : (
              <>
                <p className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1 text-sm text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Booking confirmed
                </p>
                <h1 className="mt-4 text-3xl font-light tracking-tight text-white sm:text-5xl">You&rsquo;re all set, {booking.customerName.split(" ")[0]}</h1>
                <p className="mt-3 max-w-2xl text-lg font-light text-white/85">
                  Show this voucher to your guide at pickup. On your phone is fine.
                </p>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <PrintButton
              className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm ${
                cancelled ? "border border-red-900/20 text-red-950 hover:bg-red-100" : "border border-white/25 text-white hover:bg-white/10"
              }`}
            />
            {ics && (
              <a
                href={ics}
                download={`vista-chase-${booking.bookingReference}.ics`}
                className="golden-summit-btn inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm"
              >
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                Add to calendar
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl items-start gap-8 px-page py-10 sm:py-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] print:block print:p-0">
        {/* The ticket */}
        <article
          aria-label={`Voucher for ${title}`}
          className={`overflow-hidden rounded-[2rem] bg-white shadow-[0_40px_80px_-50px_rgba(12,31,33,0.5)] ring-1 ring-obsidian-900/[0.07] print:shadow-none ${cancelled ? "opacity-60" : ""}`}
        >
          <div className="relative aspect-[16/7] bg-obsidian-200">
            <Image src={image} alt="" fill priority sizes="(max-width: 1024px) 100vw, 640px" className="object-cover" />
            <div className="vc-scrim vc-scrim-tall" aria-hidden="true" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <p className="text-sm text-white/80">Vista Chase · Canadian Rockies</p>
              <h2 className="mt-1 text-2xl font-light leading-tight text-white sm:text-3xl">{title}</h2>
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-8">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600">Booking reference</p>
                <p className="font-mono text-2xl tracking-wide text-obsidian-900 sm:text-3xl">{booking.bookingReference}</p>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
                <div>
                  <p className="text-slate-600">Voucher code</p>
                  <p className="font-mono text-base text-obsidian-900">{booking.voucherCode}</p>
                </div>
                <div>
                  <p className="text-slate-600">Lead guest</p>
                  <p className="text-base text-obsidian-900">{booking.customerName}</p>
                </div>
              </div>
            </div>
            {booking.qrCodeUrl && !cancelled && (
              <figure className="justify-self-center rounded-2xl bg-white p-3 text-center ring-1 ring-obsidian-900/10 sm:justify-self-end">
                <Image
                  src={booking.qrCodeUrl}
                  alt={`QR code for booking ${booking.bookingReference}`}
                  width={144}
                  height={144}
                  unoptimized
                  className="mx-auto"
                />
                <figcaption className="mt-1 text-xs text-slate-600">Scan at pickup</figcaption>
              </figure>
            )}
          </div>

          {/* Perforation */}
          <div className="relative h-px" aria-hidden="true">
            <span className="absolute -left-4 -top-4 h-8 w-8 rounded-full bg-obsidian-50 print:hidden" />
            <span className="absolute -right-4 -top-4 h-8 w-8 rounded-full bg-obsidian-50 print:hidden" />
            <span className="absolute inset-x-8 top-0 border-t-2 border-dashed border-obsidian-900/10" />
          </div>

          <ul aria-label="Trip details" className="grid gap-x-8 gap-y-5 p-6 sm:grid-cols-2 sm:p-8">
            {facts.map(({ icon: Icon, label, value }) => (
              <li key={label} className="flex items-start gap-3.5">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ocean-50 text-ocean-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm text-slate-600">
                    {label}
                    <span className="sr-only">:</span>
                  </span>
                  <span className="block text-base text-obsidian-900">{value}</span>
                </span>
              </li>
            ))}
          </ul>
        </article>

        {/* What you need next */}
        <aside className="space-y-5 print:mt-6" aria-label="Trip details">
          <section aria-labelledby="pickup-heading" className="rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07] sm:p-7">
            <h2 id="pickup-heading" className="flex items-center gap-2 text-lg text-obsidian-900">
              <MapPin className="h-5 w-5 text-ocean-600" aria-hidden="true" />
              Your pickup
            </h2>
            <p className="mt-3 text-base text-obsidian-900">{pickupName}</p>
            {pickupAddress && <p className="text-sm text-slate-600">{pickupAddress}</p>}
            {booking.pickupStop?.instructions && <p className="mt-3 text-sm leading-relaxed text-slate-700">{booking.pickupStop.instructions}</p>}
            <p className="mt-4 rounded-2xl bg-summit-100 px-4 py-3 text-sm text-obsidian-900">
              Please be there 10 minutes early{booking.pickupTime ? ` (by ${clock(booking.pickupTime)})` : ""}. Vehicles leave on time.
            </p>
            {directions && (
              <a
                href={directions}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 border-b border-ocean-600 pb-0.5 text-sm text-obsidian-900 print:hidden"
              >
                Get directions
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">(opens Google Maps in a new tab)</span>
              </a>
            )}
          </section>

          {!cancelled && (
            <section aria-labelledby="tracking-heading" className="rounded-[1.75rem] bg-obsidian-950 p-6 text-white sm:p-7 print:hidden">
              <h2 id="tracking-heading" className="flex items-center gap-2 text-lg text-white">
                <Navigation className="h-5 w-5 text-summit-400" aria-hidden="true" />
                Track your vehicle on the day
              </h2>
              {/* No link here: the voucher opens with just the reference, and a reference must not
                  reveal the vehicle's live location. The private link goes to the guest's phone. */}
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                About an hour before pickup we send a private live tracking link by WhatsApp to the phone number on this booking. Open it to see your shuttle on the map.
              </p>
            </section>
          )}

          <section aria-labelledby="summary-heading" className="rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07] sm:p-7">
            <h2 id="summary-heading" className="text-lg text-obsidian-900">
              Price summary
            </h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              {booking.subtotal != null && (
                <div className="flex justify-between gap-4 text-slate-700">
                  <dt>{title}</dt>
                  <dd className="shrink-0">{money(booking.subtotal)}</dd>
                </div>
              )}
              {booking.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-4 text-slate-700">
                  <dt>
                    {item.name} × {item.quantity}
                  </dt>
                  <dd className="shrink-0">{money(item.price * item.quantity)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-t border-obsidian-900/[0.08] pt-3 text-base text-obsidian-900">
                <dt>Total paid</dt>
                <dd className="shrink-0">
                  {money(booking.totalAmount)} {booking.currency}
                </dd>
              </div>
            </dl>
          </section>

          {!cancelled &&
            (canCancelFree(departure.date, departure.departureTime) ? (
              <p className="flex items-start gap-2.5 rounded-[1.75rem] bg-emerald-50 p-5 text-sm text-emerald-900 ring-1 ring-emerald-200 print:hidden">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                <span>
                  <span className="block text-base">Free cancellation up to 72 hours before</span>
                  Plans changed? Cancel from{" "}
                  <Link href="/account/trips" className="underline underline-offset-2">
                    My trips
                  </Link>
                  . See the{" "}
                  <Link href="/cancellation-policy" className="underline underline-offset-2">
                    cancellation policy
                  </Link>{" "}
                  for groups of 7 or more.
                </span>
              </p>
            ) : (
              <p className="rounded-[1.75rem] bg-obsidian-50 p-5 text-sm text-slate-700 ring-1 ring-obsidian-900/[0.07] print:hidden">
                <span className="block text-base text-obsidian-900">Departing within 72 hours</span>
                Free cancellation has ended for this trip. Need to change something? Call us and we&apos;ll do what we can.
              </p>
            ))}

          <section aria-labelledby="help-heading" className="rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07] sm:p-7">
            <h2 id="help-heading" className="text-lg text-obsidian-900">
              Need help?
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li>
                <a href="tel:+18257349456" className="inline-flex items-center gap-2 text-obsidian-900 hover:text-ocean-700">
                  <Phone className="h-4 w-4 text-ocean-600" aria-hidden="true" />
                  +1 (825) 734-9456 · 6 a.m. – 9 p.m. MT
                </a>
              </li>
              <li>
                <a href="mailto:support@vistachase.com" className="inline-flex items-center gap-2 text-obsidian-900 hover:text-ocean-700">
                  <Mail className="h-4 w-4 text-ocean-600" aria-hidden="true" />
                  support@vistachase.com
                </a>
              </li>
            </ul>
            <p className="mt-4 text-xs text-slate-600">Vista Chase · 121 Bow Meadows Crescent #110, Canmore, AB</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
