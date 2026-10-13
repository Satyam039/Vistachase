"use client";

// Audit log (admins only): every recorded change, newest first, filtered by action, record type,
// person, booking reference and date. Pages through older entries with "Load more".

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dropdown } from "@/components/forms/Dropdown";
import { Empty, Grid, Loading, Panel, adminApi, errorOf, field, isDenied, labelCls, quietBtn, when, words } from "@/components/admin/staff/shared";

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string; role: string } | null;
}

interface Filters {
  actions: string[];
  entityTypes: string[];
  people: { id: string; name: string | null; email: string }[];
}

interface AuditResponse {
  logs: AuditLog[];
  next: string | null;
  filters?: Filters;
}

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const shortId = (id: string | null) => (id ? (id.length > 10 ? `${id.slice(0, 8)}…` : id) : "–");
const valueText = (v: unknown) => (v === null || v === undefined ? "–" : typeof v === "object" ? JSON.stringify(v) : String(v));

function Details({ details }: { details: unknown }) {
  if (details === null || details === undefined || (typeof details === "object" && Object.keys(details as object).length === 0)) {
    return <span className="text-slate-600">–</span>;
  }
  const entries = typeof details === "object" && !Array.isArray(details) ? Object.entries(details as Record<string, unknown>) : null;
  return (
    <div className="text-sm">
      {entries ? (
        <ul className="space-y-0.5">
          {entries.slice(0, 4).map(([k, v]) => (
            <li key={k} className="break-words">
              <span className="text-slate-600">{k}:</span> {short(valueText(v), 60)}
            </li>
          ))}
          {entries.length > 4 && <li className="text-slate-600">+{entries.length - 4} more</li>}
        </ul>
      ) : (
        <p className="break-words">{short(valueText(details), 120)}</p>
      )}
      <details className="mt-1">
        <summary className="cursor-pointer text-ocean-700 hover:underline">All details</summary>
        <pre className="mt-2 max-h-72 max-w-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-obsidian-50 p-3 font-mono text-sm text-obsidian-900">
          {JSON.stringify(details, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export function AuditLogPanel({ onDenied }: { onDenied: () => void }) {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [userId, setUserId] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const request = useRef(0);

  const params = useCallback(() => {
    const p = new URLSearchParams();
    if (action) p.set("action", action);
    if (entityType) p.set("entityType", entityType);
    if (userId) p.set("userId", userId);
    if (q.trim()) p.set("q", q.trim());
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p;
  }, [action, entityType, userId, q, from, to]);

  // Any filter change restarts from the first page; older responses are ignored.
  const load = useCallback(async () => {
    const id = ++request.current;
    const res = await adminApi<AuditResponse>(`/audit-logs?${params()}`);
    if (id !== request.current) return;
    if (isDenied(res.status)) return onDenied();
    if (!res.ok) return setError(errorOf(res.data, "Couldn't load the audit log."));
    setError("");
    setLogs(res.data.logs);
    setNext(res.data.next);
    if (res.data.filters) setFilters((f) => f ?? res.data.filters ?? null);
  }, [params, onDenied]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  async function loadMore() {
    if (!next) return;
    const id = request.current;
    setMore(true);
    const p = params();
    p.set("before", next);
    const res = await adminApi<AuditResponse>(`/audit-logs?${p}`);
    setMore(false);
    if (id !== request.current) return;
    if (!res.ok) return setError(errorOf(res.data, "Couldn't load older entries."));
    setError("");
    setLogs((l) => [...(l ?? []), ...res.data.logs]);
    setNext(res.data.next);
  }

  const personName = (p: { name: string | null; email: string }) => (p.name ? `${p.name} (${p.email})` : p.email);

  return (
    <Panel id="audit-log" title="Audit log" description="Every change made by staff and by the system, newest first. Times are Mountain Time.">
      <div className="grid gap-3 border-b border-obsidian-900/[0.06] px-6 py-4 sm:grid-cols-2 lg:grid-cols-3">
        <Dropdown
          id="audit-action"
          label="Action"
          searchable
          value={action}
          onChange={setAction}
          options={[{ value: "", label: "All actions" }, ...(filters?.actions ?? []).map((a) => ({ value: a, label: words(a) }))]}
        />
        <Dropdown
          id="audit-entity"
          label="Record type"
          value={entityType}
          onChange={setEntityType}
          options={[{ value: "", label: "All records" }, ...(filters?.entityTypes ?? []).map((t) => ({ value: t, label: t }))]}
        />
        <Dropdown
          id="audit-user"
          label="Person"
          searchable
          value={userId}
          onChange={setUserId}
          options={[{ value: "", label: "Anyone" }, { value: "system", label: "System" }, ...(filters?.people ?? []).map((p) => ({ value: p.id, label: personName(p) }))]}
        />
        <div>
          <label htmlFor="audit-q" className={labelCls}>
            Booking reference
          </label>
          <input id="audit-q" type="search" className={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Exact reference" />
        </div>
        <div>
          <label htmlFor="audit-from" className={labelCls}>
            From
          </label>
          <input id="audit-from" type="date" className={field} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="audit-to" className={labelCls}>
            To
          </label>
          <input id="audit-to" type="date" className={field} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {error && (
        <p role="alert" className="mx-6 my-4 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {!logs ? (
        <Loading />
      ) : logs.length === 0 ? (
        <Empty>No entries match these filters.</Empty>
      ) : (
        <>
          <Grid label="Audit log entries" minWidth="min-w-[64rem]" head={[["Time"], ["Person"], ["Action"], ["Record"], ["Details"]]}>
            {logs.map((log) => (
              <tr key={log.id} className="align-top hover:bg-obsidian-50/60">
                <td className="whitespace-nowrap px-6 py-4 text-sm">{when(log.createdAt)}</td>
                <td className="px-6 py-4 text-sm">
                  {log.user ? (
                    <>
                      <span className="block text-obsidian-900">{log.user.name || log.user.email}</span>
                      {log.user.name && <span className="block break-all text-slate-600">{log.user.email}</span>}
                    </>
                  ) : (
                    <span className="text-slate-600">System</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">{words(log.action)}</td>
                <td className="px-6 py-4 text-sm">
                  <span className="block text-obsidian-900">{log.entityType}</span>
                  <span className="block font-mono text-slate-600" title={log.entityId ?? undefined}>
                    {shortId(log.entityId)}
                  </span>
                  {log.entityType === "Booking" && log.entityId && (
                    <Link href="/admin/bookings#bookings" className="text-ocean-700 hover:underline">
                      Open <span className="sr-only">bookings</span>
                    </Link>
                  )}
                </td>
                <td className="px-6 py-4">
                  <Details details={log.details} />
                </td>
              </tr>
            ))}
          </Grid>
          <div className="flex items-center justify-between gap-4 border-t border-obsidian-900/[0.06] px-6 py-4">
            <p className="text-sm text-slate-600">
              Showing {logs.length} {logs.length === 1 ? "entry" : "entries"}
              {next ? "" : ", all that match"}
            </p>
            {next && (
              <button type="button" className={quietBtn} onClick={loadMore} disabled={more}>
                {more ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}
