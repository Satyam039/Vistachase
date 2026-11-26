"use client";

// Admin: review partner applications (approve, reject or delete them), suspend partners, add and edit partners, and
// run the commission program (rules, ledger, payouts, report: components/admin/partners).

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, RefreshCw, Trash2, XCircle } from "lucide-react";
import { ModalDialog } from "@/components/forms/ModalDialog";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";
import { ChangeRequestsPanel } from "@/components/admin/partners/ChangeRequestsPanel";
import { PartnerContractDialog, downloadPdf } from "@/components/admin/partners/PartnerContractDialog";
import { CommissionsPanel, CreatePartnerForm, EditPartnerForm, PartnerApplicationDetails, PayoutsPanel, ReportPanel, RulesPanel, type AdminPartner as Partner } from "@/components/admin/partners/PartnerAdminPanels";

const SECTIONS = [
  ["partners", "Partners"],
  ["requests", "Change requests"],
  ["rules", "Commission rules"],
  ["commissions", "Commissions"],
  ["payouts", "Payouts"],
  ["report", "Report"],
] as const;
type Section = (typeof SECTIONS)[number][0];

const FILTERS = ["ALL", "PENDING", "ACTIVE", "SUSPENDED", "REJECTED"] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_STYLE: Record<Partner["status"], string> = {
  PENDING: "bg-summit-100 text-obsidian-900",
  ACTIVE: "bg-ocean-50 text-ocean-800",
  SUSPENDED: "bg-red-50 text-red-800",
  REJECTED: "bg-obsidian-100 text-slate-700",
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
  const [section, setSection] = useState<Section>("partners");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // Reject and Delete ask first (owner, 2026-11-18): Reject keeps the record and emails the
  // applicant; Delete removes an application with no bookings, commission or payouts.
  const [confirm, setConfirm] = useState<{ kind: "reject" | "delete"; partner: Partner } | null>(null);
  const [confirmError, setConfirmError] = useState("");
  // Approve (commission % + products, then the agreement is sent) or send a new agreement.
  const [contractFor, setContractFor] = useState<{ partner: Partner; mode: "approve" | "update" } | null>(null);

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

  async function confirmAction() {
    if (!confirm) return;
    const p = confirm.partner;
    setBusy(p.id);
    setConfirmError("");
    try {
      const res =
        confirm.kind === "reject"
          ? await fetch(`/api/affiliates/admin/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "REJECTED" }) })
          : await fetch(`/api/affiliates/admin/${p.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setConfirmError(data.error || `Couldn't ${confirm.kind} ${p.name}.`);
        return;
      }
      setMessage(confirm.kind === "reject" ? `${p.name}'s application was rejected.` : `${p.name} was deleted.`);
      if (editing === p.id) setEditing(null);
      setConfirm(null);
      await load();
    } catch {
      setConfirmError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { ALL: 0, PENDING: 0, ACTIVE: 0, SUSPENDED: 0, REJECTED: 0 };
    for (const p of partners ?? []) {
      c.ALL += 1;
      c[p.status] += 1;
    }
    return c;
  }, [partners]);
  const openRequests = (partners ?? []).reduce((n, p) => n + (p.openRequests ?? 0), 0);
  const shown = (partners ?? []).filter((p) => filter === "ALL" || p.status === filter);

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <AdminHeader
        current="/admin/partners"
        eyebrow="Staff · Partner program"
        title="Partners"
        subtitle="Review applications (download them as PDF), approve them with the commission you choose and send the partner agreement, answer change requests and record payouts."
        actions={
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-obsidian-900/10 bg-white px-4 text-sm text-obsidian-900 hover:bg-obsidian-50 disabled:opacity-60"
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
          <div role="tablist" aria-label="Partner program sections" className="flex gap-2 overflow-x-auto pb-1">
            {SECTIONS.map(([id, name]) => (
              <button
                key={id}
                id={`section-${id}`}
                type="button"
                role="tab"
                aria-selected={section === id}
                aria-controls={`section-panel-${id}`}
                onClick={() => setSection(id)}
                className={`inline-flex h-11 shrink-0 items-center rounded-full border px-5 text-sm ${
                  section === id ? "border-obsidian-900 bg-obsidian-900 text-white" : "border-obsidian-900/10 bg-white text-obsidian-900 hover:border-obsidian-900/40"
                }`}
              >
                {name}
                {id === "requests" && openRequests > 0 && (
                  <span className={`ml-2 inline-flex min-w-6 justify-center rounded-full px-1.5 text-xs ${section === id ? "bg-white text-obsidian-900" : "bg-summit-300 text-obsidian-900"}`}>{openRequests}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {!forbidden && partners && section !== "partners" && (
          <div id={`section-panel-${section}`} role="tabpanel" aria-labelledby={`section-${section}`}>
            {section === "requests" && <ChangeRequestsPanel notify={setMessage} onChange={load} />}
            {section === "rules" && <RulesPanel partners={partners} notify={setMessage} />}
            {section === "commissions" && <CommissionsPanel partners={partners} notify={setMessage} onChange={load} />}
            {section === "payouts" && <PayoutsPanel partners={partners} notify={setMessage} onChange={load} />}
            {section === "report" && <ReportPanel />}
          </div>
        )}

        {!forbidden && section === "partners" && (
          <div id="section-panel-partners" role="tabpanel" aria-labelledby="section-partners" className="space-y-6">
            <div className="flex justify-end">
              <button
                type="button"
                aria-expanded={adding}
                onClick={() => setAdding((a) => !a)}
                className="inline-flex h-11 items-center rounded-full bg-ocean-600 px-5 text-sm text-white hover:bg-ocean-700"
              >
                {adding ? "Close" : "Add a partner"}
              </button>
            </div>
            {adding && (
              <CreatePartnerForm
                notify={setMessage}
                onDone={() => {
                  setAdding(false);
                  void load();
                }}
              />
            )}
            <section aria-labelledby="partners-heading" className="overflow-hidden rounded-none bg-white ring-1 ring-obsidian-900/[0.07]">
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
                        filter === f ? "border-obsidian-900 bg-obsidian-900 text-white" : "border-obsidian-900/10 bg-white text-obsidian-900 hover:border-obsidian-900/40"
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
                  <table className="w-full min-w-[58rem] text-left text-base">
                    <thead className="bg-obsidian-50/70 text-sm text-slate-600">
                      <tr>
                        <th scope="col" className="px-6 py-3 font-normal">Partner</th>
                        <th scope="col" className="px-6 py-3 font-normal">Code</th>
                        <th scope="col" className="px-6 py-3 font-normal">Type</th>
                        <th scope="col" className="px-6 py-3 text-right font-normal">Bookings</th>
                        <th scope="col" className="px-6 py-3 text-right font-normal">Commission</th>
                        <th scope="col" className="px-6 py-3 font-normal">Status</th>
                        <th scope="col" className="px-6 py-3 text-right font-normal">
                          <span className="sr-only">Action</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-obsidian-900/[0.06]">
                      {shown.map((p) => (
                        <Fragment key={p.id}>
                          <tr className="hover:bg-obsidian-50/60">
                            <td className="px-6 py-4">
                              <span className="block text-obsidian-900">
                                {p.name}
                                {p.openRequests > 0 && (
                                  <button type="button" onClick={() => setSection("requests")} className="ml-2 rounded-full bg-summit-100 px-2 py-0.5 text-xs text-obsidian-900 hover:bg-summit-200">
                                    {p.openRequests} open request{p.openRequests === 1 ? "" : "s"}
                                  </button>
                                )}
                              </span>
                              <span className="block text-sm text-slate-600">
                                {p.contactName} · {p.email}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-mono text-sm">{p.code}</td>
                            <td className="px-6 py-4 text-sm">{label(p.type)}</td>
                            <td className="px-6 py-4 text-right tabular-nums">{p.bookings}</td>
                            <td className="px-6 py-4 text-right text-sm tabular-nums">
                              <span className="block">
                                {p.contract
                                  ? `${p.contract.commissionPercent}% · agreement v${p.contract.version}`
                                  : p.commissionSetAt
                                    ? `${Math.round(p.commissionRate * 1000) / 10}% (no agreement)`
                                    : p.status === "ACTIVE"
                                      ? `${Math.round(p.commissionRate * 1000) / 10}% (old default, not set by staff)`
                                      : "Not set"}
                              </span>
                              {p.contract && <span className="ml-auto block max-w-[16rem] truncate text-slate-600" title={p.contract.products.join(", ")}>{p.contract.products.join(", ")}</span>}
                              <span className="block text-slate-600">
                                ${p.commission.approved.toFixed(2)} approved · ${p.commission.pending.toFixed(2)} pending
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex rounded-full px-3 py-1 text-sm ${STATUS_STYLE[p.status]}`}>{label(p.status)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex min-w-[12rem] flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                aria-expanded={editing === p.id}
                                onClick={() => setEditing(editing === p.id ? null : p.id)}
                                className="inline-flex h-10 items-center rounded-full border border-obsidian-900/10 px-4 text-sm text-obsidian-900 hover:bg-obsidian-50"
                              >
                                {editing === p.id ? "Close" : "Edit"} <span className="sr-only">{p.name}</span>
                              </button>
                              {p.status === "ACTIVE" ? (
                                <>
                                <button
                                  type="button"
                                  disabled={busy === p.id}
                                  onClick={() => setContractFor({ partner: p, mode: "update" })}
                                  className="inline-flex h-10 items-center rounded-full border border-obsidian-900/10 px-4 text-sm text-obsidian-900 hover:bg-obsidian-50 disabled:opacity-60"
                                >
                                  New agreement <span className="sr-only">for {p.name}</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={busy === p.id}
                                  onClick={() => setStatus(p, "SUSPENDED")}
                                  className="inline-flex h-10 items-center rounded-full border border-red-200 px-4 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                                >
                                  Suspend <span className="sr-only">{p.name}</span>
                                </button>
                                </>
                              ) : (
                                <>
                                  {p.status === "PENDING" && (
                                    <button
                                      type="button"
                                      disabled={busy === p.id}
                                      onClick={() => {
                                        setConfirmError("");
                                        setConfirm({ kind: "reject", partner: p });
                                      }}
                                      className="inline-flex h-10 items-center rounded-full border border-red-200 px-4 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                                    >
                                      Reject <span className="sr-only">{p.name}</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={busy === p.id}
                                    onClick={() => (p.status === "SUSPENDED" && p.commissionSetAt ? setStatus(p, "ACTIVE") : setContractFor({ partner: p, mode: "approve" }))}
                                    className="inline-flex h-10 items-center rounded-full bg-ocean-600 px-4 text-sm text-white hover:bg-ocean-700 disabled:opacity-60"
                                  >
                                    {p.status === "SUSPENDED" && p.commissionSetAt ? "Reactivate" : "Approve"} <span className="sr-only">{p.name}</span>
                                  </button>
                                </>
                              )}
                              {p.hasApplication && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const problem = await downloadPdf(`/api/affiliates/admin/${p.id}/application/pdf`, `partner-application-${p.code}.pdf`);
                                    if (problem) setMessage(problem);
                                  }}
                                  aria-label={`Download ${p.name}'s application as PDF`}
                                  title="Application PDF"
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-obsidian-900/10 text-slate-700 hover:bg-obsidian-50"
                                >
                                  <FileDown className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={busy === p.id}
                                onClick={() => {
                                  setConfirmError("");
                                  setConfirm({ kind: "delete", partner: p });
                                }}
                                aria-label={`Delete ${p.name}`}
                                title="Delete"
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-obsidian-900/10 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                              </div>
                            </td>
                          </tr>
                          {editing === p.id && (
                            <tr>
                              <td colSpan={7} className="p-0">
                                <PartnerApplicationDetails partnerId={p.id} />
                                <EditPartnerForm
                                  partner={p}
                                  notify={setMessage}
                                  onDone={() => {
                                    setEditing(null);
                                    void load();
                                  }}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
      <PartnerContractDialog
        partner={contractFor?.partner ?? null}
        mode={contractFor?.mode ?? "approve"}
        onClose={() => setContractFor(null)}
        onDone={(m) => {
          setContractFor(null);
          setMessage(m);
          void load();
        }}
      />
      <ModalDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === "reject" ? "Reject this application?" : "Delete this partner?"}
        icon={
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-700">
            {confirm?.kind === "reject" ? <XCircle className="h-6 w-6" aria-hidden="true" /> : <Trash2 className="h-6 w-6" aria-hidden="true" />}
          </span>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => setConfirm(null)}
              className="inline-flex h-11 items-center rounded-full border border-obsidian-900/10 px-5 text-sm text-obsidian-900 hover:bg-obsidian-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!!confirm && busy === confirm.partner.id}
              onClick={confirmAction}
              className="inline-flex h-11 items-center rounded-full bg-red-700 px-5 text-sm text-white hover:bg-red-800 disabled:opacity-60"
            >
              {confirm?.kind === "reject" ? "Reject application" : "Delete permanently"}
            </button>
          </>
        }
      >
        {confirm && (
          <>
            <p>
              <span className="text-obsidian-900">{confirm.partner.name}</span> ({confirm.partner.contactName}, {confirm.partner.email})
            </p>
            {confirm.kind === "reject" ? (
              <p>The application is marked rejected and they get an email saying it wasn&apos;t approved. They can&apos;t sign in to the partner portal. You can still approve it later.</p>
            ) : (
              <p>
                The application and its sign-in account are removed for good, so the email can apply again. Partners with bookings, commission or payouts can&apos;t be
                deleted: reject or suspend them instead.
              </p>
            )}
            {confirmError && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                {confirmError}
              </p>
            )}
          </>
        )}
      </ModalDialog>
    </div>
  );
}
