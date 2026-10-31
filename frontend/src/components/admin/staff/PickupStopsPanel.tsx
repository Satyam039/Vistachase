"use client";

// Staff pickup stops (/admin/pickup-stops): every stop, turned-off ones too, with its active
// bookings. ADMIN and OPERATOR add stops, edit every field and turn stops off or on; there is no
// delete because bookings point to stops (the server checks the role again).

import { Fragment, useCallback, useEffect, useState, type FormEvent } from "react";
import { Chip, Empty, Grid, Loading, Panel, adminApi, errorOf, field, labelCls, primaryBtn, quietBtn, dangerBtn } from "@/components/admin/staff/shared";

interface Stop {
  id: string;
  name: string;
  town: string;
  address: string;
  latitude: number;
  longitude: number;
  instructions: string;
  sortOrder: number;
  isActive: boolean;
  activeBookings: number;
}

const MANAGERS = ["ADMIN", "OPERATOR"];

export function PickupStopsPanel({ notify, role }: { notify: (m: string) => void; role: string }) {
  const canManage = MANAGERS.includes(role);
  const [stops, setStops] = useState<Stop[] | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const load = useCallback(async () => {
    const res = await adminApi<{ stops: Stop[] }>("/pickup-stops");
    if (!res.ok) return setError(errorOf(res.data, "Couldn't load pickup stops."));
    setError("");
    setStops(res.data.stops ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(s: Stop) {
    setBusyId(s.id);
    setRowError(null);
    const res = await adminApi(`/pickup-stops/${s.id}`, "PATCH", { isActive: !s.isActive });
    setBusyId(null);
    if (!res.ok) return setRowError({ id: s.id, message: errorOf(res.data, "Couldn't change this stop.") });
    notify(`${s.name} turned ${s.isActive ? "off" : "on"}.`);
    await load();
  }

  const columns: [string, boolean?][] = [["Stop"], ["Address"], ["Instructions"], ["Order", true], ["Bookings", true], ["Status"], ...(canManage ? ([[""]] as [string][]) : [])];

  return (
    <Panel
      id="pickup-stops"
      title="Pickup stops"
      description="Turned-off stops disappear from the checkout and the AI concierge. Stops can't be deleted because bookings point to them. If you rename a stop, keep its address so the deploy doesn't add the original again."
      actions={
        canManage && (
          <button type="button" className={adding ? quietBtn : primaryBtn} aria-expanded={adding} onClick={() => setAdding((a) => !a)}>
            {adding ? "Close" : "Add stop"}
          </button>
        )
      }
    >
      {canManage && adding && (
        <div className="border-b border-obsidian-900/[0.06] bg-obsidian-50/60 px-6 py-5">
          <StopForm
            idPrefix="new-stop"
            submitLabel="Add stop"
            onSave={async (body) => {
              const res = await adminApi("/pickup-stops", "POST", body);
              if (!res.ok) return errorOf(res.data, "Couldn't add the stop.");
              setAdding(false);
              notify(`${body.name} added.`);
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

      {!stops ? (
        <Loading />
      ) : stops.length === 0 ? (
        <Empty>No pickup stops yet.</Empty>
      ) : (
        <Grid label="Pickup stops" minWidth="min-w-[64rem]" head={columns}>
          {stops.map((s) => (
            <Fragment key={s.id}>
              <tr className={`align-top ${editing === s.id ? "bg-ocean-50/60" : "hover:bg-obsidian-50/60"}`}>
                <td className="px-6 py-4">
                  <span className="block text-obsidian-900">{s.name}</span>
                  <span className="block text-sm text-slate-600">{s.town}</span>
                </td>
                <td className="max-w-[16rem] px-6 py-4 text-sm">{s.address}</td>
                <td className="max-w-[20rem] px-6 py-4 text-sm text-slate-700">{s.instructions || <span className="text-slate-600">–</span>}</td>
                <td className="px-6 py-4 text-right tabular-nums">{s.sortOrder}</td>
                <td className="px-6 py-4 text-right tabular-nums">{s.activeBookings}</td>
                <td className="px-6 py-4">
                  <Chip className={s.isActive ? "bg-ocean-50 text-ocean-800" : "bg-obsidian-100 text-slate-700"}>{s.isActive ? "On" : "Off"}</Chip>
                </td>
                {canManage && (
                  <td className="px-6 py-4 text-right">
                    <span className="flex flex-wrap justify-end gap-2">
                      <button type="button" className={quietBtn} aria-expanded={editing === s.id} onClick={() => setEditing((e) => (e === s.id ? null : s.id))}>
                        {editing === s.id ? "Close" : "Edit"} <span className="sr-only">{s.name}</span>
                      </button>
                      <button type="button" className={s.isActive ? dangerBtn : quietBtn} disabled={busyId === s.id} onClick={() => void toggle(s)}>
                        {s.isActive ? "Turn off" : "Turn on"} <span className="sr-only">{s.name}</span>
                      </button>
                    </span>
                    {rowError?.id === s.id && (
                      <p role="alert" className="mt-2 text-left text-sm text-red-700">
                        {rowError.message}
                      </p>
                    )}
                  </td>
                )}
              </tr>
              {canManage && editing === s.id && (
                <tr className="bg-ocean-50/60">
                  <td colSpan={columns.length} className="px-6 pb-5">
                    <div className="rounded-none bg-white p-5 ring-1 ring-obsidian-900/[0.07]">
                      <StopForm
                        idPrefix={`edit-${s.id}`}
                        initial={s}
                        submitLabel="Save"
                        onSave={async (body) => {
                          const res = await adminApi(`/pickup-stops/${s.id}`, "PATCH", body);
                          if (!res.ok) return errorOf(res.data, "Couldn't save the stop.");
                          setEditing(null);
                          notify(`${body.name} saved.`);
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
  );
}

interface StopBody {
  name: string;
  town: string;
  address: string;
  latitude: number;
  longitude: number;
  instructions: string;
  sortOrder?: number;
  isActive: boolean;
}

/** Add/edit form. `onSave` returns an error message, or "" when saved. */
function StopForm({ idPrefix: p, initial, submitLabel, onSave }: { idPrefix: string; initial?: Stop; submitLabel: string; onSave: (body: StopBody) => Promise<string> }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [town, setTown] = useState(initial?.town ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [latitude, setLatitude] = useState(initial ? String(initial.latitude) : "");
  const [longitude, setLongitude] = useState(initial ? String(initial.longitude) : "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [sortOrder, setSortOrder] = useState(initial ? String(initial.sortOrder) : "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const message = await onSave({
      name: name.trim(),
      town: town.trim(),
      address: address.trim(),
      latitude: Number(latitude),
      longitude: Number(longitude),
      instructions: instructions.trim(),
      ...(sortOrder.trim() !== "" ? { sortOrder: Number(sortOrder) } : {}),
      isActive,
    });
    setBusy(false);
    setError(message);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2">
        <label htmlFor={`${p}-name`} className={labelCls}>
          Name
        </label>
        <input id={`${p}-name`} required minLength={2} maxLength={120} className={field} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor={`${p}-town`} className={labelCls}>
          Town
        </label>
        <input id={`${p}-town`} required minLength={2} maxLength={60} className={field} value={town} onChange={(e) => setTown(e.target.value)} />
      </div>
      <div>
        <label htmlFor={`${p}-order`} className={labelCls}>
          Order (optional)
        </label>
        <input id={`${p}-order`} type="number" min={0} max={10000} step={1} inputMode="numeric" className={field} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <label htmlFor={`${p}-address`} className={labelCls}>
          Address
        </label>
        <input id={`${p}-address`} required minLength={3} maxLength={200} className={field} value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div>
        <label htmlFor={`${p}-lat`} className={labelCls}>
          Latitude
        </label>
        <input id={`${p}-lat`} type="number" required min={-90} max={90} step="any" inputMode="decimal" className={field} value={latitude} onChange={(e) => setLatitude(e.target.value)} aria-describedby={`${p}-coords-help`} />
      </div>
      <div>
        <label htmlFor={`${p}-lng`} className={labelCls}>
          Longitude
        </label>
        <input id={`${p}-lng`} type="number" required min={-180} max={180} step="any" inputMode="decimal" className={field} value={longitude} onChange={(e) => setLongitude(e.target.value)} aria-describedby={`${p}-coords-help`} />
      </div>
      <p id={`${p}-coords-help`} className="self-end pb-3 text-sm text-slate-600 sm:col-span-2">
        Right-click the place in Google Maps to copy its coordinates.
      </p>
      <div className="sm:col-span-2 lg:col-span-4">
        <label htmlFor={`${p}-instructions`} className={labelCls}>
          Instructions for guests (optional)
        </label>
        <textarea id={`${p}-instructions`} rows={3} maxLength={1000} className={field} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <label htmlFor={`${p}-active`} className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input id={`${p}-active`} type="checkbox" className="h-4 w-4 accent-ocean-600" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          On: guests can choose this stop
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
