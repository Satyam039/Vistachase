"use client";

// Partner dashboard → Coupons (owner, 2026-11-22): the partner makes their own coupon codes. Each has
// a percent off (up to the cap the server sets), an optional start and end date, active/inactive,
// and where it applies (shared tours, private tours, shuttles: any combination). Guests type the
// code at checkout; bookings made with it are credited to this partner. The server checks
// everything again (routes/affiliates.routes.ts /me/coupons).

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Scope = "SHARED" | "PRIVATE" | "SHUTTLE";
type State = "ACTIVE" | "INACTIVE" | "SCHEDULED" | "EXPIRED";

interface Coupon {
  id: string;
  code: string;
  percentOff: number;
  label: string;
  isActive: boolean;
  startsOn: string | null;
  endsOn: string | null;
  appliesTo: Scope[];
  uses: number;
  paidBookings: number;
  state: State;
}

const SCOPES: { value: Scope; label: string }[] = [
  { value: "SHARED", label: "Shared tours" },
  { value: "PRIVATE", label: "Private tours" },
  { value: "SHUTTLE", label: "Shuttles" },
];
const STATE: Record<State, { label: string; cls: string }> = {
  ACTIVE: { label: "Active", cls: "bg-emerald-50 text-emerald-700" },
  INACTIVE: { label: "Inactive", cls: "bg-slate-100 text-slate-600" },
  SCHEDULED: { label: "Starts later", cls: "bg-amber-50 text-amber-700" },
  EXPIRED: { label: "Expired", cls: "bg-slate-100 text-slate-600" },
};
const scopeText = (a: Scope[]) => (a.length === SCOPES.length ? "Shared, private & shuttles" : SCOPES.filter((s) => a.includes(s.value)).map((s) => s.label).join(", "));
const fmtDay = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : null);
const field = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-ocean-600 focus:outline-none";
const labelCls = "text-xs font-medium uppercase tracking-wider text-slate-700";
const quietBtn = "inline-flex h-9 items-center rounded-full border border-slate-300 bg-white px-4 text-xs font-medium text-slate-800 hover:border-slate-500 disabled:opacity-60";

async function call(url: string, method: string, body?: object) {
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
  const data = res ? await res.json().catch(() => ({})) : {};
  const firstField = data?.fields ? (Object.values(data.fields as Record<string, string[]>)[0]?.[0] ?? "") : "";
  return { ok: !!res?.ok, data, error: (firstField || data?.error || "We couldn't reach the server. Please try again.") as string };
}

export function PartnerCoupons() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [maxPercent, setMaxPercent] = useState(20);
  const [canCreate, setCanCreate] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<{ kind: "new" } | { kind: "edit"; coupon: Coupon } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await call("/api/affiliates/me/coupons", "GET");
    if (!r.ok) return setError("Couldn't load your coupons. Try again in a moment.");
    setError("");
    setCoupons(r.data.coupons ?? []);
    setMaxPercent(r.data.maxPercent ?? 20);
    setCanCreate(!!r.data.canCreate);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(c: Coupon) {
    setBusy(c.id);
    const r = await call(`/api/affiliates/me/coupons/${c.id}`, "PATCH", { isActive: !c.isActive });
    setBusy(null);
    setMessage(r.ok ? `${c.code} ${c.isActive ? "deactivated. Guests can't use it now." : "activated."}` : r.error);
    await load();
  }

  async function remove(c: Coupon) {
    if (!window.confirm(`Delete coupon ${c.code}? Guests can no longer use it. Bookings already made with it keep their discount.`)) return;
    setBusy(c.id);
    const r = await call(`/api/affiliates/me/coupons/${c.id}`, "DELETE");
    setBusy(null);
    setMessage(r.ok ? `${c.code} deleted.` : r.error);
    if (mode?.kind === "edit" && mode.coupon.id === c.id) setMode(null);
    await load();
  }

  return (
    <section aria-labelledby="coupons-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="coupons-heading" className="text-2xl font-light text-slate-900">Coupons</h1>
          <p className="max-w-2xl text-xs text-slate-500">
            Create coupon codes for your guests. They type the code at checkout and get the discount; every booking made with your coupon is credited to you.
            Up to {maxPercent}% off.
          </p>
        </div>
        {canCreate && (
          <button type="button" onClick={() => setMode(mode?.kind === "new" ? null : { kind: "new" })} aria-expanded={mode?.kind === "new"} className="golden-summit-btn inline-flex h-11 items-center rounded-full px-6 text-xs font-medium">
            {mode?.kind === "new" ? "Close" : "New coupon"}
          </button>
        )}
      </div>

      {!canCreate && coupons && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">You can create coupons once your partner account is approved.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <p aria-live="polite" className={message ? "rounded-xl bg-ocean-50 px-4 py-3 text-sm text-ocean-800" : "sr-only"}>
        {message}
      </p>

      {mode && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <CouponForm
            key={mode.kind === "edit" ? mode.coupon.id : "new"}
            initial={mode.kind === "edit" ? mode.coupon : undefined}
            maxPercent={maxPercent}
            onCancel={() => setMode(null)}
            onSave={async (body) => {
              const r = mode.kind === "edit" ? await call(`/api/affiliates/me/coupons/${mode.coupon.id}`, "PATCH", { ...body, code: undefined }) : await call("/api/affiliates/me/coupons", "POST", body);
              if (!r.ok) return r.error;
              setMessage(mode.kind === "edit" ? `${body.code} saved.` : `${body.code} created. Guests can use it at checkout now.`);
              setMode(null);
              await load();
              return "";
            }}
          />
        </div>
      )}

      {!coupons ? (
        !error && <p className="text-sm text-slate-500">Loading coupons…</p>
      ) : coupons.length === 0 ? (
        <p className="text-sm text-slate-500">No coupons yet.{canCreate ? " Press New coupon to make one." : ""}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm" tabIndex={0} role="region" aria-labelledby="coupons-heading">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                {["Code", "Discount", "Start / end date", "Where it applies", "Uses", "Status", ""].map((h, i) => (
                  <th key={h || i} scope="col" className={`px-5 py-3.5 font-medium ${h === "Uses" ? "text-right" : ""}`}>
                    {h || <span className="sr-only">Actions</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coupons.map((c) => (
                <tr key={c.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-5 py-3 font-mono text-slate-900">{c.code}</td>
                  <td className="px-5 py-3">{c.label}</td>
                  <td className="px-5 py-3 text-xs text-slate-600">{!c.startsOn && !c.endsOn ? "Any time" : `${fmtDay(c.startsOn) ?? "Now"} to ${fmtDay(c.endsOn) ?? "no end"}`}</td>
                  <td className="px-5 py-3 text-xs text-slate-600">{scopeText(c.appliesTo)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {c.uses}
                    <span className="block text-[11px] text-slate-500">{c.paidBookings} paid</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATE[c.state].cls}`}>{STATE[c.state].label}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex flex-wrap justify-end gap-2">
                      <button type="button" className={quietBtn} onClick={() => setMode({ kind: "edit", coupon: c })}>
                        Edit <span className="sr-only">{c.code}</span>
                      </button>
                      <button type="button" className={quietBtn} disabled={busy === c.id || (!c.isActive && !canCreate)} onClick={() => void toggle(c)}>
                        {c.isActive ? "Deactivate" : "Activate"} <span className="sr-only">{c.code}</span>
                      </button>
                      <button type="button" className={`${quietBtn} text-red-700`} disabled={busy === c.id} onClick={() => void remove(c)}>
                        Delete <span className="sr-only">{c.code}</span>
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

interface CouponBody {
  code: string;
  percentOff: number;
  startsOn: string | null;
  endsOn: string | null;
  isActive: boolean;
  appliesTo: Scope[];
}

function CouponForm({ initial, maxPercent, onSave, onCancel }: { initial?: Coupon; maxPercent: number; onSave: (b: CouponBody) => Promise<string>; onCancel: () => void }) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [percent, setPercent] = useState(initial ? String(initial.percentOff) : "");
  const [startsOn, setStartsOn] = useState(initial?.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(initial?.endsOn ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [appliesTo, setAppliesTo] = useState<Scope[]>(initial?.appliesTo ?? SCOPES.map((s) => s.value));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (appliesTo.length === 0) return setError("Choose where the coupon applies: shared tours, private tours or shuttles.");
    setSaving(true);
    setError(await onSave({ code: code.trim().toUpperCase(), percentOff: Number(percent), startsOn: startsOn || null, endsOn: endsOn || null, isActive, appliesTo }));
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
      <h2 className="text-lg font-light text-slate-900 md:col-span-2">{initial ? `Edit ${initial.code}` : "New coupon"}</h2>
      <div className="space-y-1.5">
        <label htmlFor="coupon-code" className={labelCls}>Coupon code</label>
        <input
          id="coupon-code"
          required
          disabled={!!initial}
          minLength={3}
          maxLength={40}
          pattern="[A-Za-z0-9_\-]{3,40}"
          title="3 to 40 letters, numbers, - or _ (no spaces)"
          className={`${field} font-mono uppercase disabled:bg-slate-50`}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\s+/g, ""))}
          placeholder="HOTEL10"
        />
        {initial && <p className="text-xs text-slate-500">The code can&apos;t change once made.</p>}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="coupon-percent" className={labelCls}>Percentage discount (%)</label>
        <input id="coupon-percent" type="number" required min={1} max={maxPercent} step={1} inputMode="numeric" className={field} value={percent} onChange={(e) => setPercent(e.target.value)} placeholder={`1 to ${maxPercent}`} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="coupon-starts" className={labelCls}>Start date</label>
        <input id="coupon-starts" type="date" className={field} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="coupon-ends" className={labelCls}>End date</label>
        <input id="coupon-ends" type="date" min={startsOn || undefined} className={field} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
      </div>
      <p className="-mt-2 text-xs text-slate-500 md:col-span-2">Leave a date empty for no limit. Dates are in Banff time and include the whole end date; the day the guest books counts.</p>
      <fieldset className="md:col-span-2">
        <legend className={labelCls}>Where does it apply</legend>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          {SCOPES.map((s) => (
            <label key={s.value} htmlFor={`coupon-scope-${s.value}`} className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                id={`coupon-scope-${s.value}`}
                type="checkbox"
                className="h-4 w-4 accent-ocean-600"
                checked={appliesTo.includes(s.value)}
                onChange={(e) => setAppliesTo((a) => (e.target.checked ? [...a, s.value] : a.filter((x) => x !== s.value)))}
              />
              {s.label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">Pick one, two or all three.</p>
      </fieldset>
      <label htmlFor="coupon-active" className="inline-flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
        <input id="coupon-active" type="checkbox" className="h-4 w-4 accent-ocean-600" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Active: guests can use this coupon
      </label>
      {error && <p role="alert" className="text-sm text-red-700 md:col-span-2">{error}</p>}
      <div className="flex gap-3 md:col-span-2">
        <button type="submit" disabled={saving} className="golden-summit-btn inline-flex h-11 items-center rounded-full px-7 text-xs font-medium disabled:opacity-60">
          {saving ? "Saving…" : initial ? "Save coupon" : "Create coupon"}
        </button>
        <button type="button" onClick={onCancel} className={quietBtn + " h-11"}>Cancel</button>
      </div>
    </form>
  );
}
