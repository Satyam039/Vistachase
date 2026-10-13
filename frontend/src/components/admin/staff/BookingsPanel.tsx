"use client";

// Bookings list: search by reference, email or name, filter by status or open flags. Opening a
// row shows its detail (BookingDetail) under the table.

import { useCallback, useEffect, useState } from "react";
import { Dropdown } from "@/components/forms/Dropdown";
import { BookingDetail } from "@/components/admin/staff/BookingDetail";
import {
  BOOKING_STATUS_STYLE,
  Chip,
  Empty,
  FLAG_LABEL,
  Grid,
  Loading,
  Panel,
  adminApi,
  errorOf,
  field,
  labelCls,
  money,
  words,
} from "@/components/admin/staff/shared";

export interface BookingRow {
  id: string;
  bookingReference: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  totalSeats: number;
  totalAmount: number;
  currency: string;
  pickupTime: string | null;
  pickupCustomText: string | null;
  specialRequests: string | null;
  adminNotes: string | null;
  isBoarded: boolean;
  createdAt: string;
  tourDepartureId: string | null;
  flags: { id: string; type: string }[];
  tourDeparture: {
    date: string;
    departureTime: string | null;
    tour: { title: string } | null;
    shuttleRoute: { name: string } | null;
  } | null;
}

const STATUSES = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PAID_UNSYNCED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "EXPIRED",
];

export const experienceOf = (b: Pick<BookingRow, "tourDeparture">) =>
  b.tourDeparture?.tour?.title ?? b.tourDeparture?.shuttleRoute?.name ?? "–";
/** "YYYY-MM-DD" from a date string or an ISO timestamp. */
export const dayOnly = (d: string) => String(d).slice(0, 10);
/** "HH:MM" from a clock string or a time-of-day stored as an ISO timestamp. */
export const clockOnly = (t: string) =>
  String(t).match(/T(\d{2}:\d{2})/)?.[1] ?? String(t).slice(0, 5);
export const dateOf = (b: Pick<BookingRow, "tourDeparture">) =>
  b.tourDeparture
    ? `${dayOnly(b.tourDeparture.date)}${b.tourDeparture.departureTime ? ` · ${clockOnly(b.tourDeparture.departureTime)}` : ""}`
    : "–";

export function BookingsPanel({
  notify,
  role,
}: {
  notify: (m: string) => void;
  role: string;
}) {
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [flagged, setFlagged] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (flagged) params.set("flagged", "true");
    const res = await adminApi<{ bookings: BookingRow[] }>(
      `/bookings?${params}`,
    );
    if (!res.ok) return setError(errorOf(res.data, "Couldn't load bookings."));
    setError("");
    setBookings(res.data.bookings);
  }, [q, status, flagged]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-6">
      <Panel
        id="staff-bookings"
        title="Bookings"
        description="The 100 most recent bookings that match. Open one to see payments, flags and its history."
      >
        <div className="grid gap-3 border-b border-obsidian-900/[0.06] px-6 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="staff-bookings-q" className={labelCls}>
              Search
            </label>
            <input
              id="staff-bookings-q"
              type="search"
              className={field}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Reference, email or name"
            />
          </div>
          <Dropdown
            id="staff-bookings-status"
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "", label: "Any status" },
              ...STATUSES.map((s) => ({ value: s, label: words(s) })),
            ]}
          />
          <div className="flex items-end">
            <label
              htmlFor="staff-bookings-flagged"
              className="inline-flex h-12 cursor-pointer items-center gap-3 text-base text-obsidian-900"
            >
              <input
                id="staff-bookings-flagged"
                type="checkbox"
                className="h-5 w-5 accent-ocean-600"
                checked={flagged}
                onChange={(e) => setFlagged(e.target.checked)}
              />
              Flagged only
            </label>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mx-6 my-4 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200"
          >
            {error}
          </p>
        )}

        {!bookings ? (
          <Loading />
        ) : bookings.length === 0 ? (
          <Empty>No bookings match.</Empty>
        ) : (
          <Grid
            label="Bookings"
            minWidth="min-w-[64rem]"
            head={[
              ["Reference"],
              ["Guest"],
              ["Experience"],
              ["Date / time"],
              ["Seats", true],
              ["Total", true],
              ["Status"],
              ["Open flags"],
            ]}
          >
            {bookings.map((b) => {
              const isOpen = openId === b.id;
              return (
                <tr
                  key={b.id}
                  className={`align-top ${isOpen ? "bg-ocean-50/60" : "hover:bg-obsidian-50/60"}`}
                >
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls="staff-booking-detail"
                      onClick={() => setOpenId(isOpen ? null : b.id)}
                      className="rounded font-mono text-base text-ocean-700 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600"
                    >
                      {b.bookingReference}
                      <span className="sr-only">
                        {isOpen ? ", close details" : ", open details"}
                      </span>
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="block text-base text-obsidian-900">
                      {b.customerName}
                    </span>
                    <span className="block break-all text-slate-600">
                      {b.customerEmail}
                    </span>
                  </td>
                  <td className="max-w-[16rem] px-6 py-4 text-sm">
                    {experienceOf(b)}
                  </td>
                  <td className="px-6 py-4 text-sm tabular-nums">
                    {dateOf(b)}
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums">
                    {b.totalSeats}
                  </td>
                  <td className="px-6 py-4 text-right text-sm tabular-nums">
                    {money(b.totalAmount, b.currency)}
                  </td>
                  <td className="px-6 py-4">
                    <Chip
                      className={
                        BOOKING_STATUS_STYLE[b.status] ??
                        "bg-obsidian-100 text-slate-700"
                      }
                    >
                      {words(b.status)}
                    </Chip>
                  </td>
                  <td className="px-6 py-4">
                    {b.flags.length === 0 ? (
                      <span className="text-sm text-slate-600">–</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {b.flags.map((f) => (
                          <Chip
                            key={f.id}
                            className="bg-summit-100 text-obsidian-900"
                          >
                            {FLAG_LABEL[f.type] ?? words(f.type)}
                          </Chip>
                        ))}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </Grid>
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
