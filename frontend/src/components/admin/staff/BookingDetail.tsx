"use client";

// One booking: guest and party, pickup, add-ons, payments, flags and its audit trail, plus admin
// notes, Resend voucher and (managers only) Approve for a booking waiting for payment and the staff
// cancellation with a recorded refund choice.

import { TripSection, type AdminTrip } from "@/components/admin/staff/TripSection";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  BOOKING_STATUS_STYLE,
  Chip,
  FLAG_LABEL,
  Loading,
  Panel,
  adminApi,
  dangerBtn,
  errorOf,
  field,
  labelCls,
  money,
  quietBtn,
  when,
  words,
} from "@/components/admin/staff/shared";
import {
  dateOf,
  experienceOf,
  type BookingRow,
} from "@/components/admin/staff/BookingsPanel";
import { ApproveBookingForm } from "@/components/admin/staff/RequestsPanel";

interface Flag {
  id: string;
  type: string;
  status: "OPEN" | "RESOLVED";
  note: string | null;
  amount: number | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface Detail extends Omit<BookingRow, "flags" | "trip"> {
  adultsCount: number;
  childrenCount: number;
  infantsCount: number;
  pickupStop: { name: string; town: string } | null;
  items: { name: string; price: number; quantity: number }[];
  payments: {
    id: string;
    amount: number;
    currency: string;
    provider: string;
    status: string;
    createdAt: string;
  }[];
  flags: Flag[];
  trip: AdminTrip | null;
  confirmationEmailSentAt: string | null;
  confirmationEmailError: string | null;
  emailDelivery?: boolean;
}

interface HistoryRow {
  id: string;
  action: string;
  details: unknown;
  createdAt: string;
  user: { name: string | null; email: string } | null;
}

interface CancelResult {
  paid: number;
  refundOwed: number;
  refunded: number;
  refundDue: number;
  flagId: string | null;
}

const CANCELLABLE = ["PENDING_PAYMENT", "CONFIRMED", "PAID_UNSYNCED"];
const APPROVABLE = ["PENDING_PAYMENT", "PAID_UNSYNCED"];
const MANAGERS = ["ADMIN", "OPERATOR"];

const REFUNDS: {
  value: "POLICY" | "FULL" | "NONE";
  label: string;
  hint: string;
}[] = [
  {
    value: "POLICY",
    label: "By the policy",
    hint: "Full refund, except private multi-day packages, which keep 20% of the total.",
  },
  {
    value: "FULL",
    label: "Full refund",
    hint: "Refund everything the guest paid.",
  },
  {
    value: "NONE",
    label: "No refund",
    hint: "Keep what was paid. Nothing is owed back.",
  },
];

const PROVIDER_LABEL = (p: string) =>
  p.toLowerCase() === "offline" ? "Recorded by staff" : words(p);

export function BookingDetail({
  id,
  role,
  notify,
  onChanged,
  onClose,
}: {
  id: string;
  role: string;
  notify: (m: string) => void;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [booking, setBooking] = useState<Detail | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [viaProvider, setViaProvider] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [cancelled, setCancelled] = useState<CancelResult | null>(null);
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    const res = await adminApi<{
      booking: Detail;
      history: HistoryRow[];
      refundsViaProvider: boolean;
    }>(`/bookings/${encodeURIComponent(id)}`);
    if (!res.ok)
      return setError(errorOf(res.data, "Couldn't load this booking."));
    setError("");
    setBooking(res.data.booking);
    setHistory(res.data.history ?? []);
    setViaProvider(Boolean(res.data.refundsViaProvider));
    setNotes(res.data.booking.adminNotes ?? "");
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Move to the detail when it opens so keyboard and screen reader users land on it.
  useEffect(() => {
    const el = document.getElementById("staff-booking-detail");
    el?.scrollIntoView({ block: "start", behavior: "smooth" });
    el?.focus({ preventScroll: true });
  }, [id]);

  async function saveNotes(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await adminApi(`/bookings/${encodeURIComponent(id)}`, "PATCH", {
      adminNotes: notes.trim() ? notes.trim() : null,
    });
    setBusy(false);
    notify(
      res.ok
        ? "Admin notes saved."
        : errorOf(res.data, "Couldn't save the notes."),
    );
    if (res.ok) {
      await load();
      onChanged();
    }
  }

  async function resend() {
    setBusy(true);
    const res = await adminApi(
      `/bookings/${encodeURIComponent(id)}/resend-voucher`,
      "POST",
      {},
    );
    setBusy(false);
    notify(
      res.ok
        ? `Voucher${booking && ["CONFIRMED", "COMPLETED"].includes(booking.status) ? " and PDF itinerary" : ""} sent to ${booking?.customerEmail ?? "the guest"}.`
        : errorOf(res.data, "Couldn't send the voucher."),
    );
    if (res.ok) await load();
  }

  const canApprove = Boolean(
    booking && MANAGERS.includes(role) && APPROVABLE.includes(booking.status),
  );
  const canCancel = Boolean(
    booking && MANAGERS.includes(role) && CANCELLABLE.includes(booking.status),
  );

  return (
    <div
      id="staff-booking-detail"
      tabIndex={-1}
      className="scroll-mt-24 focus:outline-none"
    >
      <Panel
        id="staff-booking-detail-panel"
        title={booking ? `Booking ${booking.bookingReference}` : "Booking"}
        description={
          booking ? `${experienceOf(booking)} · ${dateOf(booking)}` : undefined
        }
        actions={
          <>
            {booking && (
              <button
                type="button"
                className={quietBtn}
                onClick={resend}
                disabled={busy}
              >
                Resend voucher
              </button>
            )}
            <button type="button" className={quietBtn} onClick={onClose}>
              Close
            </button>
          </>
        }
      >
        {error && (
          <p
            role="alert"
            className="mx-6 my-4 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200"
          >
            {error}
          </p>
        )}
        {!booking ? (
          !error && <Loading />
        ) : (
          <div className="divide-y divide-obsidian-900/[0.06]">
            <div className="grid gap-6 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
              <Fact label="Status">
                <Chip
                  className={
                    BOOKING_STATUS_STYLE[booking.status] ??
                    "bg-obsidian-100 text-slate-700"
                  }
                >
                  {words(booking.status)}
                </Chip>
                {booking.isBoarded && (
                  <span className="mt-1 block text-sm text-slate-600">
                    Boarded
                  </span>
                )}
              </Fact>
              <Fact label="Guest">
                <span className="block">{booking.customerName}</span>
                <a
                  href={`mailto:${booking.customerEmail}`}
                  className="block break-all text-sm text-ocean-700 underline-offset-4 hover:underline"
                >
                  {booking.customerEmail}
                </a>
                {booking.customerPhone && (
                  <a
                    href={`tel:${booking.customerPhone}`}
                    className="block text-sm text-ocean-700 underline-offset-4 hover:underline"
                  >
                    {booking.customerPhone}
                  </a>
                )}
              </Fact>
              <Fact label="Party">
                <span className="block">
                  {booking.adultsCount} adult
                  {booking.adultsCount === 1 ? "" : "s"}
                  {booking.childrenCount > 0 &&
                    `, ${booking.childrenCount} child${booking.childrenCount === 1 ? "" : "ren"}`}
                  {booking.infantsCount > 0 &&
                    `, ${booking.infantsCount} infant${booking.infantsCount === 1 ? "" : "s"}`}
                </span>
                <span className="block text-sm text-slate-600">
                  {booking.totalSeats} seat{booking.totalSeats === 1 ? "" : "s"}{" "}
                  · {money(booking.totalAmount, booking.currency)}
                </span>
              </Fact>
              <Fact label="Pickup">
                <span className="block">
                  {booking.pickupStop
                    ? `${booking.pickupStop.name}, ${booking.pickupStop.town}`
                    : booking.pickupCustomText || "Not set"}
                </span>
                {booking.pickupStop && booking.pickupCustomText && (
                  <span className="block text-sm text-slate-600">
                    {booking.pickupCustomText}
                  </span>
                )}
                <span className="block text-sm text-slate-600">
                  {booking.pickupTime
                    ? `At ${booking.pickupTime}`
                    : "No pickup time"}
                </span>
              </Fact>
              {booking.specialRequests && (
                <Fact label="Special requests" wide>
                  <span className="block whitespace-pre-line text-base">
                    {booking.specialRequests}
                  </span>
                </Fact>
              )}
              <Fact label="Booked">
                <span className="block text-sm">{when(booking.createdAt)}</span>
              </Fact>
            </div>

            <TripSection
              reference={booking.bookingReference}
              trip={booking.trip}
              emailSentAt={booking.confirmationEmailSentAt}
              emailError={booking.confirmationEmailError}
              emailDelivery={booking.emailDelivery !== false}
              canLink={MANAGERS.includes(role)}
              notify={notify}
              onChanged={() => {
                void load();
                onChanged();
              }}
            />

            <Section title="Add-ons">
              {booking.items.length === 0 ? (
                <p className="text-sm text-slate-600">None.</p>
              ) : (
                <ul className="space-y-1 text-base">
                  {booking.items.map((it, i) => (
                    <li
                      key={`${it.name}-${i}`}
                      className="flex justify-between gap-4"
                    >
                      <span>
                        {it.name} × {it.quantity}
                      </span>
                      <span className="tabular-nums text-sm text-slate-700">
                        {money(it.price * it.quantity, booking.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Payments">
              {booking.payments.length === 0 ? (
                <p className="text-sm text-slate-600">No payments recorded.</p>
              ) : (
                <ul className="space-y-2 text-base">
                  {booking.payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span>
                        {money(p.amount, p.currency)}{" "}
                        <span className="text-sm text-slate-600">
                          · {PROVIDER_LABEL(p.provider)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-sm text-slate-600">
                        <Chip className="bg-obsidian-100 text-slate-700">
                          {words(p.status)}
                        </Chip>
                        {when(p.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Flags">
              {booking.flags.length === 0 ? (
                <p className="text-sm text-slate-600">No flags.</p>
              ) : (
                <ul className="space-y-3">
                  {booking.flags.map((f) => (
                    <li key={f.id} className="text-base">
                      <span className="flex flex-wrap items-center gap-2">
                        <Chip
                          className={
                            f.status === "OPEN"
                              ? "bg-summit-100 text-obsidian-900"
                              : "bg-obsidian-100 text-slate-700"
                          }
                        >
                          {FLAG_LABEL[f.type] ?? words(f.type)}
                        </Chip>
                        <span className="text-sm text-slate-600">
                          {f.status === "OPEN"
                            ? "Open"
                            : `Resolved ${when(f.resolvedAt)}`}
                          {f.amount != null &&
                            ` · ${money(f.amount, booking.currency)}`}
                        </span>
                      </span>
                      {f.note && (
                        <span className="mt-1 block text-sm text-slate-700">
                          {f.note}
                        </span>
                      )}
                      {f.resolution && (
                        <span className="mt-1 block text-sm text-slate-600">
                          Resolution: {f.resolution}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {booking.flags.some((f) => f.status === "OPEN") && (
                <p className="mt-3 text-sm text-slate-600">
                  Work open flags on the Flags tab.
                </p>
              )}
            </Section>

            <Section title="History">
              {history.length === 0 ? (
                <p className="text-sm text-slate-600">Nothing recorded yet.</p>
              ) : (
                <ol className="space-y-2 text-base">
                  {history.map((h) => (
                    <li key={h.id} className="flex flex-wrap gap-x-3">
                      <span className="text-sm tabular-nums text-slate-600">
                        {when(h.createdAt)}
                      </span>
                      <span>{words(h.action)}</span>
                      <span className="text-sm text-slate-600">
                        {h.user ? h.user.name || h.user.email : "System"}
                      </span>
                      {reasonOf(h.details) && (
                        <span className="basis-full text-sm text-slate-700">
                          {reasonOf(h.details)}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </Section>

            <Section title="Admin notes">
              <form onSubmit={saveNotes} className="space-y-3">
                <div>
                  <label htmlFor="staff-booking-notes" className={labelCls}>
                    Notes for staff (the guest never sees these)
                  </label>
                  <textarea
                    id="staff-booking-notes"
                    rows={3}
                    maxLength={2000}
                    className={field}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className={quietBtn}
                  disabled={busy || notes === (booking.adminNotes ?? "")}
                >
                  Save notes
                </button>
              </form>
            </Section>

            {canApprove && !cancelled && (
              <Section title="Approve booking">
                {!approving ? (
                  <button
                    type="button"
                    className={quietBtn}
                    onClick={() => setApproving(true)}
                  >
                    Approve booking
                  </button>
                ) : (
                  <ApproveBookingForm
                    booking={{
                      ...booking,
                      paid: booking.payments
                        .filter((p) => p.status === "SUCCEEDED")
                        .reduce((sum, p) => sum + p.amount, 0),
                    }}
                    onCancel={() => setApproving(false)}
                    onDone={async (m) => {
                      notify(m);
                      setApproving(false);
                      await load();
                      onChanged();
                    }}
                  />
                )}
              </Section>
            )}

            {cancelled ? (
              <Section title="Cancelled">
                <CancelSummary
                  result={cancelled}
                  currency={booking.currency}
                  viaProvider={viaProvider}
                />
              </Section>
            ) : (
              canCancel && (
                <CancelForm
                  id={id}
                  reference={booking.bookingReference}
                  viaProvider={viaProvider}
                  notify={notify}
                  onCancelled={async (r) => {
                    setCancelled(r);
                    await load();
                    onChanged();
                  }}
                />
              )
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

function reasonOf(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  const d = details as Record<string, unknown>;
  const text = [d.reason, d.resolution, d.note].find(
    (v) => typeof v === "string" && v.trim(),
  );
  return typeof text === "string" ? text : "";
}

function Fact({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="text-sm text-slate-600">{label}</p>
      <div className="mt-1 text-base text-obsidian-900">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-6 py-5">
      <h3 className="mb-3 text-lg text-obsidian-900">{title}</h3>
      {children}
    </section>
  );
}

function CancelForm({
  id,
  reference,
  viaProvider,
  notify,
  onCancelled,
}: {
  id: string;
  reference: string;
  viaProvider: boolean;
  notify: (m: string) => void;
  onCancelled: (r: CancelResult) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState<"POLICY" | "FULL" | "NONE">("POLICY");
  const [notifyGuest, setNotifyGuest] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function review(e: FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3)
      return setError("Give a reason of at least 3 characters.");
    setError("");
    setConfirming(true);
  }

  async function submit() {
    setBusy(true);
    const res = await adminApi<CancelResult>(
      `/bookings/${encodeURIComponent(id)}/cancel`,
      "POST",
      { reason: reason.trim(), refund, notifyGuest },
    );
    setBusy(false);
    if (!res.ok) {
      setConfirming(false);
      return setError(errorOf(res.data, "Couldn't cancel this booking."));
    }
    notify(`Booking ${reference} cancelled.`);
    await onCancelled(res.data);
  }

  return (
    <Section title="Cancel booking">
      {!open ? (
        <button
          type="button"
          className={dangerBtn}
          onClick={() => setOpen(true)}
        >
          Cancel booking
        </button>
      ) : (
        <form onSubmit={review} className="max-w-2xl space-y-4">
          <div>
            <label htmlFor="staff-cancel-reason" className={labelCls}>
              Reason (kept in the history)
            </label>
            <textarea
              id="staff-cancel-reason"
              required
              minLength={3}
              maxLength={500}
              rows={3}
              className={field}
              value={reason}
              disabled={confirming}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <fieldset disabled={confirming}>
            <legend className={labelCls}>Refund</legend>
            <div className="space-y-2">
              {REFUNDS.map((r) => (
                <label
                  key={r.value}
                  htmlFor={`staff-cancel-refund-${r.value}`}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-obsidian-900/10 px-4 py-3"
                >
                  <input
                    id={`staff-cancel-refund-${r.value}`}
                    type="radio"
                    name="staff-cancel-refund"
                    value={r.value}
                    checked={refund === r.value}
                    onChange={() => setRefund(r.value)}
                    className="mt-1 h-4 w-4 accent-ocean-600"
                  />
                  <span>
                    <span className="block text-base text-obsidian-900">
                      {r.label}
                    </span>
                    <span className="block text-sm text-slate-600">
                      {r.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label
            htmlFor="staff-cancel-notify"
            className="inline-flex cursor-pointer items-center gap-3 text-base text-obsidian-900"
          >
            <input
              id="staff-cancel-notify"
              type="checkbox"
              className="h-5 w-5 accent-ocean-600"
              checked={notifyGuest}
              disabled={confirming}
              onChange={(e) => setNotifyGuest(e.target.checked)}
            />
            Email the guest
          </label>
          <p
            className={`rounded-2xl px-5 py-3 text-sm ${viaProvider ? "bg-ocean-50 text-ocean-800" : "bg-summit-100 text-obsidian-900"}`}
          >
            {viaProvider
              ? "Any refund goes back to the guest through the payment provider."
              : "No money is sent from here. The refund is recorded as owed; send it by hand, then press Mark refunded on the Flags tab."}
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          {!confirming ? (
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={dangerBtn}>
                Review cancellation
              </button>
              <button
                type="button"
                className={quietBtn}
                onClick={() => setOpen(false)}
              >
                Keep booking
              </button>
            </div>
          ) : (
            <div
              role="group"
              aria-labelledby="staff-cancel-confirm"
              className="space-y-3 rounded-2xl bg-red-50 px-5 py-4 ring-1 ring-red-200"
            >
              <p id="staff-cancel-confirm" className="text-base text-red-800">
                Cancel {reference}? Seats are released and this can&apos;t be
                undone.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-red-700 px-5 text-sm text-white hover:bg-red-800 disabled:opacity-60"
                  onClick={submit}
                  disabled={busy}
                >
                  {busy ? "Cancelling…" : "Yes, cancel booking"}
                </button>
                <button
                  type="button"
                  className={quietBtn}
                  onClick={() => setConfirming(false)}
                  disabled={busy}
                >
                  Go back
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </Section>
  );
}

function CancelSummary({
  result,
  currency,
  viaProvider,
}: {
  result: CancelResult;
  currency: string;
  viaProvider: boolean;
}) {
  return (
    <div className="space-y-2 text-base">
      <dl className="grid max-w-xl grid-cols-3 gap-4">
        <div>
          <dt className="text-sm text-slate-600">Paid</dt>
          <dd className="tabular-nums">{money(result.paid, currency)}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">Refund owed</dt>
          <dd className="tabular-nums">{money(result.refundOwed, currency)}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">Refunded</dt>
          <dd className="tabular-nums">{money(result.refunded, currency)}</dd>
        </div>
      </dl>
      {result.refundOwed > 0 && !viaProvider && (
        <p className="text-sm text-slate-700">
          The refund is recorded as owed. Send it by hand, then press Mark
          refunded on the Flags tab.
        </p>
      )}
    </div>
  );
}
