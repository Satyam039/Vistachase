"use client";

// Staff departures (/admin/departures): departures grouped by date with seats, price, status and
// sale source; manifest link for everyone; edit, take off sale / put back on sale and "Add
// departures" for ADMIN and OPERATOR (the server checks the role again).

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Dropdown, type DropdownOption } from "@/components/forms/Dropdown";
import { Chip, Empty, Grid, Loading, Panel, adminApi, errorOf, field, labelCls, money, primaryBtn, quietBtn, dangerBtn, todayMT } from "@/components/admin/staff/shared";

type DepartureStatus = "ACTIVE" | "FULL" | "CANCELLED";

interface Departure {
  id: string;
  date: string;
  departureTime: string | null;
  returnTime: string | null;
  experience: string;
  tourSlug: string | null;
  routeSlug: string | null;
  category: string;
  capacityTotal: number;
  capacityBooked: number;
  capacityHeld: number;
  activeBookings: number;
  price: number;
  childPrice: number | null;
  currency: string;
  status: DepartureStatus;
  inventorySource: "LOCAL" | "UNVERIFIED" | "EXTERNAL";
}

interface Products {
  tours: { slug: string; title: string; category: string; bookingMode: string; currency: string }[];
  routes: { slug: string; name: string }[];
}

const MANAGERS = ["ADMIN", "OPERATOR"];
const STATUS_LABEL: Record<DepartureStatus, string> = { ACTIVE: "On sale", FULL: "Full", CANCELLED: "Off sale" };
const STATUS_STYLE: Record<DepartureStatus, string> = {
  ACTIVE: "bg-ocean-50 text-ocean-800",
  FULL: "bg-summit-100 text-obsidian-900",
  CANCELLED: "bg-red-50 text-red-800",
};
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** YYYY-MM-DD plus n days (calendar arithmetic in UTC, so the device's zone doesn't matter). */
function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** "Tue, Oct 13, 2026" for a YYYY-MM-DD departure date. */
function dayLabel(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Every date from..to (inclusive) whose weekday is ticked; Monday = 0. Stops after `limit` + 1. */
function expandDates(from: string, to: string, days: boolean[], limit: number) {
  const out: string[] = [];
  if (!from || !to || from > to) return out;
  for (let day = from; day <= to && out.length <= limit; day = addDays(day, 1)) {
    const [y, m, d] = day.split("-").map(Number);
    const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
    if (days[weekday]) out.push(day);
  }
  return out;
}

/** "8:30, 13:00" → ["08:30", "13:00"], or an error message. */
function parseTimes(text: string): { times: string[]; error?: string } {
  const parts = text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (/^\d:\d\d$/.test(t) ? `0${t}` : t));
  if (parts.length === 0) return { times: [], error: "Enter at least one time, like 08:30." };
  const bad = parts.find((t) => !CLOCK.test(t));
  if (bad) return { times: [], error: `"${bad}" isn't a time. Use 24-hour HH:MM, like 13:00.` };
  const times = Array.from(new Set(parts));
  if (times.length > 8) return { times: [], error: "Up to 8 times at once." };
  return { times };
}

const productKey = (d: { tourSlug: string | null; routeSlug: string | null }) => (d.tourSlug ? `tour:${d.tourSlug}` : d.routeSlug ? `route:${d.routeSlug}` : "");

export function DeparturesPanel({ notify, role }: { notify: (m: string) => void; role: string }) {
  const canManage = MANAGERS.includes(role);
  const today = todayMT();
  const [products, setProducts] = useState<Products | null>(null);
  const [departures, setDepartures] = useState<Departure[] | null>(null);
  const [error, setError] = useState("");
  const [product, setProduct] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 13));
  const [status, setStatus] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string; bookings: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void adminApi<Products>("/departures/products").then((res) => {
      if (res.ok) setProducts({ tours: res.data.tours ?? [], routes: res.data.routes ?? [] });
    });
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (product.startsWith("tour:")) params.set("tourSlug", product.slice(5));
    if (product.startsWith("route:")) params.set("routeSlug", product.slice(6));
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status) params.set("status", status);
    const res = await adminApi<{ departures: Departure[] }>(`/departures?${params}`);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't load departures."));
    setError("");
    setDepartures(res.data.departures ?? []);
  }, [product, from, to, status]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const productOptions = useMemo<DropdownOption[]>(
    () => [
      { value: "", label: "All tours and routes" },
      ...(products?.tours ?? []).map((t) => ({ value: `tour:${t.slug}`, label: t.title, description: t.bookingMode === "ENQUIRY" ? "Booked on request" : undefined })),
      ...(products?.routes ?? []).map((r) => ({ value: `route:${r.slug}`, label: r.name, description: "Shuttle route" })),
    ],
    [products],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Departure[]>();
    for (const d of departures ?? []) map.set(d.date, [...(map.get(d.date) ?? []), d]);
    return Array.from(map.entries());
  }, [departures]);

  async function setSale(d: Departure, next: "ACTIVE" | "CANCELLED") {
    setBusyId(d.id);
    setRowError(null);
    const res = await adminApi(`/departures/${d.id}/status`, "POST", { status: next });
    setBusyId(null);
    if (!res.ok) {
      return setRowError({ id: d.id, message: errorOf(res.data, "Couldn't change this departure."), bookings: res.status === 409 && d.activeBookings > 0 });
    }
    notify(`${d.experience}, ${dayLabel(d.date)} ${d.departureTime ?? ""}: ${next === "CANCELLED" ? "taken off sale" : "back on sale"}.`);
    await load();
  }

  const columns: [string, boolean?][] = [["Time"], ["Experience"], ["Seats (booked / held / total)", true], ["Bookings", true], ["Price", true], ["Status"], [""]];

  return (
    <div className="space-y-6">
      {canManage && (
        <Panel
          id="departures-add"
          title="Add departures"
          description="Pick a tour or shuttle route, a date range and the weekdays it runs. Departures that already exist are skipped."
          actions={
            <button type="button" className={adding ? quietBtn : primaryBtn} aria-expanded={adding} onClick={() => setAdding((a) => !a)}>
              {adding ? "Close" : "Add departures"}
            </button>
          }
        >
          {adding && !products && <Loading />}
          {adding && products && (
            <AddDeparturesForm
              products={products}
              today={today}
              onAdded={(created, skipped) => {
                notify(`Added ${created}, skipped ${skipped} that already existed.`);
                void load();
              }}
            />
          )}
        </Panel>
      )}

      <Panel id="departures-list" title="Departures" description="Times are Mountain Time. Seats held are guests checking out right now.">
        <div className="grid gap-3 border-b border-obsidian-900/[0.06] px-6 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dropdown id="dep-product" label="Tour or route" value={product} onChange={setProduct} options={productOptions} searchable searchPlaceholder="Search tours and routes" />
          <div>
            <label htmlFor="dep-from" className={labelCls}>
              From
            </label>
            <input id="dep-from" type="date" className={field} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label htmlFor="dep-to" className={labelCls}>
              To
            </label>
            <input id="dep-to" type="date" className={field} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Dropdown
            id="dep-status"
            label="Status"
            value={status}
            onChange={setStatus}
            options={[{ value: "", label: "Any status" }, ...(Object.keys(STATUS_LABEL) as DepartureStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))]}
          />
        </div>

        {error && (
          <p role="alert" className="mx-6 my-4 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
            {error}
          </p>
        )}

        {!departures ? (
          <Loading />
        ) : departures.length === 0 ? (
          <Empty>No departures match these filters.</Empty>
        ) : (
          <Grid label="Departures" minWidth="min-w-[64rem]" head={columns}>
            {groups.map(([date, rows]) => (
              <Fragment key={date}>
                <tr className="bg-obsidian-50/70">
                  <th scope="colgroup" colSpan={columns.length} className="px-6 py-2 text-left text-sm font-normal text-slate-700">
                    {dayLabel(date)}
                    {date === today && <span className="ml-2 text-ocean-700">Today</span>}
                  </th>
                </tr>
                {rows.map((d) => (
                  <Fragment key={d.id}>
                    <tr className={`align-top ${editing === d.id ? "bg-ocean-50/60" : "hover:bg-obsidian-50/60"}`}>
                      <td className="px-6 py-4 tabular-nums">
                        <span className="block">{d.departureTime ?? "–"}</span>
                        {d.returnTime && <span className="block text-sm text-slate-600">Back {d.returnTime}</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="block text-obsidian-900">{d.experience}</span>
                        <span className="block text-sm text-slate-600">{d.category === "PRIVATE" ? "Private · priced per vehicle" : d.routeSlug ? "Shuttle" : d.category.charAt(0) + d.category.slice(1).toLowerCase()}</span>
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums">
                        {d.capacityBooked} / {d.capacityHeld} / {d.capacityTotal}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums">{d.activeBookings}</td>
                      <td className="px-6 py-4 text-right tabular-nums">
                        <span className="block">{money(d.price, d.currency)}</span>
                        {d.childPrice != null && <span className="block text-sm text-slate-600">Child {money(d.childPrice, d.currency)}</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex flex-wrap gap-1">
                          <Chip className={STATUS_STYLE[d.status]}>{STATUS_LABEL[d.status]}</Chip>
                          {d.inventorySource !== "LOCAL" && <Chip className="bg-obsidian-100 text-slate-700">Off sale online</Chip>}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="flex flex-wrap justify-end gap-2">
                          <Link href={`/admin/departures/${d.id}/manifest`} className={quietBtn}>
                            Manifest <span className="sr-only">for {d.experience}, {dayLabel(d.date)} {d.departureTime}</span>
                          </Link>
                          {canManage && (
                            <>
                              <button type="button" className={quietBtn} aria-expanded={editing === d.id} onClick={() => setEditing((e) => (e === d.id ? null : d.id))}>
                                {editing === d.id ? "Close" : "Edit"} <span className="sr-only">{d.experience}, {dayLabel(d.date)} {d.departureTime}</span>
                              </button>
                              {d.status === "CANCELLED" ? (
                                <button type="button" className={quietBtn} disabled={busyId === d.id} onClick={() => void setSale(d, "ACTIVE")}>
                                  Put back on sale
                                </button>
                              ) : (
                                <button type="button" className={dangerBtn} disabled={busyId === d.id} onClick={() => void setSale(d, "CANCELLED")}>
                                  Take off sale
                                </button>
                              )}
                            </>
                          )}
                        </span>
                        {rowError?.id === d.id && (
                          <p role="alert" className="mt-2 text-left text-sm text-red-700">
                            {rowError.message}
                            {rowError.bookings && (
                              <>
                                {" "}
                                <Link href="/admin/bookings#bookings" className="underline underline-offset-2">
                                  Open bookings
                                </Link>
                              </>
                            )}
                          </p>
                        )}
                      </td>
                    </tr>
                    {canManage && editing === d.id && (
                      <tr className="bg-ocean-50/60">
                        <td colSpan={columns.length} className="px-6 pb-5">
                          <EditDepartureForm
                            departure={d}
                            onSaved={() => {
                              setEditing(null);
                              notify(`${d.experience}, ${dayLabel(d.date)} ${d.departureTime ?? ""} saved.`);
                              void load();
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </Grid>
        )}
      </Panel>
    </div>
  );
}

function EditDepartureForm({ departure: d, onSaved }: { departure: Departure; onSaved: () => void }) {
  const [seats, setSeats] = useState(String(d.capacityTotal));
  const [price, setPrice] = useState(String(d.price));
  const [childPrice, setChildPrice] = useState(d.childPrice != null ? String(d.childPrice) : "");
  const [returnTime, setReturnTime] = useState(d.returnTime ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const p = `edit-${d.id}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    if (Number(seats) !== d.capacityTotal) body.capacityTotal = Number(seats);
    if (Number(price) !== d.price) body.price = Number(price);
    const child = childPrice.trim() === "" ? null : Number(childPrice);
    if (child !== d.childPrice) body.childPrice = child;
    const ret = returnTime || null;
    if (ret !== d.returnTime) body.returnTime = ret;
    if (Object.keys(body).length === 0) return setError("Nothing changed.");
    setBusy(true);
    const res = await adminApi(`/departures/${d.id}`, "PATCH", body);
    setBusy(false);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't save this departure."));
    setError("");
    onSaved();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-none bg-white p-5 ring-1 ring-obsidian-900/[0.07] sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label htmlFor={`${p}-seats`} className={labelCls}>
          Seats
        </label>
        <input id={`${p}-seats`} type="number" required min={0} max={100} step={1} inputMode="numeric" className={field} value={seats} onChange={(e) => setSeats(e.target.value)} />
      </div>
      <div>
        <label htmlFor={`${p}-price`} className={labelCls}>
          Price ({d.currency}){d.category === "PRIVATE" ? ", per vehicle" : ""}
        </label>
        <input id={`${p}-price`} type="number" required min={0} max={100000} step="0.01" inputMode="decimal" className={field} value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div>
        <label htmlFor={`${p}-child`} className={labelCls}>
          Child price (optional)
        </label>
        <input id={`${p}-child`} type="number" min={0} max={100000} step="0.01" inputMode="decimal" className={field} value={childPrice} onChange={(e) => setChildPrice(e.target.value)} />
      </div>
      <div>
        <label htmlFor={`${p}-return`} className={labelCls}>
          Return time (optional)
        </label>
        <input id={`${p}-return`} type="time" className={field} value={returnTime} onChange={(e) => setReturnTime(e.target.value)} />
      </div>
      <p className="text-sm text-slate-600 sm:col-span-2 lg:col-span-4">
        Price changes apply to new bookings only. To change the date or time, take this departure off sale and add a new one.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700 sm:col-span-2 lg:col-span-4">
          {error}
        </p>
      )}
      <div className="sm:col-span-2 lg:col-span-4">
        <button type="submit" className={primaryBtn} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function AddDeparturesForm({ products, today, onAdded }: { products: Products; today: string; onAdded: (created: number, skipped: number) => void }) {
  const [product, setProduct] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 6));
  const [days, setDays] = useState<boolean[]>(WEEKDAYS.map(() => true));
  const [timesText, setTimesText] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [seats, setSeats] = useState("");
  const [price, setPrice] = useState("");
  const [childPrice, setChildPrice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const options = useMemo<DropdownOption[]>(
    () => [
      ...products.tours.filter((t) => t.bookingMode !== "ENQUIRY").map((t) => ({ value: `tour:${t.slug}`, label: t.title, description: t.category === "PRIVATE" ? "Private · priced per vehicle" : undefined })),
      ...products.routes.map((r) => ({ value: `route:${r.slug}`, label: r.name, description: "Shuttle route" })),
    ],
    [products],
  );
  const isPrivate = product.startsWith("tour:") && products.tours.find((t) => `tour:${t.slug}` === product)?.category === "PRIVATE";
  const dates = useMemo(() => expandDates(from, to, days, 92), [from, to, days]);
  const parsed = timesText.trim() ? parseTimes(timesText) : { times: [] as string[] };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!product) return setError("Choose a tour or shuttle route.");
    if (dates.length === 0) return setError("No dates: check the range and weekdays.");
    if (dates.length > 92) return setError("Up to 92 dates at once. Shorten the range.");
    const t = parseTimes(timesText);
    if (t.error) return setError(t.error);
    setBusy(true);
    const res = await adminApi<{ created: string[]; skipped: number }>("/departures", "POST", {
      ...(product.startsWith("tour:") ? { tourSlug: product.slice(5) } : { routeSlug: product.slice(6) }),
      dates,
      times: t.times,
      ...(returnTime ? { returnTime } : {}),
      capacityTotal: Number(seats),
      price: Number(price),
      ...(childPrice.trim() ? { childPrice: Number(childPrice) } : {}),
    });
    setBusy(false);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't add departures."));
    setError("");
    onAdded(res.data.created?.length ?? 0, res.data.skipped ?? 0);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 bg-obsidian-50/60 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2">
        <Dropdown id="add-dep-product" label="Tour or route" value={product} onChange={setProduct} options={options} searchable searchPlaceholder="Search tours and routes" placeholder="Choose…" />
      </div>
      <div>
        <label htmlFor="add-dep-from" className={labelCls}>
          From
        </label>
        <input id="add-dep-from" type="date" required className={field} value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div>
        <label htmlFor="add-dep-to" className={labelCls}>
          To
        </label>
        <input id="add-dep-to" type="date" required min={from || undefined} className={field} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <fieldset className="sm:col-span-2 lg:col-span-4">
        <legend className={labelCls}>Runs on</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((name, i) => (
            <label key={name} htmlFor={`add-dep-day-${i}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-obsidian-900/10 bg-white px-4 text-sm">
              <input id={`add-dep-day-${i}`} type="checkbox" className="h-4 w-4 accent-ocean-600" checked={days[i]} onChange={(e) => setDays((ds) => ds.map((v, j) => (j === i ? e.target.checked : v)))} />
              {name}
            </label>
          ))}
        </div>
        <p className={`mt-2 text-sm ${dates.length > 92 ? "text-red-700" : "text-slate-600"}`}>
          {dates.length > 92 ? "More than 92 dates: shorten the range." : `${dates.length} date${dates.length === 1 ? "" : "s"}`}
          {dates.length > 0 && dates.length <= 92 && parsed.times.length > 0 && ` × ${parsed.times.length} time${parsed.times.length === 1 ? "" : "s"} = ${dates.length * parsed.times.length} departures`}
        </p>
      </fieldset>

      <div className="sm:col-span-2">
        <label htmlFor="add-dep-times" className={labelCls}>
          Times (24-hour, comma-separated)
        </label>
        <input
          id="add-dep-times"
          required
          className={field}
          value={timesText}
          onChange={(e) => setTimesText(e.target.value)}
          placeholder="08:30, 13:00"
          aria-invalid={Boolean(parsed.error)}
          aria-describedby={parsed.error ? "add-dep-times-error" : undefined}
        />
        {parsed.error && (
          <p id="add-dep-times-error" className="mt-1 text-sm text-red-700">
            {parsed.error}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="add-dep-return" className={labelCls}>
          Return time (optional)
        </label>
        <input id="add-dep-return" type="time" className={field} value={returnTime} onChange={(e) => setReturnTime(e.target.value)} />
      </div>
      <div>
        <label htmlFor="add-dep-seats" className={labelCls}>
          Seats
        </label>
        <input id="add-dep-seats" type="number" required min={1} max={100} step={1} inputMode="numeric" className={field} value={seats} onChange={(e) => setSeats(e.target.value)} />
      </div>
      <div>
        <label htmlFor="add-dep-price" className={labelCls}>
          Price (dollars){isPrivate ? ", per vehicle" : ""}
        </label>
        <input id="add-dep-price" type="number" required min={0} max={100000} step="0.01" inputMode="decimal" className={field} value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div>
        <label htmlFor="add-dep-child" className={labelCls}>
          Child price (optional)
        </label>
        <input id="add-dep-child" type="number" min={0} max={100000} step="0.01" inputMode="decimal" className={field} value={childPrice} onChange={(e) => setChildPrice(e.target.value)} />
      </div>
      <p className="text-sm text-slate-600 sm:col-span-2 lg:col-span-4">
        Prices are per guest. Private tours are priced per vehicle: the price is for the whole vehicle, and seats are the vehicle&apos;s seats.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700 sm:col-span-2 lg:col-span-4">
          {error}
        </p>
      )}
      <div className="sm:col-span-2 lg:col-span-4">
        <button type="submit" className={primaryBtn} disabled={busy || dates.length === 0 || dates.length > 92}>
          {busy ? "Adding…" : "Add departures"}
        </button>
      </div>
    </form>
  );
}
