"use client";

// Flags queue: refunds owed, payments due (Quick Book or unpaid), payment mismatches and late
// payments. Managers close them: refunds are marked sent (admins), payments recorded, the rest
// resolved with a note.

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Dropdown } from "@/components/forms/Dropdown";
import { clockOnly, dayOnly } from "@/components/admin/staff/BookingsPanel";
import {
  BOOKING_STATUS_STYLE,
  Chip,
  Empty,
  FLAG_LABEL,
  Loading,
  Panel,
  adminApi,
  errorOf,
  field,
  labelCls,
  money,
  primaryBtn,
  quietBtn,
  when,
  words,
} from "@/components/admin/staff/shared";

interface FlagRow {
  id: string;
  type: string;
  status: "OPEN" | "RESOLVED";
  note: string | null;
  amount: number | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  booking: {
    id: string;
    bookingReference: string;
    status: string;
    customerName: string;
    customerEmail: string;
    totalAmount: number;
    currency: string;
    experience: string | null;
    date: string | null;
    departureTime: string | null;
  } | null;
}

type Action = "refunded" | "payment" | "resolve";

const TYPES = [
  "REFUND_DUE",
  "PAYMENT_DUE",
  "PAYMENT_AMOUNT_MISMATCH",
  "LATE_PAYMENT",
  "OTHER",
];
const MANAGERS = ["ADMIN", "OPERATOR"];
// Same rule as the server: a payment due on a live booking is closed by recording the payment.
const LIVE = ["CONFIRMED", "PAID_UNSYNCED", "COMPLETED"];
export const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "ETRANSFER", label: "E-transfer" },
  { value: "CARD_TERMINAL", label: "Card terminal" },
  { value: "OTHER", label: "Other" },
];

export function FlagsPanel({
  notify,
  role,
}: {
  notify: (m: string) => void;
  role: string;
}) {
  const [flags, setFlags] = useState<FlagRow[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [viaProvider, setViaProvider] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"OPEN" | "RESOLVED">("OPEN");
  const [type, setType] = useState("");
  const [active, setActive] = useState<{ id: string; action: Action } | null>(
    null,
  );

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status });
    if (type) params.set("type", type);
    const res = await adminApi<{
      flags: FlagRow[];
      open: Record<string, number>;
      refundsViaProvider: boolean;
    }>(`/flags?${params}`);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't load flags."));
    setError("");
    setFlags(res.data.flags);
    setCounts(res.data.open ?? {});
    setViaProvider(Boolean(res.data.refundsViaProvider));
  }, [status, type]);

  useEffect(() => {
    void load();
  }, [load]);

  const isManager = MANAGERS.includes(role);
  const isAdmin = role === "ADMIN";
  const openTotal = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <Panel
      id="staff-flags"
      title="Flags"
      description={
        viaProvider
          ? "Things a person needs to check or settle. Refunds go back through the payment provider."
          : "Things a person needs to check or settle. Refunds owed are not sent from here: send them by hand, then mark them refunded."
      }
    >
      <div className="space-y-4 border-b border-obsidian-900/[0.06] px-6 py-4">
        <div className="flex flex-wrap items-end gap-4">
          <div
            role="group"
            aria-label="Flag state"
            className="inline-flex rounded-full bg-obsidian-50 p-1 ring-1 ring-obsidian-900/10"
          >
            {(["OPEN", "RESOLVED"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={status === s}
                onClick={() => {
                  setStatus(s);
                  setActive(null);
                }}
                className={`inline-flex h-10 items-center rounded-full px-5 text-sm ${status === s ? "bg-obsidian-900 text-white" : "text-obsidian-900 hover:bg-white"}`}
              >
                {s === "OPEN" ? "Open" : "Resolved"}
              </button>
            ))}
          </div>
          <Dropdown
            id="staff-flags-type"
            label="Type"
            className="w-full sm:w-64"
            value={type}
            onChange={(v) => {
              setType(v);
              setActive(null);
            }}
            options={[
              { value: "", label: "All types" },
              ...TYPES.map((t) => ({
                value: t,
                label: FLAG_LABEL[t] ?? words(t),
              })),
            ]}
          />
        </div>
        <p className="sr-only">{openTotal} open flags in total.</p>
        {openTotal > 0 ? (
          <ul aria-label="Open flags by type" className="flex flex-wrap gap-2">
            {Object.entries(counts)
              .filter(([, n]) => n > 0)
              .map(([t, n]) => (
                <li key={t}>
                  <Chip className="bg-summit-100 text-obsidian-900">
                    {FLAG_LABEL[t] ?? words(t)}: {n}
                  </Chip>
                </li>
              ))}
          </ul>
        ) : (
          flags && <p className="text-sm text-slate-600">No open flags.</p>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mx-6 my-4 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200"
        >
          {error}
        </p>
      )}

      {!flags ? (
        <Loading />
      ) : flags.length === 0 ? (
        <Empty>
          {status === "OPEN"
            ? "Nothing to settle."
            : "No resolved flags match."}
        </Empty>
      ) : (
        <ul className="divide-y divide-obsidian-900/[0.06]">
          {flags.map((f) => {
            const b = f.booking;
            const cur = b?.currency ?? "CAD";
            const actions: { action: Action; label: string }[] = [];
            if (f.status === "OPEN" && isManager) {
              if (f.type === "REFUND_DUE") {
                if (isAdmin)
                  actions.push({ action: "refunded", label: "Mark refunded" });
              } else if (f.type === "PAYMENT_DUE") {
                actions.push({ action: "payment", label: "Record payment" });
                if (b && !LIVE.includes(b.status))
                  actions.push({ action: "resolve", label: "Resolve" });
              } else actions.push({ action: "resolve", label: "Resolve" });
            }
            const isActive = active?.id === f.id;
            return (
              <li key={f.id} className="px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <Chip
                        className={
                          f.status === "OPEN"
                            ? "bg-summit-100 text-obsidian-900"
                            : "bg-obsidian-100 text-slate-700"
                        }
                      >
                        {FLAG_LABEL[f.type] ?? words(f.type)}
                      </Chip>
                      {f.amount != null && (
                        <span className="tabular-nums text-base text-obsidian-900">
                          {money(f.amount, cur)}
                        </span>
                      )}
                      <span className="text-sm text-slate-600">
                        Raised {when(f.createdAt)}
                      </span>
                    </p>
                    {b ? (
                      <p className="text-base text-obsidian-900">
                        <span className="font-mono">{b.bookingReference}</span>{" "}
                        · {b.customerName}
                        <span className="ml-2 inline-block align-middle">
                          <Chip
                            className={
                              BOOKING_STATUS_STYLE[b.status] ??
                              "bg-obsidian-100 text-slate-700"
                            }
                          >
                            {words(b.status)}
                          </Chip>
                        </span>
                        <span className="block text-sm text-slate-600">
                          {b.experience ?? "–"}
                          {b.date && ` · ${dayOnly(b.date)}`}
                          {b.departureTime &&
                            ` · ${clockOnly(b.departureTime)}`}{" "}
                          · Total {money(b.totalAmount, cur)}
                        </span>
                      </p>
                    ) : (
                      <p className="text-sm text-slate-600">
                        No booking linked.
                      </p>
                    )}
                    {f.note && (
                      <p className="text-sm text-slate-700">{f.note}</p>
                    )}
                    {f.status === "RESOLVED" && (
                      <p className="text-sm text-slate-600">
                        Resolved {when(f.resolvedAt)}
                        {f.resolution && `: ${f.resolution}`}
                      </p>
                    )}
                    {f.status === "OPEN" &&
                      f.type === "REFUND_DUE" &&
                      isManager &&
                      !isAdmin && (
                        <p className="text-sm text-slate-600">
                          An admin marks refunds as sent.
                        </p>
                      )}
                  </div>
                  {actions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {actions.map((a) => {
                        const on = isActive && active?.action === a.action;
                        return (
                          <button
                            key={a.action}
                            type="button"
                            className={on ? primaryBtn : quietBtn}
                            aria-expanded={on}
                            aria-controls={`flag-form-${f.id}`}
                            onClick={() =>
                              setActive(
                                on ? null : { id: f.id, action: a.action },
                              )
                            }
                          >
                            {a.label}
                            {b && (
                              <span className="sr-only">
                                {" "}
                                for {b.bookingReference}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {isActive && active && (
                  <FlagForm
                    key={active.action}
                    flag={f}
                    action={active.action}
                    onCancel={() => setActive(null)}
                    onDone={async (m) => {
                      notify(m);
                      setActive(null);
                      await load();
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function FlagForm({
  flag,
  action,
  onCancel,
  onDone,
}: {
  flag: FlagRow;
  action: Action;
  onCancel: () => void;
  onDone: (m: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState("CASH");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = flag.booking?.bookingReference ?? "the booking";
  const pre = `flag-${flag.id}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const path = `/flags/${encodeURIComponent(flag.id)}/${action === "refunded" ? "mark-refunded" : action === "payment" ? "record-payment" : "resolve"}`;
    const body =
      action === "refunded"
        ? {
            reference: text.trim(),
            ...(note.trim() ? { note: note.trim() } : {}),
          }
        : action === "payment"
          ? { method, ...(text.trim() ? { reference: text.trim() } : {}) }
          : { resolution: text.trim() };
    const res = await adminApi(path, "POST", body);
    setBusy(false);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't save this."));
    await onDone(
      action === "refunded"
        ? `Refund for ${ref} marked as sent.`
        : action === "payment"
          ? `Payment recorded for ${ref}.`
          : `Flag on ${ref} resolved.`,
    );
  }

  return (
    <form
      id={`flag-form-${flag.id}`}
      onSubmit={submit}
      className="mt-4 grid gap-4 rounded-2xl bg-obsidian-50/60 p-5 sm:grid-cols-2"
    >
      {action === "refunded" && (
        <>
          <div>
            <label htmlFor={`${pre}-ref`} className={labelCls}>
              Refund reference (e-transfer or Stripe refund id)
            </label>
            <input
              id={`${pre}-ref`}
              required
              minLength={2}
              maxLength={120}
              className={field}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`${pre}-note`} className={labelCls}>
              Note (optional)
            </label>
            <input
              id={`${pre}-note`}
              maxLength={500}
              className={field}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </>
      )}
      {action === "payment" && (
        <>
          <Dropdown
            id={`${pre}-method`}
            label="Method"
            value={method}
            onChange={setMethod}
            options={PAYMENT_METHODS}
          />
          <div>
            <label htmlFor={`${pre}-ref`} className={labelCls}>
              Reference (optional)
            </label>
            <input
              id={`${pre}-ref`}
              maxLength={120}
              className={field}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </>
      )}
      {action === "resolve" && (
        <div className="sm:col-span-2">
          <label htmlFor={`${pre}-res`} className={labelCls}>
            Resolution (what was done)
          </label>
          <textarea
            id={`${pre}-res`}
            required
            minLength={3}
            maxLength={500}
            rows={2}
            className={field}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" className={primaryBtn} disabled={busy}>
          {busy
            ? "Saving…"
            : action === "refunded"
              ? "Mark refunded"
              : action === "payment"
                ? "Record payment"
                : "Resolve"}
        </button>
        <button
          type="button"
          className={quietBtn}
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
