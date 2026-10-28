"use client";

// Requests staff decide on: guests' cancellation requests from My trips (approve = cancel with a
// refund choice, or decline with a reason the guest is emailed) and bookings waiting for staff to
// approve them (the card payment failed or never finished). Approve and Decline are for managers;
// everyone on the bookings screen can see the queue and open a booking.

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Dropdown } from "@/components/forms/Dropdown";
import { BookingDetail } from "@/components/admin/staff/BookingDetail";
import { clockOnly, dayOnly } from "@/components/admin/staff/BookingsPanel";
import { PAYMENT_METHODS } from "@/components/admin/staff/FlagsPanel";
import {
  BOOKING_STATUS_STYLE,
  Chip,
  Empty,
  Loading,
  Panel,
  adminApi,
  dangerBtn,
  errorOf,
  field,
  labelCls,
  money,
  primaryBtn,
  quietBtn,
  when,
  words,
} from "@/components/admin/staff/shared";

interface RequestBooking {
  id: string;
  bookingReference: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalSeats: number;
  totalAmount: number;
  paid: number;
  currency: string;
  paymentPlan: string;
  createdAt: string;
  paymentExpiresAt: string | null;
  experience: string;
  date: string;
  departureTime: string;
}

interface CancelRequest {
  id: string;
  note: string | null;
  policyRefund: number | null;
  createdAt: string;
  booking: RequestBooking;
}

const MANAGERS = ["ADMIN", "OPERATOR"];

export const APPROVE_METHODS = [
  ...PAYMENT_METHODS,
  { value: "UNPAID", label: "Not paid yet (payment due)" },
];

type Active =
  | { id: string; action: "approve-cancel" | "decline" }
  | { id: string; action: "approve-booking" }
  | null;

export function RequestsPanel({
  notify,
  role,
  onCounts,
}: {
  notify: (m: string) => void;
  role: string;
  onCounts?: (n: number) => void;
}) {
  const [cancellations, setCancellations] = useState<CancelRequest[] | null>(
    null,
  );
  const [pending, setPending] = useState<RequestBooking[] | null>(null);
  const [viaProvider, setViaProvider] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState<Active>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const isManager = MANAGERS.includes(role);

  const load = useCallback(async () => {
    const res = await adminApi<{
      cancellations: CancelRequest[];
      awaitingApproval: RequestBooking[];
      refundsViaProvider: boolean;
    }>("/requests");
    if (!res.ok) return setError(errorOf(res.data, "Couldn't load requests."));
    setError("");
    setCancellations(res.data.cancellations);
    setPending(res.data.awaitingApproval);
    setViaProvider(Boolean(res.data.refundsViaProvider));
    onCounts?.(
      res.data.cancellations.length + res.data.awaitingApproval.length,
    );
  }, [onCounts]);

  useEffect(() => {
    void load();
  }, [load]);

  async function done(m: string) {
    notify(m);
    setActive(null);
    await load();
  }

  const toggle = (next: NonNullable<Active>) =>
    setActive(
      active?.id === next.id && active.action === next.action ? null : next,
    );

  return (
    <div className="space-y-6">
      {error && (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200"
        >
          {error}
        </p>
      )}

      <Panel
        id="staff-cancel-requests"
        title="Cancellation requests"
        description="Guests who asked to cancel from My trips. Their booking stays active until you approve or decline."
      >
        {!cancellations ? (
          <Loading />
        ) : cancellations.length === 0 ? (
          <Empty>No cancellation requests waiting.</Empty>
        ) : (
          <ul className="divide-y divide-obsidian-900/[0.06]">
            {cancellations.map((r) => {
              const b = r.booking;
              const on = (a: "approve-cancel" | "decline") =>
                active?.id === r.id && active.action === a;
              return (
                <li key={r.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <BookingSummary
                      b={b}
                      extra={`Asked ${when(r.createdAt)}`}
                    />
                    <div className="flex flex-wrap gap-2">
                      {isManager && (
                        <>
                          <button
                            type="button"
                            className={
                              on("approve-cancel") ? primaryBtn : quietBtn
                            }
                            aria-expanded={on("approve-cancel")}
                            onClick={() =>
                              toggle({ id: r.id, action: "approve-cancel" })
                            }
                          >
                            Approve cancellation
                            <span className="sr-only">
                              {" "}
                              for {b.bookingReference}
                            </span>
                          </button>
                          <button
                            type="button"
                            className={on("decline") ? primaryBtn : quietBtn}
                            aria-expanded={on("decline")}
                            onClick={() =>
                              toggle({ id: r.id, action: "decline" })
                            }
                          >
                            Decline
                            <span className="sr-only">
                              {" "}
                              request for {b.bookingReference}
                            </span>
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className={quietBtn}
                        onClick={() => setOpenId(b.id)}
                      >
                        Open booking
                      </button>
                    </div>
                  </div>
                  {r.note && (
                    <p className="mt-2 text-sm text-slate-700">{r.note}</p>
                  )}
                  {on("approve-cancel") && (
                    <ApproveCancelForm
                      request={r}
                      viaProvider={viaProvider}
                      onCancel={() => setActive(null)}
                      onDone={done}
                    />
                  )}
                  {on("decline") && (
                    <DeclineForm
                      request={r}
                      onCancel={() => setActive(null)}
                      onDone={done}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel
        id="staff-awaiting-approval"
        title="Waiting for approval"
        description="Bookings whose online payment failed or never finished. Approve one when the guest has paid another way (or will pay later); cancel it from the booking to free the seats."
      >
        {!pending ? (
          <Loading />
        ) : pending.length === 0 ? (
          <Empty>No bookings waiting for approval.</Empty>
        ) : (
          <ul className="divide-y divide-obsidian-900/[0.06]">
            {pending.map((b) => {
              const on =
                active?.id === b.id && active.action === "approve-booking";
              return (
                <li key={b.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <BookingSummary
                      b={b}
                      extra={`Booked ${when(b.createdAt)}${b.paymentExpiresAt ? ` · payment window ends ${when(b.paymentExpiresAt)}` : ""}`}
                    />
                    <div className="flex flex-wrap gap-2">
                      {isManager && (
                        <button
                          type="button"
                          className={on ? primaryBtn : quietBtn}
                          aria-expanded={on}
                          onClick={() =>
                            toggle({ id: b.id, action: "approve-booking" })
                          }
                        >
                          Approve
                          <span className="sr-only"> {b.bookingReference}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className={quietBtn}
                        onClick={() => setOpenId(b.id)}
                      >
                        Open booking
                      </button>
                    </div>
                  </div>
                  {on && (
                    <ApproveBookingForm
                      booking={b}
                      onCancel={() => setActive(null)}
                      onDone={done}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {openId && (
        <BookingDetail
          key={openId}
          id={openId}
          role={role}
          notify={notify}
          onChanged={load}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function BookingSummary({ b, extra }: { b: RequestBooking; extra: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-base text-obsidian-900">
        <span className="font-mono">{b.bookingReference}</span> ·{" "}
        {b.customerName}
        <span className="ml-2 inline-block align-middle">
          <Chip
            className={
              BOOKING_STATUS_STYLE[b.status] ?? "bg-obsidian-100 text-slate-700"
            }
          >
            {words(b.status)}
          </Chip>
        </span>
      </p>
      <p className="text-sm text-slate-600">
        {b.experience} · {dayOnly(b.date)} · {clockOnly(b.departureTime)} ·{" "}
        {b.totalSeats} guest{b.totalSeats === 1 ? "" : "s"} · Total{" "}
        {money(b.totalAmount, b.currency)} · Paid {money(b.paid, b.currency)}
      </p>
      <p className="text-sm text-slate-600">
        {b.customerEmail} · {b.customerPhone}
      </p>
      <p className="text-sm text-slate-600">{extra}</p>
    </div>
  );
}

function NotifyBox({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="inline-flex cursor-pointer items-center gap-3 text-base text-obsidian-900"
    >
      <input
        id={id}
        type="checkbox"
        className="h-5 w-5 accent-ocean-600"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      Email the guest
    </label>
  );
}

function ApproveCancelForm({
  request,
  viaProvider,
  onCancel,
  onDone,
}: {
  request: CancelRequest;
  viaProvider: boolean;
  onCancel: () => void;
  onDone: (m: string) => Promise<void>;
}) {
  const b = request.booking;
  const [refund, setRefund] = useState<"POLICY" | "FULL" | "NONE">("POLICY");
  const [note, setNote] = useState("");
  const [notifyGuest, setNotifyGuest] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pre = `req-${request.id}`;
  const options = [
    {
      value: "POLICY" as const,
      label: `By the policy: ${money(request.policyRefund ?? 0, b.currency)}`,
      hint: "What the cancellation policy gave back when the guest asked: nothing inside 72 hours of departure; otherwise a full refund for 1–6 guests, and groups of 7+, multi-day trips and deposit bookings keep the 20% deposit.",
    },
    {
      value: "FULL" as const,
      label: `Full refund: ${money(b.paid, b.currency)}`,
      hint: "Everything the guest paid.",
    },
    { value: "NONE" as const, label: "No refund", hint: "Keep what was paid." },
  ];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await adminApi<{ refundOwed: number }>(
      `/requests/${encodeURIComponent(request.id)}/approve`,
      "POST",
      { refund, notifyGuest, ...(note.trim() ? { note: note.trim() } : {}) },
    );
    setBusy(false);
    if (!res.ok)
      return setError(errorOf(res.data, "Couldn't cancel this booking."));
    await onDone(
      `${b.bookingReference} cancelled. Refund ${money(res.data.refundOwed ?? 0, b.currency)}${viaProvider ? "" : " recorded as owed on the Flags tab"}.`,
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 max-w-2xl space-y-4 rounded-2xl bg-obsidian-50/60 p-5"
    >
      <fieldset>
        <legend className={labelCls}>Refund</legend>
        <div className="space-y-2">
          {options.map((o) => (
            <label
              key={o.value}
              htmlFor={`${pre}-${o.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-none border border-obsidian-900/10 bg-white px-4 py-3"
            >
              <input
                id={`${pre}-${o.value}`}
                type="radio"
                name={`${pre}-refund`}
                checked={refund === o.value}
                onChange={() => setRefund(o.value)}
                className="mt-1 h-4 w-4 accent-ocean-600"
              />
              <span>
                <span className="block text-base text-obsidian-900">
                  {o.label}
                </span>
                <span className="block text-sm text-slate-600">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={`${pre}-note`} className={labelCls}>
          Note for the history (optional)
        </label>
        <input
          id={`${pre}-note`}
          maxLength={500}
          className={field}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <NotifyBox
        id={`${pre}-notify`}
        checked={notifyGuest}
        onChange={setNotifyGuest}
      />
      <p
        className={`rounded-2xl px-5 py-3 text-sm ${viaProvider ? "bg-ocean-50 text-ocean-800" : "bg-summit-100 text-obsidian-900"}`}
      >
        {viaProvider
          ? "Seats are released at once and any refund goes back through the payment provider."
          : "Seats are released at once. No money is sent from here: the refund is recorded as owed; send it by hand, then press Mark refunded on the Flags tab."}
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={dangerBtn} disabled={busy}>
          {busy ? "Cancelling…" : `Cancel ${b.bookingReference}`}
        </button>
        <button
          type="button"
          className={quietBtn}
          onClick={onCancel}
          disabled={busy}
        >
          Go back
        </button>
      </div>
    </form>
  );
}

function DeclineForm({
  request,
  onCancel,
  onDone,
}: {
  request: CancelRequest;
  onCancel: () => void;
  onDone: (m: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [notifyGuest, setNotifyGuest] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pre = `decline-${request.id}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await adminApi(
      `/requests/${encodeURIComponent(request.id)}/decline`,
      "POST",
      { reason: reason.trim(), notifyGuest },
    );
    setBusy(false);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't decline this."));
    await onDone(
      `Request for ${request.booking.bookingReference} declined; the booking stays active.`,
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 max-w-2xl space-y-4 rounded-2xl bg-obsidian-50/60 p-5"
    >
      <div>
        <label htmlFor={`${pre}-reason`} className={labelCls}>
          Reason (the guest sees this)
        </label>
        <textarea
          id={`${pre}-reason`}
          required
          minLength={3}
          maxLength={500}
          rows={3}
          className={field}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <NotifyBox
        id={`${pre}-notify`}
        checked={notifyGuest}
        onChange={setNotifyGuest}
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={primaryBtn} disabled={busy}>
          {busy ? "Saving…" : "Decline request"}
        </button>
        <button
          type="button"
          className={quietBtn}
          onClick={onCancel}
          disabled={busy}
        >
          Go back
        </button>
      </div>
    </form>
  );
}

/** Confirms a booking waiting for payment: paid another way, or with the payment still due. */
export function ApproveBookingForm({
  booking,
  onCancel,
  onDone,
}: {
  booking: Pick<
    RequestBooking,
    "id" | "bookingReference" | "status" | "totalAmount" | "paid" | "currency"
  >;
  onCancel: () => void;
  onDone: (m: string) => Promise<void>;
}) {
  const owed = Math.max(0, booking.totalAmount - booking.paid);
  const [method, setMethod] = useState(owed > 0 ? "ETRANSFER" : "OTHER");
  const [reference, setReference] = useState("");
  const [notifyGuest, setNotifyGuest] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pre = `approve-${booking.id}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await adminApi(
      `/bookings/${encodeURIComponent(booking.id)}/approve`,
      "POST",
      {
        payment: {
          method,
          ...(reference.trim() ? { reference: reference.trim() } : {}),
        },
        notifyGuest,
      },
    );
    setBusy(false);
    if (!res.ok)
      return setError(errorOf(res.data, "Couldn't approve this booking."));
    await onDone(
      method === "UNPAID" && owed > 0
        ? `${booking.bookingReference} confirmed; ${money(owed, booking.currency)} is on the Flags tab as payment due.`
        : `${booking.bookingReference} confirmed.`,
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 grid max-w-2xl gap-4 rounded-2xl bg-obsidian-50/60 p-5 sm:grid-cols-2"
    >
      {owed > 0 ? (
        <>
          <Dropdown
            id={`${pre}-method`}
            label={`How the guest paid ${money(owed, booking.currency)}`}
            value={method}
            onChange={setMethod}
            options={APPROVE_METHODS}
          />
          <div>
            <label htmlFor={`${pre}-ref`} className={labelCls}>
              Reference (optional)
            </label>
            <input
              id={`${pre}-ref`}
              maxLength={120}
              className={field}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-700 sm:col-span-2">
          Already paid in full; approving confirms the booking.
        </p>
      )}
      <div className="sm:col-span-2">
        <NotifyBox
          id={`${pre}-notify`}
          checked={notifyGuest}
          onChange={setNotifyGuest}
        />
      </div>
      <p className="rounded-2xl bg-summit-100 px-5 py-3 text-sm text-obsidian-900 sm:col-span-2">
        The booking is confirmed and keeps its seats. Any unfinished card
        payment is set aside; if it goes through later, it settles the payment
        due or is flagged as paid twice.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700 sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" className={primaryBtn} disabled={busy}>
          {busy ? "Approving…" : `Approve ${booking.bookingReference}`}
        </button>
        <button
          type="button"
          className={quietBtn}
          onClick={onCancel}
          disabled={busy}
        >
          Go back
        </button>
      </div>
    </form>
  );
}
