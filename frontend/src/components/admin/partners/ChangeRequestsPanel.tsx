"use client";

// Admin → Partners → Change requests (owner, 2026-11-26): what partners asked for from the affiliate
// portal's change request form. Staff set the status and write a reply; the partner sees it in the
// portal and gets an email.

import { useCallback, useEffect, useState } from "react";
import { Dropdown } from "@/components/forms/Dropdown";

type Status = "OPEN" | "IN_PROGRESS" | "DONE" | "DECLINED";

interface Req {
  id: string;
  categoryLabel: string;
  subject: string;
  details: string;
  bookingReference: string | null;
  status: Status;
  staffNote: string | null;
  createdAt: string;
  partner: { id: string; name: string; code: string; email: string; contactName: string };
}

const STATUSES: { value: Status; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "DONE", label: "Done" },
  { value: "DECLINED", label: "Declined" },
];
const STYLE: Record<Status, string> = {
  OPEN: "bg-summit-100 text-obsidian-900",
  IN_PROGRESS: "bg-ocean-50 text-ocean-800",
  DONE: "bg-emerald-50 text-emerald-800",
  DECLINED: "bg-obsidian-100 text-slate-700",
};
const FILTERS: ("ALL" | Status)[] = ["ALL", "OPEN", "IN_PROGRESS", "DONE", "DECLINED"];
const label = (s: string) => STATUSES.find((x) => x.value === s)?.label ?? "All";
const when = (iso: string) => new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Edmonton" });
const field =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-obsidian-900 focus:border-ocean-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600";

export function ChangeRequestsPanel({ notify, onChange }: { notify: (m: string) => void; onChange: () => void }) {
  const [requests, setRequests] = useState<Req[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<"ALL" | Status>("OPEN");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/affiliates/admin/requests${filter === "ALL" ? "" : `?status=${filter}`}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRequests(data.requests ?? []);
      setCounts(data.counts ?? {});
      setError("");
    } catch {
      setError("Couldn't load change requests. Try again in a moment.");
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <section aria-labelledby="requests-heading" className="overflow-hidden rounded-none bg-white ring-1 ring-obsidian-900/[0.07]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-obsidian-900/[0.06] px-6 py-5">
        <div>
          <h2 id="requests-heading" className="text-xl text-obsidian-900">
            Change requests
          </h2>
          <p className="text-sm text-slate-600">Sent by partners from their portal. Your reply and status are emailed to the partner.</p>
        </div>
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm ${
                filter === f ? "border-obsidian-900 bg-obsidian-900 text-white" : "border-obsidian-900/10 bg-white text-obsidian-900 hover:border-obsidian-900/40"
              }`}
            >
              {label(f)}
              <span className={filter === f ? "text-white/75" : "text-slate-600"}>{f === "ALL" ? total : (counts[f] ?? 0)}</span>
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="mx-6 my-4 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </p>
      )}
      {!requests ? (
        !error && <p className="px-6 py-10 text-center text-slate-600">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="px-6 py-12 text-center text-base text-slate-600">No {filter === "ALL" ? "" : `${label(filter).toLowerCase()} `}change requests.</p>
      ) : (
        <ul className="divide-y divide-obsidian-900/[0.06]">
          {requests.map((r) => (
            <RequestRow
              key={`${r.id}-${r.status}-${r.staffNote ?? ""}`}
              request={r}
              onSaved={async (m) => {
                notify(m);
                await load();
                onChange();
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function RequestRow({ request: r, onSaved }: { request: Req; onSaved: (m: string) => Promise<void> }) {
  const [status, setStatus] = useState<Status>(r.status);
  const [note, setNote] = useState(r.staffNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changed = status !== r.status || note.trim() !== (r.staffNote ?? "");

  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/affiliates/admin/requests/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, staffNote: note.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || "Couldn't save.");
      await onSaved(`Request from ${r.partner.name} saved. ${r.partner.contactName} was emailed.`);
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="grid gap-4 px-6 py-5 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full px-3 py-1 text-sm ${STYLE[r.status]}`}>{label(r.status)}</span>
          <span className="text-sm text-slate-600">{r.categoryLabel}</span>
        </div>
        <p className="text-lg text-obsidian-900">{r.subject}</p>
        <p className="text-sm text-slate-600">
          {r.partner.name} ({r.partner.code}) · {r.partner.contactName}, {r.partner.email} · {when(r.createdAt)}
          {r.bookingReference ? ` · Booking ${r.bookingReference}` : ""}
        </p>
        <p className="whitespace-pre-line text-base text-slate-800">{r.details}</p>
      </div>
      <div className="space-y-3">
        <Dropdown id={`req-status-${r.id}`} label="Status" value={status} onChange={(v) => setStatus(v as Status)} options={STATUSES} />
        <div className="space-y-1.5">
          <label htmlFor={`req-note-${r.id}`} className="text-sm text-slate-700">
            Reply to the partner
          </label>
          <textarea id={`req-note-${r.id}`} rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className={field} />
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}
        <button type="button" disabled={busy || !changed} onClick={save} className="inline-flex h-11 items-center rounded-full bg-ocean-600 px-5 text-sm text-white hover:bg-ocean-700 disabled:opacity-60">
          {busy ? "Saving…" : "Save and email partner"}
        </button>
      </div>
    </li>
  );
}
