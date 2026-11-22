"use client";

// Staff promo codes (/admin/promo-codes). A code takes a percent or a CAD amount off the tour fare
// (never off the airport transfer), optionally only between two days (Mountain Time) and only a
// number of times. Uses count live bookings: an unpaid booking that expires, or a cancelled one,
// gives its use back. Admins add, edit, turn off and delete codes (the server checks the role).

import { Fragment, useCallback, useEffect, useState, type FormEvent } from "react";
import { Dropdown } from "@/components/forms/Dropdown";
import { Chip, Empty, Grid, Loading, Panel, adminApi, dangerBtn, errorOf, field, labelCls, primaryBtn, quietBtn } from "@/components/admin/staff/shared";

type Kind = "PERCENT" | "AMOUNT";
type State = "LIVE" | "OFF" | "SCHEDULED" | "EXPIRED" | "USED_UP";

interface Promo {
  id: string;
  code: string;
  kind: Kind;
  value: number;
  label: string;
  isActive: boolean;
  startsOn: string | null;
  endsOn: string | null;
  maxUses: number | null;
  uses: number;
  paidBookings: number;
  note: string;
  state: State;
}

interface SettingCode {
  code: string;
  label: string;
  uses: number;
  paidBookings: number;
}

const STATE: Record<State, { label: string; cls: string }> = {
  LIVE: { label: "Live", cls: "bg-ocean-50 text-ocean-800" },
  OFF: { label: "Off", cls: "bg-obsidian-100 text-slate-700" },
  SCHEDULED: { label: "Starts later", cls: "bg-amber-50 text-amber-800" },
  EXPIRED: { label: "Expired", cls: "bg-obsidian-100 text-slate-700" },
  USED_UP: { label: "Used up", cls: "bg-obsidian-100 text-slate-700" },
};

const fmtDay = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : null);

export function PromoCodesPanel({ notify, role }: { notify: (m: string) => void; role: string }) {
  const canManage = role === "ADMIN";
  const [promos, setPromos] = useState<Promo[] | null>(null);
  const [fromSettings, setFromSettings] = useState<SettingCode[]>([]);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const load = useCallback(async () => {
    const res = await adminApi<{ promos: Promo[]; fromSettings: SettingCode[] }>("/promo-codes");
    if (!res.ok) return setError(errorOf(res.data, "Couldn't load promo codes."));
    setError("");
    setPromos(res.data.promos ?? []);
    setFromSettings(res.data.fromSettings ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(p: Promo) {
    setBusyId(p.id);
    setRowError(null);
    const res = await adminApi(`/promo-codes/${p.id}`, "PATCH", { isActive: !p.isActive });
    setBusyId(null);
    if (!res.ok) return setRowError({ id: p.id, message: errorOf(res.data, "Couldn't change this code.") });
    notify(`${p.code} turned ${p.isActive ? "off" : "on"}.`);
    await load();
  }

  async function remove(p: Promo) {
    if (!window.confirm(`Delete ${p.code}? Guests can no longer use it. Bookings already made with it keep their discount.`)) return;
    setBusyId(p.id);
    setRowError(null);
    const res = await adminApi(`/promo-codes/${p.id}`, "DELETE");
    setBusyId(null);
    if (!res.ok) return setRowError({ id: p.id, message: errorOf(res.data, "Couldn't delete this code.") });
    notify(`${p.code} deleted.`);
    await load();
  }

  const columns: [string, boolean?][] = [["Code"], ["Discount"], ["Dates"], ["Uses", true], ["Status"], ...(canManage ? ([[""]] as [string][]) : [])];

  return (
    <>
      <Panel
        id="promo-codes"
        title="Promo codes"
        description="Guests type the code at checkout and press Apply. It takes the discount off the tour price (not off the airport transfer). Codes are not case-sensitive. A use is counted when a booking is made with the code; unpaid bookings that expire and cancelled bookings give their use back."
        actions={
          canManage && (
            <button type="button" className={adding ? quietBtn : primaryBtn} aria-expanded={adding} onClick={() => setAdding((a) => !a)}>
              {adding ? "Close" : "New promo code"}
            </button>
          )
        }
      >
        {canManage && adding && (
          <div className="border-b border-obsidian-900/[0.06] bg-obsidian-50/60 px-6 py-5">
            <PromoForm
              idPrefix="new-promo"
              submitLabel="Create code"
              onSave={async (body) => {
                const res = await adminApi("/promo-codes", "POST", body);
                if (!res.ok) return errorOf(res.data, "Couldn't create the code.");
                setAdding(false);
                notify(`${body.code.toUpperCase()} created. Guests can use it at checkout now.`);
                await load();
                return "";
              }}
            />
          </div>
        )}

        {error && (
          <p role="alert" className="mx-6 my-4 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
            {error}
          </p>
        )}

        {!promos ? (
          <Loading />
        ) : promos.length === 0 ? (
          <Empty>No promo codes yet.{canManage ? " Press New promo code to make one." : ""}</Empty>
        ) : (
          <Grid label="Promo codes" minWidth="min-w-[56rem]" head={columns}>
            {promos.map((p) => (
              <Fragment key={p.id}>
                <tr className={`align-top ${editing === p.id ? "bg-ocean-50/60" : "hover:bg-obsidian-50/60"}`}>
                  <td className="px-6 py-4">
                    <span className="block font-mono text-obsidian-900">{p.code}</span>
                    {p.note && <span className="block text-sm text-slate-600">{p.note}</span>}
                  </td>
                  <td className="px-6 py-4">{p.label}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {!p.startsOn && !p.endsOn ? "Any time" : `${fmtDay(p.startsOn) ?? "Now"} to ${fmtDay(p.endsOn) ?? "no end"}`}
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums">
                    {p.uses}
                    {p.maxUses != null ? ` / ${p.maxUses}` : ""}
                    <span className="block text-sm text-slate-600">{p.paidBookings} paid</span>
                  </td>
                  <td className="px-6 py-4">
                    <Chip className={STATE[p.state].cls}>{STATE[p.state].label}</Chip>
                  </td>
                  {canManage && (
                    <td className="px-6 py-4 text-right">
                      <span className="flex flex-wrap justify-end gap-2">
                        <button type="button" className={quietBtn} aria-expanded={editing === p.id} onClick={() => setEditing((e) => (e === p.id ? null : p.id))}>
                          {editing === p.id ? "Close" : "Edit"} <span className="sr-only">{p.code}</span>
                        </button>
                        <button type="button" className={quietBtn} disabled={busyId === p.id} onClick={() => void toggle(p)}>
                          {p.isActive ? "Turn off" : "Turn on"} <span className="sr-only">{p.code}</span>
                        </button>
                        <button type="button" className={dangerBtn} disabled={busyId === p.id} onClick={() => void remove(p)}>
                          Delete <span className="sr-only">{p.code}</span>
                        </button>
                      </span>
                      {rowError?.id === p.id && (
                        <p role="alert" className="mt-2 text-left text-sm text-red-700">
                          {rowError.message}
                        </p>
                      )}
                    </td>
                  )}
                </tr>
                {canManage && editing === p.id && (
                  <tr className="bg-ocean-50/60">
                    <td colSpan={columns.length} className="px-6 pb-5">
                      <div className="rounded-none bg-white p-5 ring-1 ring-obsidian-900/[0.07]">
                        <PromoForm
                          idPrefix={`edit-${p.id}`}
                          initial={p}
                          submitLabel="Save"
                          onSave={async (body) => {
                            const res = await adminApi(`/promo-codes/${p.id}`, "PATCH", body);
                            if (!res.ok) return errorOf(res.data, "Couldn't save the code.");
                            setEditing(null);
                            notify(`${body.code.toUpperCase()} saved.`);
                            await load();
                            return "";
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </Grid>
        )}
      </Panel>

      {fromSettings.length > 0 && (
        <Panel
          id="promo-codes-settings"
          title="Codes from the server settings"
          description="These come from PROMO_CODES in the server's backend .env and also work at checkout. To change or stop one here, create a code with the same name above (turn it off to stop it)."
        >
          <Grid label="Codes from the server settings" minWidth="min-w-[32rem]" head={[["Code"], ["Discount"], ["Uses", true]]}>
            {fromSettings.map((s) => (
              <tr key={s.code}>
                <td className="px-6 py-4 font-mono">{s.code}</td>
                <td className="px-6 py-4">{s.label}</td>
                <td className="px-6 py-4 text-right tabular-nums">
                  {s.uses}
                  <span className="block text-sm text-slate-600">{s.paidBookings} paid</span>
                </td>
              </tr>
            ))}
          </Grid>
        </Panel>
      )}
    </>
  );
}

interface PromoBody {
  code: string;
  kind: Kind;
  value: number;
  isActive: boolean;
  startsOn: string | null;
  endsOn: string | null;
  maxUses: number | null;
  note: string;
}

/** Add/edit form. `onSave` returns an error message, or "" when saved. */
function PromoForm({ idPrefix: p, initial, submitLabel, onSave }: { idPrefix: string; initial?: Promo; submitLabel: string; onSave: (body: PromoBody) => Promise<string> }) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "PERCENT");
  const [value, setValue] = useState(initial ? String(initial.value) : "");
  const [startsOn, setStartsOn] = useState(initial?.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(initial?.endsOn ?? "");
  const [maxUses, setMaxUses] = useState(initial?.maxUses != null ? String(initial.maxUses) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const message = await onSave({
      code: code.trim().toUpperCase(),
      kind,
      value: Number(value),
      isActive,
      startsOn: startsOn || null,
      endsOn: endsOn || null,
      maxUses: maxUses.trim() ? Number(maxUses) : null,
      note: note.trim(),
    });
    setBusy(false);
    setError(message);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label htmlFor={`${p}-code`} className={labelCls}>
          Code
        </label>
        <input
          id={`${p}-code`}
          required
          minLength={3}
          maxLength={40}
          pattern="[A-Za-z0-9_\-]{3,40}"
          title="3 to 40 letters, numbers, - or _ (no spaces)"
          className={`${field} font-mono uppercase`}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\s+/g, ""))}
          placeholder="SUMMER10"
        />
      </div>
      <div>
        <Dropdown
          id={`${p}-kind`}
          label="Discount type"
          labelClassName={labelCls}
          value={kind}
          onChange={(v) => setKind(v as Kind)}
          options={[
            { value: "PERCENT", label: "Percent off (%)" },
            { value: "AMOUNT", label: "Amount off (CAD)" },
          ]}
        />
      </div>
      <div>
        <label htmlFor={`${p}-value`} className={labelCls}>
          {kind === "PERCENT" ? "Percent off" : "CAD off per booking"}
        </label>
        <input
          id={`${p}-value`}
          type="number"
          required
          min={kind === "PERCENT" ? 1 : 0.01}
          max={kind === "PERCENT" ? 100 : 10000}
          step={kind === "PERCENT" ? 1 : 0.01}
          inputMode="decimal"
          className={field}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor={`${p}-max`} className={labelCls}>
          Use limit (optional)
        </label>
        <input id={`${p}-max`} type="number" min={1} max={100000} step={1} inputMode="numeric" className={field} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Unlimited" />
      </div>
      <div>
        <label htmlFor={`${p}-starts`} className={labelCls}>
          First day (optional)
        </label>
        <input id={`${p}-starts`} type="date" className={field} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
      </div>
      <div>
        <label htmlFor={`${p}-ends`} className={labelCls}>
          Last day (optional)
        </label>
        <input id={`${p}-ends`} type="date" min={startsOn || undefined} className={field} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${p}-note`} className={labelCls}>
          Note for staff (optional)
        </label>
        <input id={`${p}-note`} maxLength={300} className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Hotel partner, newsletter" />
      </div>
      <p className="text-sm text-slate-600 sm:col-span-2 lg:col-span-4">Dates are in Banff time and include the whole last day. The date a guest books on counts, not the tour date.</p>
      <div className="sm:col-span-2 lg:col-span-4">
        <label htmlFor={`${p}-active`} className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input id={`${p}-active`} type="checkbox" className="h-4 w-4 accent-ocean-600" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          On: guests can use this code
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 sm:col-span-2 lg:col-span-4">
          {error}
        </p>
      )}
      <div className="sm:col-span-2 lg:col-span-4">
        <button type="submit" className={primaryBtn} disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
