"use client";

// Admin: review partner applications, approve or suspend partners. Commission rate and the
// partner's Bokun booking channel can be set through PATCH /api/affiliates/admin/:id.

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";

interface Partner {
  id: string;
  name: string;
  contactName: string;
  email: string;
  code: string;
  type: string;
  website: string | null;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  commissionRate: number;
  bokunChannelId: string | null;
  bookings: number;
}

const FILTERS = ["ALL", "PENDING", "ACTIVE", "SUSPENDED"] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_STYLE: Record<Partner["status"], string> = {
  PENDING: "bg-summit-100 text-obsidian-900",
  ACTIVE: "bg-ocean-50 text-ocean-800",
  SUSPENDED: "bg-red-50 text-red-800",
};
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/affiliates/admin");
      if (res.status === 401 || res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) throw new Error();
      setForbidden(false);
      setPartners((await res.json()).affiliates);
    } catch {
      setError("Couldn't load partners. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(p: Partner, status: Partner["status"]) {
    setBusy(p.id);
    const res = await fetch(`/api/affiliates/admin/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setMessage(res.ok ? `${p.name} is now ${status.toLowerCase()}.` : `Couldn't update ${p.name}.`);
    setBusy(null);
    await load();
  }

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { ALL: 0, PENDING: 0, ACTIVE: 0, SUSPENDED: 0 };
    for (const p of partners ?? []) {
      c.ALL += 1;
      c[p.status] += 1;
    }
    return c;
  }, [partners]);
  const shown = (partners ?? []).filter((p) => filter === "ALL" || p.status === filter);

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <AdminHeader
        current="/admin/partners"
        eyebrow="Staff · Partner program"
        title="Partners"
        subtitle="Approve applications. Bookings are only credited to active partners."
        actions={
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-obsidian-900/15 bg-white px-4 text-sm text-obsidian-900 hover:bg-obsidian-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 px-page py-8 sm:py-10">
        {forbidden && !loading && <StaffSignIn body="Sign in with an admin account to manage partners." />}
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
            {error}
          </p>
        )}
        <p aria-live="polite" className={message ? "rounded-2xl bg-ocean-50 px-5 py-3 text-sm text-ocean-800" : "sr-only"}>
          {message}
        </p>

        {!forbidden && (
          <section aria-labelledby="partners-heading" className="overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-obsidian-900/[0.07]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-obsidian-900/[0.06] px-6 py-5">
              <h2 id="partners-heading" className="text-xl text-obsidian-900">
                Applications &amp; partners
              </h2>
              <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                    className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm ${
                      filter === f ? "border-obsidian-900 bg-obsidian-900 text-white" : "border-obsidian-900/15 bg-white text-obsidian-900 hover:border-obsidian-900/40"
                    }`}
                  >
                    {f === "ALL" ? "All" : label(f)}
                    <span className={filter === f ? "text-white/75" : "text-slate-600"}>{counts[f]}</span>
                  </button>
                ))}
              </div>
            </div>

            {loading && !partners ? (
              <ul className="divide-y divide-obsidian-900/[0.06]" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="px-6 py-5">
                    <span className="block h-5 w-1/3 rounded bg-obsidian-100 motion-safe:animate-pulse" />
                  </li>
                ))}
              </ul>
            ) : shown.length === 0 ? (
              <p className="px-6 py-12 text-center text-base text-slate-600">{filter === "ALL" ? "No partner applications yet." : `No ${label(filter).toLowerCase()} partners.`}</p>
            ) : (
              <div className="overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ocean-600" tabIndex={0} role="region" aria-label="Partners table">
                <table className="w-full min-w-[46rem] text-left text-base">
                  <thead className="bg-obsidian-50/70 text-sm text-slate-600">
                    <tr>
                      <th scope="col" className="px-6 py-3 font-normal">Partner</th>
                      <th scope="col" className="px-6 py-3 font-normal">Code</th>
                      <th scope="col" className="px-6 py-3 font-normal">Type</th>
                      <th scope="col" className="px-6 py-3 text-right font-normal">Bookings</th>
                      <th scope="col" className="px-6 py-3 font-normal">Status</th>
                      <th scope="col" className="px-6 py-3 text-right font-normal">
                        <span className="sr-only">Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-obsidian-900/[0.06]">
                    {shown.map((p) => (
                      <tr key={p.id} className="hover:bg-obsidian-50/60">
                        <td className="px-6 py-4">
                          <span className="block text-obsidian-900">{p.name}</span>
                          <span className="block text-sm text-slate-600">
                            {p.contactName} · {p.email}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm">{p.code}</td>
                        <td className="px-6 py-4 text-sm">{label(p.type)}</td>
                        <td className="px-6 py-4 text-right tabular-nums">{p.bookings}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-sm ${STATUS_STYLE[p.status]}`}>{label(p.status)}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {p.status === "ACTIVE" ? (
                            <button
                              type="button"
                              disabled={busy === p.id}
                              onClick={() => setStatus(p, "SUSPENDED")}
                              className="inline-flex h-10 items-center rounded-full border border-red-200 px-4 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                            >
                              Suspend <span className="sr-only">{p.name}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy === p.id}
                              onClick={() => setStatus(p, "ACTIVE")}
                              className="inline-flex h-10 items-center rounded-full bg-ocean-600 px-4 text-sm text-white hover:bg-ocean-700 disabled:opacity-60"
                            >
                              {p.status === "PENDING" ? "Approve" : "Reactivate"} <span className="sr-only">{p.name}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
