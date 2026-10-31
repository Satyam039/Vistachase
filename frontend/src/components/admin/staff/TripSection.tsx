"use client";

// Admin booking detail: the multi-day trip this booking is a day of (every day under the Day 1
// reference), the confirmation email's state, and for managers "Link as one trip" for a private
// multi-day tour booked day by day with Quick Book (POST /api/admin/trips). Linking changes no
// seats, prices or payments: the guest gets one confirmation email and one PDF itinerary.

import { useState, type FormEvent } from "react";
import { adminApi, errorOf, field, labelCls, primaryBtn, when } from "@/components/admin/staff/shared";

export interface AdminTrip {
  title: string;
  reference: string;
  day: number;
  days: { day: number; bookingReference: string; status: string | null; date: string | null; departureTime: string | null; title: string | null }[];
}

export function TripSection({
  reference,
  trip,
  emailSentAt,
  emailError,
  emailDelivery,
  canLink,
  notify,
  onChanged,
}: {
  reference: string;
  trip: AdminTrip | null;
  emailSentAt: string | null;
  emailError: string | null;
  /** False when the server has no email service set up, so "sent" only means written to its log. */
  emailDelivery: boolean;
  canLink: boolean;
  notify: (m: string) => void;
  onChanged: () => void;
}) {
  const [others, setOthers] = useState("");
  const [title, setTitle] = useState("");
  const [notifyGuest, setNotifyGuest] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function link(e: FormEvent) {
    e.preventDefault();
    const references = [reference, ...others.split(/[\s,]+/).map((r) => r.trim().toUpperCase()).filter(Boolean)];
    setBusy(true);
    const res = await adminApi<{ reference: string; email: string | null }>("/trips", "POST", { references, title: title.trim(), notifyGuest });
    setBusy(false);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't link these bookings."));
    setError("");
    notify(
      `Linked as one trip under ${res.data.reference}.${res.data.email === "sent" ? " Confirmation email with the itinerary sent." : res.data.email ? " The email wasn't sent: it goes out once every day is confirmed." : ""}`,
    );
    onChanged();
  }

  return (
    <section className="space-y-4 px-6 py-5">
      <h3 className="text-lg text-obsidian-900">{trip ? `${trip.title} · ${trip.days.length}-day trip` : "Confirmation email"}</h3>
      {trip && (
        <>
          <p className="text-sm text-slate-700">
            Booking reference <span className="font-mono text-obsidian-900">{trip.reference}</span> · this booking is day {trip.day}
          </p>
          <ol className="divide-y divide-obsidian-900/[0.06] text-sm">
            {trip.days.map((d) => (
              <li key={d.bookingReference} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 ${d.bookingReference === reference ? "text-obsidian-900" : "text-slate-700"}`}>
                <span>
                  Day {d.day} · {d.date ?? "?"} {d.departureTime ?? ""} · {d.title ?? "?"}
                </span>
                <span className="font-mono">
                  {d.bookingReference} · {(d.status ?? "").toLowerCase().replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="text-sm text-slate-700">
        {!emailDelivery
          ? "Email isn't set up on the server (EMAIL_PROVIDER=resend with RESEND_API_KEY, or EMAIL_PROVIDER=smtp with SMTP_HOST, SMTP_USER and SMTP_PASS), so the confirmation email was only written to the server log, not sent to the guest. Once email is set up, \"Resend voucher\" sends it."
          : emailSentAt
          ? `Confirmation email with the PDF itinerary sent ${when(emailSentAt)}`
          : emailError
            ? `Confirmation email failed: ${emailError}. It is retried automatically; "Resend voucher" sends it now.`
            : trip && trip.day !== 1
              ? "The trip's confirmation email is tracked on Day 1."
              : "No confirmation email recorded yet (it goes out when the booking is confirmed)."}
      </p>

      {!trip && canLink && (
        <form onSubmit={link} className="grid gap-3 border-t border-obsidian-900/[0.06] pt-4 sm:grid-cols-2">
          <p className="text-sm text-slate-700 sm:col-span-2">
            Private multi-day tour booked day by day? Link the days so the guest gets one reference, one email and one itinerary.
          </p>
          <label className="block">
            <span className={labelCls}>Other days&rsquo; booking references</span>
            <input value={others} onChange={(e) => setOthers(e.target.value)} placeholder="VC-2026-…, VC-2026-…" required className={field} />
          </label>
          <label className="block">
            <span className={labelCls}>Trip name</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Three-Day Rockies Discovery" required minLength={3} maxLength={120} className={field} />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" checked={notifyGuest} onChange={(e) => setNotifyGuest(e.target.checked)} />
            Email the guest the trip confirmation and itinerary
          </label>
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 sm:col-span-2">
              {error}
            </p>
          )}
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? "Linking…" : "Link as one trip"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
