"use client";

// Quick Book: staff book a guest onto a local departure (phone or desk), paid offline or still
// due. The server prices the booking, checks seats and sends the voucher when asked; a repeated
// submit with the same idempotency key returns the booking the first one made.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Dropdown } from "@/components/forms/Dropdown";
import {
  BOOKING_STATUS_STYLE,
  Chip,
  Empty,
  Loading,
  Panel,
  adminApi,
  errorOf,
  field,
  labelCls,
  money,
  primaryBtn,
  quietBtn,
  todayMT,
  words,
} from "@/components/admin/staff/shared";

interface Product {
  slug: string;
  title: string;
  category: string;
  bookingMode: string;
  currency: string;
}

interface Departure {
  id: string;
  date: string;
  departureTime: string;
  returnTime: string | null;
  experience: string;
  category: string;
  capacityTotal: number;
  capacityBooked: number;
  capacityHeld: number;
  price: number;
  childPrice: number | null;
  currency: string;
  status: string;
  inventorySource: string;
}

interface Stop {
  id: string;
  name: string;
  town: string;
  isActive: boolean;
}

interface Booked {
  id: string;
  bookingReference: string;
  status: string;
  totalAmount: number;
  currency: string;
  voucherUrl: string;
}

const METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "ETRANSFER", label: "E-transfer" },
  { value: "CARD_TERMINAL", label: "Card terminal" },
  { value: "OTHER", label: "Other" },
  { value: "UNPAID", label: "Not paid yet" },
];
const OTHER_STOP = "__other";

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`.padEnd(
        16,
        "0",
      );
const seatsLeft = (d: Departure) =>
  Math.max(0, d.capacityTotal - d.capacityBooked - d.capacityHeld);

export function QuickBookForm({ notify }: { notify: (m: string) => void }) {
  const [tours, setTours] = useState<Product[] | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loadError, setLoadError] = useState("");
  const [tourSlug, setTourSlug] = useState("");
  const [date, setDate] = useState("");
  const [departures, setDepartures] = useState<Departure[] | null>(null);
  const [depError, setDepError] = useState("");
  const [departureId, setDepartureId] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [stop, setStop] = useState("");
  const [stopText, setStopText] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [requests, setRequests] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [notifyGuest, setNotifyGuest] = useState(true);

  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<Booked | null>(null);

  useEffect(() => {
    setDate(todayMT());
    setKey(newKey());
    void (async () => {
      const [p, s] = await Promise.all([
        adminApi<{ tours: Product[] }>("/departures/products"),
        adminApi<{ stops: Stop[] }>("/pickup-stops"),
      ]);
      if (!p.ok)
        return setLoadError(errorOf(p.data, "Couldn't load the tours."));
      setTours(p.data.tours.filter((t) => t.bookingMode !== "ENQUIRY"));
      if (s.ok) setStops(s.data.stops.filter((x) => x.isActive));
      else setLoadError(errorOf(s.data, "Couldn't load the pickup stops."));
    })();
  }, []);

  const loadDepartures = useCallback(async () => {
    if (!tourSlug || !/^\d{4}-\d{2}-\d{2}$/.test(date))
      return setDepartures(null);
    setDepartures(null);
    const params = new URLSearchParams({ tourSlug, from: date, to: date });
    const res = await adminApi<{ departures: Departure[] }>(
      `/departures?${params}`,
    );
    if (!res.ok) {
      setDepError(errorOf(res.data, "Couldn't load departures."));
      return setDepartures([]);
    }
    setDepError("");
    setDepartures(
      res.data.departures.filter(
        (d) => d.status === "ACTIVE" && d.inventorySource === "LOCAL",
      ),
    );
  }, [tourSlug, date]);

  useEffect(() => {
    setDepartureId("");
    void loadDepartures();
  }, [loadDepartures]);

  const departure = departures?.find((d) => d.id === departureId) ?? null;
  const isPrivate = departure?.category === "PRIVATE";
  const estimate = useMemo(() => {
    if (!departure) return null;
    if (isPrivate) return departure.price;
    return (
      adults * departure.price +
      children * (departure.childPrice ?? departure.price)
    );
  }, [departure, isPrivate, adults, children]);

  function reset() {
    setDepartureId("");
    setName("");
    setEmail("");
    setPhone("");
    setAdults(1);
    setChildren(0);
    setInfants(0);
    setStop("");
    setStopText("");
    setPickupTime("");
    setRequests("");
    setMethod("CASH");
    setReference("");
    setNotifyGuest(true);
    setError("");
    setBooked(null);
    setKey(newKey());
    void loadDepartures();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!departureId) return setError("Pick a departure first.");
    setBusy(true);
    setError("");
    const body = {
      departureId,
      customerName: name.trim(),
      customerEmail: email.trim(),
      customerPhone: phone.trim(),
      ...(stop && stop !== OTHER_STOP ? { pickupStopId: stop } : {}),
      ...(stop === OTHER_STOP && stopText.trim()
        ? { pickupCustomText: stopText.trim() }
        : {}),
      ...(pickupTime ? { pickupTime } : {}),
      adultsCount: adults,
      childrenCount: children,
      infantsCount: infants,
      ...(requests.trim() ? { specialRequests: requests.trim() } : {}),
      payment: {
        method,
        ...(method !== "UNPAID" && reference.trim()
          ? { reference: reference.trim() }
          : {}),
      },
      notifyGuest,
      idempotencyKey: key,
    };
    const res = await adminApi<{ booking: Booked }>(
      "/quick-book",
      "POST",
      body,
    );
    setBusy(false);
    if (!res.ok)
      return setError(errorOf(res.data, "The booking couldn't be made."));
    setBooked(res.data.booking);
    notify(`Booked ${res.data.booking.bookingReference}.`);
  }

  if (booked) {
    return (
      <Panel id="staff-quick-book" title="Booked">
        <div className="space-y-5 px-6 py-6">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-slate-600">Reference</dt>
              <dd className="font-mono text-xl text-obsidian-900">
                {booked.bookingReference}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">Status</dt>
              <dd className="mt-1">
                <Chip
                  className={
                    BOOKING_STATUS_STYLE[booked.status] ??
                    "bg-obsidian-100 text-slate-700"
                  }
                >
                  {words(booked.status)}
                </Chip>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">Total</dt>
              <dd className="tabular-nums text-xl text-obsidian-900">
                {money(booked.totalAmount, booked.currency)}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <a
              href={booked.voucherUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={quietBtn}
            >
              Open voucher<span className="sr-only"> (opens in a new tab)</span>
            </a>
            <button type="button" className={primaryBtn} onClick={reset}>
              Book another
            </button>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      id="staff-quick-book"
      title="Quick Book"
      description="Book a guest onto a departure for a phone or desk booking. Seats and the price are checked by the server when you book."
    >
      {loadError && (
        <p
          role="alert"
          className="mx-6 my-4 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200"
        >
          {loadError}
        </p>
      )}
      {!tours ? (
        !loadError && <Loading />
      ) : (
        <form onSubmit={submit} className="divide-y divide-obsidian-900/[0.06]">
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <Dropdown
              id="qb-tour"
              label="Tour"
              searchable
              searchPlaceholder="Search tours"
              placeholder="Pick a tour"
              value={tourSlug}
              onChange={setTourSlug}
              options={tours.map((t) => ({
                value: t.slug,
                label: t.title,
                description: words(t.category),
              }))}
            />
            <div>
              <label htmlFor="qb-date" className={labelCls}>
                Date
              </label>
              <input
                id="qb-date"
                type="date"
                required
                className={field}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              {!tourSlug ? (
                <p className="text-sm text-slate-600">
                  Pick a tour to see that day&apos;s departures.
                </p>
              ) : depError ? (
                <p role="alert" className="text-sm text-red-700">
                  {depError}
                </p>
              ) : !departures ? (
                <p className="text-sm text-slate-600">Loading departures…</p>
              ) : departures.length === 0 ? (
                <Empty>
                  No bookable departures on this day. Add one on the Departures
                  page.
                </Empty>
              ) : (
                <fieldset>
                  <legend className={labelCls}>Departure</legend>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {departures.map((d) => {
                      const left = seatsLeft(d);
                      return (
                        <label
                          key={d.id}
                          htmlFor={`qb-dep-${d.id}`}
                          className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 ${departureId === d.id ? "border-ocean-600 bg-ocean-50/60" : "border-obsidian-900/10"}`}
                        >
                          <input
                            id={`qb-dep-${d.id}`}
                            type="radio"
                            name="qb-departure"
                            value={d.id}
                            checked={departureId === d.id}
                            onChange={() => setDepartureId(d.id)}
                            className="mt-1 h-4 w-4 accent-ocean-600"
                          />
                          <span>
                            <span className="block text-base text-obsidian-900">
                              {d.departureTime}
                              {d.returnTime && (
                                <span className="text-slate-600">
                                  {" "}
                                  – {d.returnTime}
                                </span>
                              )}
                            </span>
                            <span className="block text-sm text-slate-600">
                              {left} of {d.capacityTotal} seats left ·{" "}
                              {money(d.price, d.currency)}
                              {d.category === "PRIVATE"
                                ? " per vehicle"
                                : " per guest"}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </div>
          </div>

          <div className="px-6 py-5">
            <fieldset>
              <legend className="mb-3 text-lg text-obsidian-900">Guest</legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="qb-name" className={labelCls}>
                    Name
                  </label>
                  <input
                    id="qb-name"
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="off"
                    className={field}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="qb-email" className={labelCls}>
                    Email
                  </label>
                  <input
                    id="qb-email"
                    type="email"
                    required
                    maxLength={200}
                    autoComplete="off"
                    className={field}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="qb-phone" className={labelCls}>
                    Phone
                  </label>
                  <input
                    id="qb-phone"
                    type="tel"
                    required
                    minLength={7}
                    maxLength={32}
                    autoComplete="off"
                    className={field}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <Count
                  id="qb-adults"
                  label="Adults"
                  min={1}
                  max={30}
                  value={adults}
                  onChange={setAdults}
                />
                <Count
                  id="qb-children"
                  label="Children"
                  min={0}
                  max={30}
                  value={children}
                  onChange={setChildren}
                />
                <Count
                  id="qb-infants"
                  label="Infants"
                  min={0}
                  max={10}
                  value={infants}
                  onChange={setInfants}
                />
              </div>
            </fieldset>
          </div>

          <div className="px-6 py-5">
            <fieldset>
              <legend className="mb-3 text-lg text-obsidian-900">
                Pickup and requests
              </legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <Dropdown
                  id="qb-stop"
                  label="Pickup stop"
                  searchable={stops.length > 8}
                  searchPlaceholder="Search stops"
                  value={stop}
                  onChange={setStop}
                  options={[
                    { value: "", label: "No pickup stop" },
                    ...stops.map((s) => ({
                      value: s.id,
                      label: s.name,
                      description: s.town,
                    })),
                    { value: OTHER_STOP, label: "Other (type the address)" },
                  ]}
                />
                {stop === OTHER_STOP ? (
                  <div>
                    <label htmlFor="qb-stop-text" className={labelCls}>
                      Pickup place
                    </label>
                    <input
                      id="qb-stop-text"
                      required
                      maxLength={200}
                      className={field}
                      value={stopText}
                      onChange={(e) => setStopText(e.target.value)}
                    />
                  </div>
                ) : null}
                <div>
                  <label htmlFor="qb-pickup-time" className={labelCls}>
                    Pickup time (optional)
                  </label>
                  <input
                    id="qb-pickup-time"
                    type="time"
                    className={field}
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-3">
                  <label htmlFor="qb-requests" className={labelCls}>
                    Special requests (optional)
                  </label>
                  <textarea
                    id="qb-requests"
                    rows={2}
                    maxLength={1000}
                    className={field}
                    value={requests}
                    onChange={(e) => setRequests(e.target.value)}
                  />
                </div>
              </div>
            </fieldset>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <fieldset>
              <legend className={labelCls}>Payment</legend>
              <div className="flex flex-wrap gap-2">
                {METHODS.map((m) => (
                  <label
                    key={m.value}
                    htmlFor={`qb-pay-${m.value}`}
                    className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm ${method === m.value ? "border-ocean-600 bg-ocean-50/60" : "border-obsidian-900/10"}`}
                  >
                    <input
                      id={`qb-pay-${m.value}`}
                      type="radio"
                      name="qb-payment"
                      value={m.value}
                      checked={method === m.value}
                      onChange={() => setMethod(m.value)}
                      className="h-4 w-4 accent-ocean-600"
                    />
                    {m.label}
                  </label>
                ))}
              </div>
              {method === "UNPAID" && (
                <p className="mt-2 text-sm text-slate-600">
                  A Payment due flag is raised so the payment can be recorded
                  later.
                </p>
              )}
            </fieldset>
            {method !== "UNPAID" && (
              <div>
                <label htmlFor="qb-pay-ref" className={labelCls}>
                  Payment reference (optional)
                </label>
                <input
                  id="qb-pay-ref"
                  maxLength={120}
                  className={field}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Receipt, e-transfer or terminal id"
                />
              </div>
            )}
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="rounded-2xl bg-obsidian-50 px-5 py-4 text-sm text-slate-700">
              <p className="text-base text-obsidian-900">
                Priced by the server at booking
              </p>
              {departure && estimate != null ? (
                <p className="mt-1">
                  Rough estimate: {money(estimate, departure.currency)}
                  {isPrivate
                    ? " (private tour, priced per vehicle)"
                    : " (price × guests, before add-ons and promos)"}
                  . The final total shows once booked.
                </p>
              ) : (
                <p className="mt-1">
                  Pick a departure to see a rough estimate.
                </p>
              )}
            </div>
            <label
              htmlFor="qb-notify"
              className="inline-flex cursor-pointer items-center gap-3 text-base text-obsidian-900"
            >
              <input
                id="qb-notify"
                type="checkbox"
                className="h-5 w-5 accent-ocean-600"
                checked={notifyGuest}
                onChange={(e) => setNotifyGuest(e.target.checked)}
              />
              Email the guest their voucher
            </label>
            {error && (
              <p
                role="alert"
                className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200"
              >
                {error}
              </p>
            )}
            <div>
              <button
                type="submit"
                className={primaryBtn}
                disabled={busy || !departureId || !key}
              >
                {busy ? "Booking…" : "Book"}
              </button>
            </div>
          </div>
        </form>
      )}
    </Panel>
  );
}

function Count({
  id,
  label,
  min,
  max,
  value,
  onChange,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        required
        min={min}
        max={max}
        step={1}
        className={field}
        value={value}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          onChange(Number.isNaN(n) ? min : Math.min(max, Math.max(min, n)));
        }}
      />
    </div>
  );
}
