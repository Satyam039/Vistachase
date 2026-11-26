"use client";

// Change a booking (owner, 2026-11-26): guests (e.g. booked 6, one can't join), date, lead name,
// email and guest names, with the invoice, refund and amount due worked out by the backend
// (modules/bookings/booking-changes.ts). Every edit asks the API for a preview first, so staff see
// the seats, the new total, what was paid and the refund or payment before they press Apply.
// Used for a guest's change request (Admin → Requests) and from the Manage booking page.

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Dropdown } from "@/components/forms/Dropdown";
import { adminApi, errorOf, field, labelCls, money, primaryBtn, quietBtn } from "@/components/admin/staff/shared";

export interface ChangeParty {
  adults: number;
  children: number;
  infants: number;
}

export interface ChangeTarget {
  id: string;
  bookingReference: string;
  customerName: string;
  customerEmail: string;
  currency: string;
  guests: ChangeParty;
  date: string;
  departureTime: string;
  category?: string;
  multiDayTrip?: boolean;
}

export interface ChangeAsked {
  newDate: string | null;
  preferredTime: string | null;
  guests: ChangeParty | null;
  customerEmail: string | null;
  guestNames: string | null;
  note: string | null;
}

interface DateOption {
  id: string;
  date: string;
  time: string;
  price: number;
  seatsLeft: number;
  fits: boolean;
  onSale: boolean;
}

interface Preview {
  currency: string;
  nothing: boolean;
  changes: {
    date: { from: string; to: string } | null;
    guests: { from: string; to: string } | null;
    customerName: { from: string; to: string } | null;
    customerEmail: { from: string; to: string } | null;
    guestNames: string | null;
    total: { from: number; to: number } | null;
  };
  seats: { before: number; after: number; moving: boolean };
  invoice: { fare: number; discount: number; addOns: number; kept: number; total: number; pricing: string };
  paid: number;
  refund: number;
  keptNow: number;
  due: number;
  depositBalance: boolean;
  policy: { eligible: boolean; cutoffHours: number; askedAt: string };
  multiDayTrip: { reference: string; days: number } | null;
  bokun: boolean;
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function ChangeBookingForm({
  booking,
  asked,
  requestId,
  viaProvider,
  onCancel,
  onDone,
}: {
  booking: ChangeTarget;
  asked?: ChangeAsked | null;
  requestId?: string;
  viaProvider: boolean;
  onCancel: () => void;
  onDone: (m: string) => Promise<void> | void;
}) {
  const pre = `chg-${requestId ?? booking.id}`;
  const start = asked?.guests ?? booking.guests;
  const [adults, setAdults] = useState(start.adults);
  const [children, setChildren] = useState(start.children);
  const [infants, setInfants] = useState(start.infants);
  const [departureId, setDepartureId] = useState("");
  const [options, setOptions] = useState<DateOption[] | null>(null);
  const [name, setName] = useState(booking.customerName);
  const [email, setEmail] = useState(asked?.customerEmail ?? booking.customerEmail);
  const [guestNames, setGuestNames] = useState(asked?.guestNames ?? "");
  const [repricing, setRepricing] = useState<"KEEP" | "NEW">("KEEP");
  const [refund, setRefund] = useState<"POLICY" | "FULL" | "NONE">("POLICY");
  const [note, setNote] = useState("");
  const [notifyGuest, setNotifyGuest] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Departures of the same tour around the date the guest asked for (or the next weeks).
  useEffect(() => {
    let alive = true;
    const from = asked?.newDate ? addDays(asked.newDate, -3) : booking.date;
    const to = addDays(asked?.newDate ?? booking.date, asked?.newDate ? 4 : 45);
    void adminApi<{ departures: DateOption[] }>(`/bookings/${encodeURIComponent(booking.id)}/date-options?from=${from}&to=${to}`).then((res) => {
      if (!alive) return;
      const list = res.ok ? res.data.departures : [];
      setOptions(list);
      const match = asked?.newDate ? list.find((d) => d.date === asked.newDate && d.fits) : undefined;
      if (match) setDepartureId(match.id);
    });
    return () => {
      alive = false;
    };
  }, [booking.id, booking.date, asked?.newDate]);

  const body = useMemo(
    () => ({
      ...(departureId ? { departureId } : {}),
      guests: { adults, children, infants },
      ...(name.trim() && name.trim() !== booking.customerName ? { customerName: name.trim() } : {}),
      ...(email.trim() && email.trim().toLowerCase() !== booking.customerEmail.toLowerCase() ? { customerEmail: email.trim() } : {}),
      ...(guestNames.trim() ? { guestNames: guestNames.trim() } : {}),
      repricing,
      refund,
      ...(note.trim() ? { note: note.trim() } : {}),
      notifyGuest,
      ...(requestId ? { requestId } : {}),
    }),
    [departureId, adults, children, infants, name, email, guestNames, repricing, refund, note, notifyGuest, requestId, booking.customerName, booking.customerEmail],
  );

  // Preview after each edit (debounced): nothing is saved until Apply.
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      const res = await adminApi<{ preview: Preview }>(`/bookings/${encodeURIComponent(booking.id)}/change/preview`, "POST", body);
      if (!alive) return;
      if (res.ok) {
        setPreview(res.data.preview);
        setPreviewError("");
      } else {
        setPreview(null);
        setPreviewError(errorOf(res.data, "Couldn't work out this change."));
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [body, booking.id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await adminApi<{ refund: number; refunded: number; refundOwed: number; due: number; invoice: { total: number } }>(
      `/bookings/${encodeURIComponent(booking.id)}/change`,
      "POST",
      body,
    );
    setBusy(false);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't change this booking."));
    const c = booking.currency;
    const d = res.data;
    await onDone(
      [
        `${booking.bookingReference} changed. New total ${money(d.invoice.total, c)}.`,
        d.refunded > 0 ? `${money(d.refunded, c)} refunded to the card.` : null,
        d.refundOwed > 0 ? `${money(d.refundOwed, c)} refund owed (Flags tab: send it, then Mark refunded).` : null,
        d.due > 0 ? `${money(d.due, c)} to collect (the guest can pay from the voucher; Flags tab shows it).` : null,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  const c = booking.currency;
  const dateOptions = [
    { value: "", label: `Keep ${booking.date} ${booking.departureTime}` },
    ...(options ?? []).map((d) => ({
      value: d.id,
      label: `${d.date} ${d.time} · ${money(d.price, c)} · ${d.seatsLeft} left`,
      description: !d.onSale ? "Not on sale on the website" : !d.fits ? "Not enough seats" : undefined,
      disabled: !d.fits,
    })),
  ];
  const count = (label: string, value: number, set: (n: number) => void, key: string) => (
    <div>
      <label htmlFor={`${pre}-${key}`} className={labelCls}>
        {label}
      </label>
      <input
        id={`${pre}-${key}`}
        type="number"
        inputMode="numeric"
        min={0}
        max={30}
        className={field}
        value={value}
        onChange={(e) => set(Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
      />
    </div>
  );

  return (
    <form onSubmit={submit} className="mt-4 max-w-3xl space-y-5 rounded-2xl bg-obsidian-50/60 p-5">
      {asked && (
        <div className="rounded-none border border-obsidian-900/10 bg-white px-4 py-3 text-sm text-slate-700">
          <p className="text-obsidian-900">The guest asked for</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {asked.newDate && <li>New date {asked.newDate}{asked.preferredTime ? ` (${asked.preferredTime})` : ""}</li>}
            {asked.guests && (
              <li>
                Guests: {asked.guests.adults} adults, {asked.guests.children} youth, {asked.guests.infants} infants (booked {booking.guests.adults}/{booking.guests.children}/
                {booking.guests.infants})
              </li>
            )}
            {asked.customerEmail && <li>Email {asked.customerEmail}</li>}
            {asked.guestNames && <li>Guest names: {asked.guestNames}</li>}
            {asked.note && <li>Note: {asked.note}</li>}
          </ul>
        </div>
      )}
      {booking.multiDayTrip && (
        <p className="rounded-2xl bg-summit-100 px-5 py-3 text-sm text-obsidian-900">
          This booking is one day of a multi-day trip. A change here applies to this day only: change the other days the same way.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {count("Adults", adults, setAdults, "adults")}
        {count("Youth (6–15)", children, setChildren, "children")}
        {count("Infants (0–5)", infants, setInfants, "infants")}
      </div>

      <Dropdown id={`${pre}-dep`} label="Date and time" value={departureId} onChange={setDepartureId} options={dateOptions} />

      {departureId && (
        <fieldset>
          <legend className={labelCls}>Price on the new date</legend>
          <div className="flex flex-wrap gap-4 text-base text-obsidian-900">
            {(
              [
                ["KEEP", "Keep the price they booked at"],
                ["NEW", "Use the new date's price"],
              ] as const
            ).map(([v, l]) => (
              <label key={v} htmlFor={`${pre}-price-${v}`} className="inline-flex cursor-pointer items-center gap-2">
                <input id={`${pre}-price-${v}`} type="radio" name={`${pre}-price`} checked={repricing === v} onChange={() => setRepricing(v)} className="h-4 w-4 accent-ocean-600" />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${pre}-name`} className={labelCls}>
            Lead guest
          </label>
          <input id={`${pre}-name`} className={field} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label htmlFor={`${pre}-email`} className={labelCls}>
            Email
          </label>
          <input id={`${pre}-email`} type="email" className={field} maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </div>
      </div>
      <div>
        <label htmlFor={`${pre}-names`} className={labelCls}>
          Names of everyone travelling (optional)
        </label>
        <textarea id={`${pre}-names`} rows={2} maxLength={600} className={field} value={guestNames} onChange={(e) => setGuestNames(e.target.value)} />
      </div>

      <fieldset>
        <legend className={labelCls}>If the new total is less than what was paid</legend>
        <div className="space-y-2">
          {(
            [
              ["POLICY", "By the cancellation policy", "The difference back if the guest asked before the deadline (24 hours for shared tours and shuttles, 72 for private tours); nothing after it."],
              ["FULL", "Refund the difference", "Give the difference back whatever the timing."],
              ["NONE", "No refund", "Keep what was paid (shown as non-refundable on the invoice)."],
            ] as const
          ).map(([v, l, hint]) => (
            <label key={v} htmlFor={`${pre}-refund-${v}`} className="flex cursor-pointer items-start gap-3 rounded-none border border-obsidian-900/10 bg-white px-4 py-3">
              <input id={`${pre}-refund-${v}`} type="radio" name={`${pre}-refund`} checked={refund === v} onChange={() => setRefund(v)} className="mt-1 h-4 w-4 accent-ocean-600" />
              <span>
                <span className="block text-base text-obsidian-900">{l}</span>
                <span className="block text-sm text-slate-600">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${pre}-note`} className={labelCls}>
          Note for the history (optional)
        </label>
        <input id={`${pre}-note`} maxLength={500} className={field} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <label htmlFor={`${pre}-notify`} className="inline-flex cursor-pointer items-center gap-3 text-base text-obsidian-900">
        <input id={`${pre}-notify`} type="checkbox" className="h-5 w-5 accent-ocean-600" checked={notifyGuest} onChange={(e) => setNotifyGuest(e.target.checked)} />
        Email the guest the updated booking
      </label>

      <section aria-live="polite" className="rounded-none border border-obsidian-900/10 bg-white px-4 py-4 text-sm text-slate-700">
        <p className="text-base text-obsidian-900">What this change does</p>
        {previewError ? (
          <p role="alert" className="mt-2 text-red-700">
            {previewError}
          </p>
        ) : !preview ? (
          <p className="mt-2">Working it out…</p>
        ) : (
          <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {preview.changes.date && (
              <>
                <dt>Date</dt>
                <dd>
                  {preview.changes.date.from} → {preview.changes.date.to}
                </dd>
              </>
            )}
            {preview.changes.guests && (
              <>
                <dt>Guests</dt>
                <dd>
                  {preview.changes.guests.from} → {preview.changes.guests.to}
                </dd>
              </>
            )}
            <dt>Seats on the departure</dt>
            <dd>
              {preview.seats.before} → {preview.seats.after}
              {preview.invoice.pricing === "PER_VEHICLE" ? " (whole vehicle)" : ""}
            </dd>
            <dt>Invoice</dt>
            <dd>
              Fare {money(preview.invoice.fare, c)}
              {preview.invoice.discount > 0 ? ` − discount ${money(preview.invoice.discount, c)}` : ""}
              {preview.invoice.addOns > 0 ? ` + add-ons ${money(preview.invoice.addOns, c)}` : ""}
              {preview.invoice.kept > 0 ? ` + non-refundable ${money(preview.invoice.kept, c)}` : ""}
            </dd>
            <dt>New total</dt>
            <dd className="text-obsidian-900">
              {preview.changes.total ? `${money(preview.changes.total.from, c)} → ` : ""}
              {money(preview.invoice.total, c)}
            </dd>
            <dt>Paid</dt>
            <dd>{money(preview.paid, c)}</dd>
            {preview.refund > 0 && (
              <>
                <dt>Refund</dt>
                <dd className="text-obsidian-900">
                  {money(preview.refund, c)} {viaProvider ? "back to the card" : "(recorded as owed: send it, then Mark refunded)"}
                </dd>
              </>
            )}
            {preview.keptNow > 0 && (
              <>
                <dt>Kept</dt>
                <dd>
                  {money(preview.keptNow, c)} {preview.policy.eligible ? "" : `(asked inside the ${preview.policy.cutoffHours}-hour deadline)`}
                </dd>
              </>
            )}
            {preview.due > 0 && (
              <>
                <dt>To collect</dt>
                <dd className="text-obsidian-900">
                  {money(preview.due, c)} {preview.depositBalance ? "(added to the balance)" : "(the guest can pay from the voucher)"}
                </dd>
              </>
            )}
            {preview.bokun && (preview.changes.date || preview.changes.guests) && (
              <>
                <dt>Bókun</dt>
                <dd>Rebooked in Bókun with the new details, then the old Bókun booking is cancelled.</dd>
              </>
            )}
          </dl>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={primaryBtn} disabled={busy || !preview || (preview.nothing && !requestId)}>
          {busy ? "Applying…" : `Apply change to ${booking.bookingReference}`}
        </button>
        <button type="button" className={quietBtn} onClick={onCancel} disabled={busy}>
          Go back
        </button>
      </div>
    </form>
  );
}
