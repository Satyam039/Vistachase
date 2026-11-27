"use client";

// Manage booking: one booking on its own page (/admin/bookings/<id>), laid out as the owner's
// "Admin Booking Management" reference: key guest and booking facts at the top, the Bókun sync
// status beside them, the staff actions (Change tour date, Cancel booking, Edit booking, View
// payments, Booking history) and tabs (Overview, Guest details, Payments, Change history, Bókun
// logs). Additive: the bookings list and its detail panel (BookingDetail) are unchanged, and the
// cancel / approve / resend / notes actions call the same /api/admin endpoints they do.

import { ChangeBookingForm } from "@/components/admin/staff/ChangeBookingForm";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  CalendarDays,
  CalendarSync,
  ChevronRight,
  Clock,
  CreditCard,
  History,
  Mail,
  MapPin,
  Mountain,
  Pencil,
  Phone,
  RefreshCw,
  Send,
  Ticket,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import {
  BOOKING_STATUS_STYLE,
  Chip,
  FLAG_LABEL,
  Loading,
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
import {
  CancelForm,
  CancelSummary,
  PROVIDER_LABEL,
  reasonOf,
  type CancelResult,
  type Detail,
  type HistoryRow,
} from "@/components/admin/staff/BookingDetail";
import { ApproveBookingForm } from "@/components/admin/staff/RequestsPanel";
import { tourDisplayName } from "@/lib/tourNames";

interface Overview {
  id: string;
  reference: string;
  createdAt: string;
  updatedAt: string;
  source: string;
  tour: { title: string; slug: string | null; image: string | null; category: string };
  departure: { id: string; date: string; time: string; returnTime: string | null };
  pickup: { name: string; town: string; address: string; instructions: string } | null;
  bokun: {
    connected: boolean;
    testAccount: boolean;
    inboundSync: boolean;
    product: boolean;
    code: string | null;
    status: "NOT_REQUIRED" | "PENDING" | "SYNCED" | "FAILED";
    lastSyncedAt: string | null;
    lastCheckedAt: string | null;
    tasks: { id: string; operation: string; status: string; attempts: number; lastError: string | null; externalRef: string | null; createdAt: string; updatedAt: string; nextAttemptAt: string }[];
    events: { id: string; action: string; details: unknown; createdAt: string }[];
  };
}

interface DateOption {
  id: string;
  date: string;
  time: string;
  price: number;
  currency: string;
  seatsLeft: number;
  fits: boolean;
  onSale: boolean;
  status: string;
}

type Tab = "overview" | "guest" | "payments" | "history" | "bokun";
type Action = null | "change-date" | "change" | "cancel" | "edit";

const TABS: [Tab, string][] = [
  ["overview", "Booking Overview"],
  ["guest", "Guest Details"],
  ["payments", "Payments"],
  ["history", "Change History"],
  ["bokun", "Bókun Logs"],
];
const MANAGERS = ["ADMIN", "OPERATOR"];
const LIVE = ["PENDING_PAYMENT", "CONFIRMED", "PAID_UNSYNCED"];
const APPROVABLE = ["PENDING_PAYMENT", "PAID_UNSYNCED"];

/** "2026-12-01" → "Tue, Dec 1, 2026" (the date itself, not shifted by the viewer's zone). */
const longDay = (d: string) =>
  new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
/** "08:30" → "8:30 AM". */
const clock12 = (t: string | null | undefined) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const party = (b: Pick<Detail, "adultsCount" | "childrenCount" | "infantsCount">) =>
  [
    `${b.adultsCount} Adult${b.adultsCount === 1 ? "" : "s"}`,
    b.childrenCount ? `${b.childrenCount} Child${b.childrenCount === 1 ? "" : "ren"}` : "",
    b.infantsCount ? `${b.infantsCount} Infant${b.infantsCount === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(", ");

const BOKUN_ACTION: Record<string, string> = {
  BOKUN_CANCELLED: "Cancelled in Bókun",
  BOKUN_DATE_CHANGED: "Date changed in Bókun",
  BOKUN_CHANGE_NOT_APPLIED: "Bókun change not applied",
  BOKUN_CHECKED: "Checked with Bókun",
  BOKUN_CHECK_FAILED: "Bókun check failed",
};
const OPERATION: Record<string, string> = {
  CREATE: "Send to Bókun",
  CANCEL: "Cancel in Bókun",
  CANCEL_OLD: "Cancel old date in Bókun",
  NOTE: "Update note in Bókun",
};
const HISTORY_ACTION: Record<string, string> = {
  CHANGE_DATE: "Tour date changed",
  EDIT_GUEST_DETAILS: "Guest details edited",
  DATE_CHANGE_EMAIL_SENT: "Date change email + updated ticket sent",
  DATE_CHANGE_EMAIL_FAILED: "Date change email failed",
  STAFF_CANCEL: "Cancelled by staff",
  CONFIRMATION_EMAIL_SENT: "Confirmation email sent",
  RESEND_VOUCHER: "Voucher resent",
  ...BOKUN_ACTION,
};

export function ManageBooking({ id, role, staffName }: { id: string; role: string; staffName: string }) {
  const [booking, setBooking] = useState<Detail | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [viaProvider, setViaProvider] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [action, setAction] = useState<Action>(null);
  const [cancelled, setCancelled] = useState<CancelResult | null>(null);
  const [busy, setBusy] = useState(false);

  const isManager = MANAGERS.includes(role);

  const load = useCallback(async () => {
    const [detail, extra] = await Promise.all([
      adminApi<{ booking: Detail; history: HistoryRow[]; refundsViaProvider: boolean }>(`/bookings/${encodeURIComponent(id)}`),
      adminApi<{ overview: Overview }>(`/bookings/${encodeURIComponent(id)}/overview`),
    ]);
    if (!detail.ok) return setError(errorOf(detail.data, "Couldn't load this booking."));
    setError("");
    setBooking(detail.data.booking);
    setHistory(detail.data.history ?? []);
    setViaProvider(Boolean(detail.data.refundsViaProvider));
    if (extra.ok) setOverview(extra.data.overview);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const notify = (m: string) => {
    setMessage(m);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function resend() {
    setBusy(true);
    const res = await adminApi(`/bookings/${encodeURIComponent(id)}/resend-voucher`, "POST", {});
    setBusy(false);
    notify(res.ok ? `Voucher sent to ${booking?.customerEmail ?? "the guest"}.` : errorOf(res.data, "Couldn't send the voucher."));
    if (res.ok) await load();
  }

  async function checkBokun() {
    setBusy(true);
    const res = await adminApi<{ inbound?: { cancelled?: number; moved?: number; flagged?: number; skipped?: string } | null }>(
      `/bookings/${encodeURIComponent(id)}/bokun-check`,
      "POST",
      {},
    );
    setBusy(false);
    if (!res.ok) return notify(errorOf(res.data, "Couldn't reach Bókun."));
    const i = res.data.inbound;
    notify(
      i?.cancelled
        ? "Bókun shows this booking as cancelled: it is now cancelled here too."
        : i?.moved
          ? "Bókun shows another date: the booking was moved and the guest emailed the updated ticket."
          : i?.flagged
            ? "Bókun shows a change the website couldn't apply. See the Bókun flag."
            : "Checked with Bókun.",
    );
    await load();
  }

  if (error) {
    return (
      <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
        {error}
      </p>
    );
  }
  if (!booking) return <Loading />;

  const live = LIVE.includes(booking.status);
  const date = booking.tourDeparture ? booking.tourDeparture.date.slice(0, 10) : "";
  const time = overview?.departure.time ?? "";
  const tourTitle = overview?.tour.title ?? (booking.tourDeparture?.tour?.title ? tourDisplayName(booking.tourDeparture.tour) : undefined) ?? booking.tourDeparture?.shuttleRoute?.name ?? "Booking";
  const statusChip = (
    <Chip className={BOOKING_STATUS_STYLE[booking.status] ?? "bg-obsidian-100 text-slate-700"}>{words(booking.status)}</Chip>
  );
  const paid = booking.payments.filter((p) => p.status === "SUCCEEDED").reduce((n, p) => n + p.amount, 0);

  const actionButton = (key: Exclude<Action, null>, label: string, Icon: typeof Pencil, cls: string, disabled = false) => (
    <button
      type="button"
      className={cls}
      aria-expanded={action === key}
      aria-controls="manage-action"
      disabled={disabled}
      onClick={() => setAction(action === key ? null : key)}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
  const goTab = (t: Tab) => {
    setTab(t);
    document.getElementById("manage-tabs")?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb and the signed-in staff member */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-base">
          <Link href="/admin/bookings" className="text-ocean-700 underline-offset-4 hover:underline">
            Bookings
          </Link>
          <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <span aria-current="page" className="font-mono text-obsidian-900">
            {booking.bookingReference}
          </span>
        </nav>
        <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-obsidian-900 ring-1 ring-obsidian-900/10">
          <UserRound className="h-4 w-4 text-ocean-700" aria-hidden="true" />
          {words(role || "STAFF")}: {staffName || "Signed in"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl text-obsidian-900">Booking Details</h2>
        {statusChip}
      </div>

      <p aria-live="polite" className={message ? "rounded-2xl bg-ocean-50 px-5 py-3 text-sm text-ocean-800" : "sr-only"}>
        {message}
      </p>

      {/* Key guest and booking details + Bókun status */}
      <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
        <section aria-label="Key booking details" className="grid gap-x-6 gap-y-5 bg-white p-5 ring-1 ring-obsidian-900/[0.07] sm:grid-cols-2 xl:grid-cols-4">
          <KeyFact icon={UserRound} label="Guest / Lead Name">
            {booking.customerName}
          </KeyFact>
          <KeyFact icon={Mail} label="Email" wide>
            <a href={`mailto:${booking.customerEmail}`} className="break-all text-ocean-700 underline-offset-4 hover:underline">
              {booking.customerEmail}
            </a>
          </KeyFact>
          <KeyFact icon={Phone} label="Contact Number">
            {booking.customerPhone ? (
              <a href={`tel:${booking.customerPhone}`} className="text-ocean-700 underline-offset-4 hover:underline">
                {booking.customerPhone}
              </a>
            ) : (
              "–"
            )}
          </KeyFact>
          <KeyFact icon={Ticket} label="Booking Reference">
            <span className="font-mono">{booking.bookingReference}</span>
          </KeyFact>
          <KeyFact icon={Mountain} label="Tour">
            {tourTitle}
          </KeyFact>
          <KeyFact icon={CalendarDays} label="Tour Date">
            {date ? longDay(date) : "–"}
            {time && <span className="block text-sm text-slate-600">{clock12(time)}</span>}
          </KeyFact>
          <KeyFact icon={Users} label="Guests">
            {party(booking)}
          </KeyFact>
        </section>

        <BokunStatus overview={overview} canCheck={isManager} busy={busy} onCheck={checkBokun} />
      </div>

      {/* Staff actions */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Booking actions">
        {isManager && live && !cancelled && actionButton("change-date", "Change Tour Date", CalendarSync, primaryBtn)}
        {isManager && live && !cancelled && actionButton("change", "Change Guests / Invoice", Users, quietBtn)}
        {isManager && live && !cancelled &&
          actionButton("cancel", "Cancel Booking", Trash2, "inline-flex h-11 items-center gap-2 rounded-full bg-red-700 px-5 text-sm text-white hover:bg-red-800 disabled:opacity-60")}
        {isManager && actionButton("edit", "Edit Booking", Pencil, quietBtn)}
        <button type="button" className={quietBtn} onClick={() => goTab("payments")}>
          <CreditCard className="h-4 w-4" aria-hidden="true" />
          View Payments
        </button>
        <button type="button" className={quietBtn} onClick={() => goTab("history")}>
          <History className="h-4 w-4" aria-hidden="true" />
          Booking History
        </button>
        <button type="button" className={quietBtn} onClick={resend} disabled={busy}>
          <Send className="h-4 w-4" aria-hidden="true" />
          Resend voucher
        </button>
      </div>

      {action && (
        <section id="manage-action" className="bg-white ring-1 ring-obsidian-900/[0.07]">
          {action === "change-date" && (
            <ChangeDateForm
              booking={booking}
              current={overview?.departure ?? null}
              bokunConnected={Boolean(overview?.bokun.connected && overview.bokun.product)}
              onClose={() => setAction(null)}
              onDone={async (m) => {
                setAction(null);
                notify(m);
                await load();
              }}
            />
          )}
          {action === "change" && (
            <div className="px-6 py-5">
              <h3 className="text-lg text-obsidian-900">Change guests, date or details</h3>
              <p className="mt-1 text-sm text-slate-600">
                For a change the guest asked for by phone or email. Seats, the invoice and any refund or amount due follow from it; a request made online is answered from Requests.
              </p>
              <ChangeBookingForm
                booking={{
                  id: booking.id,
                  bookingReference: booking.bookingReference,
                  customerName: booking.customerName,
                  customerEmail: booking.customerEmail,
                  currency: booking.currency,
                  guests: { adults: booking.adultsCount, children: booking.childrenCount, infants: booking.infantsCount },
                  date: date ?? "",
                  departureTime: time,
                  multiDayTrip: Boolean(booking.trip),
                }}
                viaProvider={viaProvider}
                onCancel={() => setAction(null)}
                onDone={async (m) => {
                  setAction(null);
                  notify(m);
                  await load();
                }}
              />
            </div>
          )}
          {action === "cancel" &&
            (cancelled ? (
              <div className="px-6 py-5">
                <CancelSummary result={cancelled} currency={booking.currency} viaProvider={viaProvider} />
              </div>
            ) : (
              <CancelForm
                id={id}
                reference={booking.bookingReference}
                viaProvider={viaProvider}
                notify={notify}
                startOpen
                onCancelled={async (r) => {
                  setCancelled(r);
                  await load();
                }}
              />
            ))}
          {action === "edit" && (
            <EditBookingForm
              booking={booking}
              onClose={() => setAction(null)}
              onDone={async (m) => {
                setAction(null);
                notify(m);
                await load();
              }}
            />
          )}
        </section>
      )}

      {/* Tabs */}
      <div id="manage-tabs" className="scroll-mt-24 bg-white ring-1 ring-obsidian-900/[0.07]">
        <div role="tablist" aria-label="Booking sections" className="vc-rail flex gap-1 overflow-x-auto border-b border-obsidian-900/[0.06] px-4">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              id={`manage-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={tab === key}
              aria-controls={`manage-panel-${key}`}
              onClick={() => setTab(key)}
              className={`inline-flex h-12 shrink-0 items-center border-b-2 px-4 text-sm ${
                tab === key ? "border-ocean-600 text-ocean-700" : "border-transparent text-slate-600 hover:text-obsidian-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div id={`manage-panel-${tab}`} role="tabpanel" aria-labelledby={`manage-tab-${tab}`} className="p-5">
          {tab === "overview" && (
            <OverviewTab booking={booking} overview={overview} isManager={isManager} onChanged={load} notify={notify} />
          )}
          {tab === "guest" && <GuestTab booking={booking} />}
          {tab === "payments" && <PaymentsTab booking={booking} paid={paid} />}
          {tab === "history" && <HistoryTab history={history} />}
          {tab === "bokun" && <BokunTab overview={overview} />}
        </div>
      </div>
    </div>
  );
}

function KeyFact({ icon: Icon, label, wide, children }: { icon: typeof Mail; label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`flex gap-3 ${wide ? "xl:col-span-2" : ""}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-ocean-700" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm text-slate-600">{label}</p>
        <div className="mt-0.5 text-base text-obsidian-900">{children}</div>
      </div>
    </div>
  );
}

function BokunStatus({ overview, canCheck, busy, onCheck }: { overview: Overview | null; canCheck: boolean; busy: boolean; onCheck: () => void }) {
  const b = overview?.bokun;
  const state = !b
    ? { label: "Loading…", cls: "bg-obsidian-100 text-slate-700" }
    : !b.product
      ? { label: "Not a Bókun product", cls: "bg-obsidian-100 text-slate-700" }
      : !b.connected
        ? { label: "Bókun not connected", cls: "bg-summit-100 text-obsidian-900" }
        : b.code && b.status === "SYNCED"
          ? { label: "Synced", cls: "bg-ocean-50 text-ocean-800" }
          : b.status === "FAILED"
            ? { label: "Not in Bókun", cls: "bg-red-50 text-red-800" }
            : b.status === "PENDING"
              ? { label: "Sending to Bókun", cls: "bg-summit-100 text-obsidian-900" }
              : { label: b.code ? "Synced" : "Not sent", cls: "bg-obsidian-100 text-slate-700" };
  return (
    <section aria-labelledby="manage-bokun-heading" className="bg-white p-5 ring-1 ring-obsidian-900/[0.07]">
      <h3 id="manage-bokun-heading" className="text-sm text-slate-600">
        Bókun Status
      </h3>
      <p className="mt-2 text-xl text-obsidian-900">Bókun</p>
      <p className="mt-2">
        <Chip className={state.cls}>{state.label}</Chip>
      </p>
      {b?.code && <p className="mt-2 text-sm text-slate-700">Bókun ID: <span className="font-mono">{b.code}</span></p>}
      <p className="mt-1 text-sm text-slate-600">Last synced: {b?.lastSyncedAt ? when(b.lastSyncedAt) : "–"}</p>
      {b?.testAccount && <p className="mt-1 text-sm text-slate-600">Bókun test account</p>}
      {canCheck && b?.connected && b.product && (
        <button type="button" className={`${quietBtn} mt-3`} onClick={onCheck} disabled={busy}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Check Bókun now
        </button>
      )}
    </section>
  );
}

function OverviewTab({
  booking,
  overview,
  isManager,
  onChanged,
  notify,
}: {
  booking: Detail;
  overview: Overview | null;
  isManager: boolean;
  onChanged: () => Promise<void>;
  notify: (m: string) => void;
}) {
  const [notes, setNotes] = useState(booking.adminNotes ?? "");
  const [approving, setApproving] = useState(false);
  const [busy, setBusy] = useState(false);
  const title = overview?.tour.title ?? "Booking";

  async function saveNotes(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await adminApi(`/bookings/${encodeURIComponent(booking.id)}`, "PATCH", { adminNotes: notes.trim() ? notes.trim() : null });
    setBusy(false);
    notify(res.ok ? "Admin notes saved." : errorOf(res.data, "Couldn't save the notes."));
    if (res.ok) await onChanged();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="relative min-h-48 overflow-hidden bg-obsidian-950">
          {overview?.tour.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={overview.tour.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="vc-scrim" aria-hidden="true" />
          <p className="absolute inset-x-0 bottom-0 p-4 text-lg text-white">{title}</p>
        </div>
        <section aria-labelledby="manage-pickup" className="space-y-4 p-4 ring-1 ring-obsidian-900/[0.07]">
          <div className="flex gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-ocean-700" aria-hidden="true" />
            <div>
              <h3 id="manage-pickup" className="text-base text-obsidian-900">
                Pickup Details
              </h3>
              <p className="mt-1 text-sm text-slate-700">
                {overview?.pickup ? overview.pickup.name : booking.pickupCustomText || "Not set"}
              </p>
              {overview?.pickup?.address && <p className="text-sm text-slate-600">{overview.pickup.address}</p>}
              {overview?.pickup && booking.pickupCustomText && <p className="text-sm text-slate-600">{booking.pickupCustomText}</p>}
              {booking.pickupTime && <p className="text-sm text-slate-600">Pickup at {clock12(booking.pickupTime)}</p>}
            </div>
          </div>
          <div className="flex gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-ocean-700" aria-hidden="true" />
            <div>
              <p className="text-base text-obsidian-900">Departs</p>
              <p className="text-lg text-obsidian-900">{overview ? clock12(overview.departure.time) : "–"}</p>
              {overview?.departure.returnTime && <p className="text-sm text-slate-600">Returns about {clock12(overview.departure.returnTime)}</p>}
            </div>
          </div>
        </section>
        <section aria-labelledby="manage-status" className="space-y-2 p-4 ring-1 ring-obsidian-900/[0.07]">
          <h3 id="manage-status" className="text-base text-obsidian-900">
            Booking Status
          </h3>
          <Chip className={BOOKING_STATUS_STYLE[booking.status] ?? "bg-obsidian-100 text-slate-700"}>{words(booking.status)}</Chip>
          <dl className="space-y-1 pt-2 text-sm">
            <Row term="Created">{when(booking.createdAt)}</Row>
            <Row term="Last updated">{overview ? when(overview.updatedAt) : "–"}</Row>
            <Row term="Source">{overview?.source ?? "–"}</Row>
            <Row term="Bókun booking ID">{overview?.bokun.code ? <span className="font-mono">{overview.bokun.code}</span> : "–"}</Row>
            <Row term="Total">{money(booking.totalAmount, booking.currency)}</Row>
          </dl>
        </section>
      </div>

      {booking.specialRequests && (
        <div>
          <h3 className="text-base text-obsidian-900">Special requests</h3>
          <p className="mt-1 whitespace-pre-line text-base text-slate-700">{booking.specialRequests}</p>
        </div>
      )}

      {booking.flags.some((f) => f.status === "OPEN") && (
        <div>
          <h3 className="text-base text-obsidian-900">Open flags</h3>
          <ul className="mt-2 space-y-2">
            {booking.flags
              .filter((f) => f.status === "OPEN")
              .map((f) => (
                <li key={f.id} className="text-sm text-slate-700">
                  <Chip className="bg-summit-100 text-obsidian-900">{FLAG_LABEL[f.type] ?? words(f.type)}</Chip> {f.note}
                </li>
              ))}
          </ul>
          <p className="mt-2 text-sm text-slate-600">
            Work open flags on the <Link href="/admin/bookings#flags" className="text-ocean-700 underline-offset-4 hover:underline">Flags tab</Link>.
          </p>
        </div>
      )}

      {isManager && APPROVABLE.includes(booking.status) && (
        <div>
          <h3 className="mb-2 text-base text-obsidian-900">Approve booking</h3>
          {!approving ? (
            <button type="button" className={quietBtn} onClick={() => setApproving(true)}>
              Approve booking
            </button>
          ) : (
            <ApproveBookingForm
              booking={{ ...booking, paid: booking.payments.filter((p) => p.status === "SUCCEEDED").reduce((n, p) => n + p.amount, 0) }}
              onCancel={() => setApproving(false)}
              onDone={async (m) => {
                notify(m);
                setApproving(false);
                await onChanged();
              }}
            />
          )}
        </div>
      )}

      <form onSubmit={saveNotes} className="max-w-3xl space-y-3">
        <label htmlFor="manage-notes" className={labelCls}>
          Admin notes (the guest never sees these)
        </label>
        <textarea id="manage-notes" rows={3} maxLength={2000} className={field} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button type="submit" className={quietBtn} disabled={busy || notes === (booking.adminNotes ?? "")}>
          Save notes
        </button>
      </form>
    </div>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-slate-600">{term}:</dt>
      <dd className="text-obsidian-900">{children}</dd>
    </div>
  );
}

function GuestTab({ booking }: { booking: Detail }) {
  return (
    <dl className="grid max-w-3xl gap-x-8 gap-y-4 text-base sm:grid-cols-2">
      <Field term="Lead guest">{booking.customerName}</Field>
      <Field term="Email">{booking.customerEmail}</Field>
      <Field term="Phone">{booking.customerPhone || "–"}</Field>
      <Field term="Party">{party(booking)}</Field>
      <Field term="Seats">{booking.totalSeats}</Field>
      <Field term="Boarded">{booking.isBoarded ? "Yes" : "No"}</Field>
      <Field term="Pickup">
        {booking.pickupStop ? `${booking.pickupStop.name}, ${booking.pickupStop.town}` : booking.pickupCustomText || "Not set"}
        {booking.pickupTime ? ` · ${clock12(booking.pickupTime)}` : ""}
      </Field>
      <Field term="Special requests">{booking.specialRequests || "None"}</Field>
    </dl>
  );
}

function Field({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-slate-600">{term}</dt>
      <dd className="mt-0.5 break-words text-obsidian-900">{children}</dd>
    </div>
  );
}

function PaymentsTab({ booking, paid }: { booking: Detail; paid: number }) {
  const due = Math.max(0, booking.totalAmount - paid);
  return (
    <div className="space-y-5">
      <dl className="grid max-w-2xl grid-cols-3 gap-4">
        <Field term="Total">{money(booking.totalAmount, booking.currency)}</Field>
        <Field term="Paid">{money(paid, booking.currency)}</Field>
        <Field term="Balance">{money(due, booking.currency)}</Field>
      </dl>
      {booking.payments.length === 0 ? (
        <p className="text-sm text-slate-600">No payments recorded.</p>
      ) : (
        <ul className="divide-y divide-obsidian-900/[0.06]">
          {booking.payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span>
                {money(p.amount, p.currency)} <span className="text-sm text-slate-600">· {PROVIDER_LABEL(p.provider)}</span>
              </span>
              <span className="flex items-center gap-2 text-sm text-slate-600">
                <Chip className="bg-obsidian-100 text-slate-700">{words(p.status)}</Chip>
                {when(p.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {booking.flags.some((f) => f.type === "REFUND_DUE" || f.type === "PAYMENT_DUE") && (
        <ul className="space-y-2 text-sm text-slate-700">
          {booking.flags
            .filter((f) => f.type === "REFUND_DUE" || f.type === "PAYMENT_DUE")
            .map((f) => (
              <li key={f.id}>
                <Chip className={f.status === "OPEN" ? "bg-summit-100 text-obsidian-900" : "bg-obsidian-100 text-slate-700"}>{FLAG_LABEL[f.type]}</Chip>{" "}
                {f.amount != null && money(f.amount, booking.currency)} · {f.status === "OPEN" ? "Open" : `Resolved ${when(f.resolvedAt)}`}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function HistoryTab({ history }: { history: HistoryRow[] }) {
  if (history.length === 0) return <p className="text-sm text-slate-600">Nothing recorded yet.</p>;
  return (
    <ol className="divide-y divide-obsidian-900/[0.06]">
      {[...history].reverse().map((h) => {
        const d = (h.details ?? {}) as Record<string, unknown>;
        const change = typeof d.from === "string" && typeof d.to === "string" ? `${d.from} → ${d.to}` : "";
        return (
          <li key={h.id} className="flex flex-wrap gap-x-3 py-3">
            <span className="text-sm tabular-nums text-slate-600">{when(h.createdAt)}</span>
            <span className="text-obsidian-900">{HISTORY_ACTION[h.action] ?? words(h.action)}</span>
            <span className="text-sm text-slate-600">{h.user ? h.user.name || h.user.email : h.action.startsWith("BOKUN_") ? "Bókun" : "System"}</span>
            {change && <span className="basis-full text-sm text-slate-700">{change}</span>}
            {reasonOf(h.details) && <span className="basis-full text-sm text-slate-700">{reasonOf(h.details)}</span>}
          </li>
        );
      })}
    </ol>
  );
}

function BokunTab({ overview }: { overview: Overview | null }) {
  if (!overview) return <Loading />;
  const b = overview.bokun;
  return (
    <div className="space-y-6">
      <dl className="grid gap-4 text-base sm:grid-cols-2 lg:grid-cols-4">
        <Field term="Connection">{b.connected ? (b.testAccount ? "Connected (test account)" : "Connected") : "Not connected"}</Field>
        <Field term="Bókun ID">{b.code ?? "–"}</Field>
        <Field term="Changes from Bókun">{b.inboundSync ? "Read every 15 minutes" : "Off (Check Bókun now still works)"}</Field>
        <Field term="Last checked with Bókun">{b.lastCheckedAt ? when(b.lastCheckedAt) : "–"}</Field>
      </dl>
      <div>
        <h3 className="mb-2 text-base text-obsidian-900">Website → Bókun</h3>
        {b.tasks.length === 0 ? (
          <p className="text-sm text-slate-600">{b.product ? "Nothing sent to Bókun yet." : "This product isn't booked in Bókun."}</p>
        ) : (
          <ul className="divide-y divide-obsidian-900/[0.06]">
            {b.tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap gap-x-3 py-3 text-sm">
                <span className="tabular-nums text-slate-600">{when(t.updatedAt)}</span>
                <span className="text-obsidian-900">{OPERATION[t.operation] ?? words(t.operation)}</span>
                <Chip className={t.status === "SUCCEEDED" ? "bg-ocean-50 text-ocean-800" : t.status === "FAILED" ? "bg-red-50 text-red-800" : "bg-obsidian-100 text-slate-700"}>
                  {words(t.status)}
                </Chip>
                {t.externalRef && <span className="font-mono text-slate-700">{t.externalRef}</span>}
                <span className="text-slate-600">
                  {t.attempts} attempt{t.attempts === 1 ? "" : "s"}
                </span>
                {t.lastError && <span className="basis-full text-slate-700">{t.lastError}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-base text-obsidian-900">Bókun → website</h3>
        {b.events.length === 0 ? (
          <p className="text-sm text-slate-600">No changes from Bókun.</p>
        ) : (
          <ul className="divide-y divide-obsidian-900/[0.06]">
            {b.events.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-3 py-3 text-sm">
                <span className="tabular-nums text-slate-600">{when(e.createdAt)}</span>
                <span className="text-obsidian-900">{BOKUN_ACTION[e.action] ?? words(e.action)}</span>
                {reasonOf(e.details) && <span className="basis-full text-slate-700">{reasonOf(e.details)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ChangeDateForm({
  booking,
  current,
  bokunConnected,
  onClose,
  onDone,
}: {
  booking: Detail;
  current: Overview["departure"] | null;
  bokunConnected: boolean;
  onClose: () => void;
  onDone: (m: string) => Promise<void>;
}) {
  const [from, setFrom] = useState("");
  const [options, setOptions] = useState<DateOption[] | null>(null);
  const [choice, setChoice] = useState("");
  const [reason, setReason] = useState("");
  const [notifyGuest, setNotifyGuest] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    let alive = true;
    adminApi<{ departures: DateOption[] }>(`/bookings/${encodeURIComponent(booking.id)}/date-options?${params}`).then((res) => {
      if (!alive) return;
      if (!res.ok) return setError(errorOf(res.data, "Couldn't load departures."));
      setOptions(res.data.departures ?? []);
    });
    return () => {
      alive = false;
    };
  }, [booking.id, from]);

  const picked = options?.find((o) => o.id === choice);

  function review(e: FormEvent) {
    e.preventDefault();
    if (!picked) return setError("Choose the new departure.");
    if (reason.trim().length < 3) return setError("Give a reason of at least 3 characters.");
    setError("");
    setConfirming(true);
  }

  async function submit() {
    setBusy(true);
    const res = await adminApi<{ to: string; email: string; bokun: string; priceDifference: number }>(
      `/bookings/${encodeURIComponent(booking.id)}/change-date`,
      "POST",
      { departureId: choice, reason: reason.trim(), notifyGuest },
    );
    setBusy(false);
    if (!res.ok) {
      setConfirming(false);
      return setError(errorOf(res.data, "Couldn't change the date."));
    }
    const d = res.data;
    await onDone(
      [
        `Moved to ${d.to}.`,
        d.email === "sent" ? "The guest was emailed the date change and the updated ticket." : d.email === "failed" ? "The email couldn't be sent: use Resend voucher." : "",
        d.bokun === "queued" ? "Bókun is being updated." : "",
        d.priceDifference ? `The new departure's price differs by ${money(d.priceDifference, booking.currency)}; the booking keeps its price.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  const byDay = (options ?? []).reduce<Record<string, DateOption[]>>((acc, o) => {
    (acc[o.date] ??= []).push(o);
    return acc;
  }, {});

  return (
    <form onSubmit={review} className="space-y-5 px-6 py-5">
      <div>
        <h3 className="text-lg text-obsidian-900">Change tour date</h3>
        <p className="mt-1 text-sm text-slate-600">
          Now: {current ? `${longDay(current.date)} at ${clock12(current.time)}` : "–"} · {booking.totalSeats} seat{booking.totalSeats === 1 ? "" : "s"}. Pick another departure of the same tour. Seats move at once; the price stays as booked.
          {bokunConnected && " Bókun gets the booking on the new date first, then the old one is cancelled there."}
        </p>
      </div>
      <div className="max-w-xs">
        <label htmlFor="manage-date-from" className={labelCls}>
          Show departures from
        </label>
        <input id="manage-date-from" type="date" className={field} value={from} onChange={(e) => setFrom(e.target.value)} disabled={confirming} />
      </div>
      {!options ? (
        <Loading />
      ) : options.length === 0 ? (
        <p className="text-sm text-slate-600">No other departures of this tour from that date. Add one under Departures first.</p>
      ) : (
        <fieldset disabled={confirming} className="max-h-80 space-y-3 overflow-y-auto pr-1">
          <legend className={labelCls}>New departure</legend>
          {Object.entries(byDay).map(([day, list]) => (
            <div key={day}>
              <p className="text-sm text-slate-600">{longDay(day)}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {list.map((o) => (
                  <label
                    key={o.id}
                    htmlFor={`manage-dep-${o.id}`}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm ${
                      choice === o.id ? "border-ocean-600 bg-ocean-50" : "border-obsidian-900/10"
                    } ${o.fits ? "" : "cursor-not-allowed opacity-50"}`}
                  >
                    <input
                      id={`manage-dep-${o.id}`}
                      type="radio"
                      name="manage-departure"
                      value={o.id}
                      disabled={!o.fits}
                      checked={choice === o.id}
                      onChange={() => setChoice(o.id)}
                      className="h-4 w-4 accent-ocean-600"
                    />
                    {clock12(o.time)} · {o.fits ? `${o.seatsLeft} left` : o.status === "ACTIVE" ? "not enough seats" : words(o.status)}
                    {!o.onSale && o.fits ? " · off sale" : ""}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      )}
      <div className="max-w-2xl">
        <label htmlFor="manage-date-reason" className={labelCls}>
          Reason (kept in the history)
        </label>
        <textarea id="manage-date-reason" rows={2} maxLength={500} className={field} value={reason} disabled={confirming} onChange={(e) => setReason(e.target.value)} />
      </div>
      <label htmlFor="manage-date-notify" className="inline-flex cursor-pointer items-center gap-3 text-base text-obsidian-900">
        <input id="manage-date-notify" type="checkbox" className="h-5 w-5 accent-ocean-600" checked={notifyGuest} disabled={confirming} onChange={(e) => setNotifyGuest(e.target.checked)} />
        Email the guest the date change and the updated ticket (PDF)
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {!confirming ? (
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={primaryBtn}>
            Review change
          </button>
          <button type="button" className={quietBtn} onClick={onClose}>
            Close
          </button>
        </div>
      ) : (
        <div role="group" aria-labelledby="manage-date-confirm" className="space-y-3 rounded-2xl bg-ocean-50 px-5 py-4 ring-1 ring-ocean-200">
          <p id="manage-date-confirm" className="text-base text-obsidian-900">
            Move {booking.bookingReference} to {picked ? `${longDay(picked.date)} at ${clock12(picked.time)}` : "the new departure"}?
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryBtn} onClick={submit} disabled={busy}>
              {busy ? "Moving…" : "Yes, change the date"}
            </button>
            <button type="button" className={quietBtn} onClick={() => setConfirming(false)} disabled={busy}>
              Go back
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function EditBookingForm({ booking, onClose, onDone }: { booking: Detail; onClose: () => void; onDone: (m: string) => Promise<void> }) {
  const [name, setName] = useState(booking.customerName);
  const [email, setEmail] = useState(booking.customerEmail);
  const [phone, setPhone] = useState(booking.customerPhone ?? "");
  const [pickupTime, setPickupTime] = useState(booking.pickupTime ?? "");
  const [pickupText, setPickupText] = useState(booking.pickupCustomText ?? "");
  const [requests, setRequests] = useState(booking.specialRequests ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const guest = await adminApi<{ changed: string[] }>(`/bookings/${encodeURIComponent(booking.id)}/guest`, "POST", {
      customerName: name.trim(),
      customerEmail: email.trim(),
      ...(phone.trim() ? { customerPhone: phone.trim() } : {}),
    });
    if (!guest.ok) {
      setBusy(false);
      return setError(errorOf(guest.data, "Couldn't save the guest details."));
    }
    // Pickup and requests use the existing booking edit (PATCH /bookings/:id).
    const rest = await adminApi(`/bookings/${encodeURIComponent(booking.id)}`, "PATCH", {
      pickupTime: pickupTime || null,
      pickupCustomText: pickupText.trim() || null,
      specialRequests: requests.trim() || null,
    });
    setBusy(false);
    if (!rest.ok) return setError(errorOf(rest.data, "Couldn't save the pickup details."));
    await onDone("Booking updated.");
  }

  const pre = "manage-edit";
  return (
    <form onSubmit={submit} className="space-y-5 px-6 py-5">
      <div>
        <h3 className="text-lg text-obsidian-900">Edit booking</h3>
        <p className="mt-1 text-sm text-slate-600">
          Guest contact and pickup. Every change is kept in the booking history. To change the date use Change Tour Date; party size and price stay as booked.
        </p>
      </div>
      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${pre}-name`} className={labelCls}>
            Lead guest name
          </label>
          <input id={`${pre}-name`} className={field} required minLength={2} maxLength={120} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${pre}-email`} className={labelCls}>
            Email
          </label>
          <input id={`${pre}-email`} type="email" className={field} required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${pre}-phone`} className={labelCls}>
            Contact number
          </label>
          <input id={`${pre}-phone`} type="tel" className={field} autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${pre}-pickup-time`} className={labelCls}>
            Pickup time
          </label>
          <input id={`${pre}-pickup-time`} type="time" className={field} value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${pre}-pickup`} className={labelCls}>
            Pickup note (hotel or address)
          </label>
          <input id={`${pre}-pickup`} className={field} maxLength={200} value={pickupText} onChange={(e) => setPickupText(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${pre}-requests`} className={labelCls}>
            Special requests
          </label>
          <textarea id={`${pre}-requests`} rows={2} maxLength={1000} className={field} value={requests} onChange={(e) => setRequests(e.target.value)} />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={primaryBtn} disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button type="button" className={quietBtn} onClick={onClose} disabled={busy}>
          Close
        </button>
      </div>
    </form>
  );
}
