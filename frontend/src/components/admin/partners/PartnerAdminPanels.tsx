"use client";

// Staff tools for the partner program, used by /admin/partners: create and edit partners,
// commission rules, the commission ledger (approve, adjust), payouts (draft, mark paid, cancel)
// and the period report with CSV export. Every action goes through /api/affiliates/admin/* and is
// audited there. The app never moves money: payouts are sent outside it and then marked paid.

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Download } from "lucide-react";
import { Dropdown } from "@/components/forms/Dropdown";

export interface AdminPartner {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string | null;
  payoutEmail: string | null;
  code: string;
  type: string;
  website: string | null;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  commissionRate: number;
  bokunChannelId: string | null;
  bookings: number;
  commission: { pending: number; approved: number; paid: number };
}

interface Rule {
  id: string;
  name: string;
  partner: string | null;
  tour: string | null;
  category: string | null;
  percent: number | null;
  fixedAmount: number | null;
  active: boolean;
  validFrom: string;
  validTo: string | null;
}

interface Line {
  id: string;
  type: "EARNED" | "REVERSAL" | "ADJUSTMENT";
  status: "PENDING" | "APPROVED" | "PAID";
  amount: number;
  basis: number;
  reason: string | null;
  bookingReference: string | null;
  experience: string | null;
  tourDate: string | null;
  payoutId: string | null;
  createdAt: string;
}

interface Payout {
  id: string;
  partner: string;
  code: string;
  payoutEmail: string | null;
  amount: number;
  currency: string;
  status: "DRAFT" | "PAID" | "CANCELLED";
  method: string | null;
  reference: string | null;
  lines: number;
  paidAt: string | null;
  createdAt: string;
}

interface ReportRow {
  affiliateId: string;
  partner: string;
  code: string;
  clicks: number;
  bookings: number;
  paidBookings: number;
  guests: number;
  sales: number;
  commissionEarned: number;
  commissionReversed: number;
  commissionNet: number;
  conversion: number | null;
}

const money = (n: number) => `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "–");
const words = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
const field =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-obsidian-900 focus:border-ocean-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600";
const primaryBtn = "inline-flex h-11 items-center rounded-full bg-ocean-600 px-5 text-sm text-white hover:bg-ocean-700 disabled:opacity-60";
const quietBtn = "inline-flex h-10 items-center rounded-full border border-obsidian-900/10 bg-white px-4 text-sm text-obsidian-900 hover:bg-obsidian-50 disabled:opacity-60";

async function call(path: string, method = "GET", body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(`/api/affiliates/admin${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "Network error. Please try again." } };
  }
}

const errorOf = (data: Record<string, unknown>, fallback: string) => {
  const fields = data.fields as Record<string, string[]> | undefined;
  const first = fields ? Object.entries(fields).find(([, v]) => v?.length) : undefined;
  return first ? `${first[0]}: ${first[1][0]}` : typeof data.error === "string" ? data.error : fallback;
};

function Panel({ id, title, actions, children }: { id: string; title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="overflow-hidden rounded-none bg-white ring-1 ring-obsidian-900/[0.07]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-obsidian-900/[0.06] px-6 py-5">
        <h2 id={`${id}-heading`} className="text-xl text-obsidian-900">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Grid({ label, head, children }: { label: string; head: [string, boolean?][]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ocean-600" tabIndex={0} role="region" aria-label={label}>
      <table className="w-full min-w-[46rem] text-left text-base">
        <thead className="bg-obsidian-50/70 text-sm text-slate-600">
          <tr>
            {head.map(([h, right], i) => (
              <th key={`${h}-${i}`} scope="col" className={`px-6 py-3 font-normal ${right ? "text-right" : ""}`}>
                {h || <span className="sr-only">Action</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-obsidian-900/[0.06]">{children}</tbody>
      </table>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: (id: string) => ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm text-slate-700">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

const Empty = ({ text }: { text: string }) => <p className="px-6 py-12 text-center text-base text-slate-600">{text}</p>;

const partnerOptions = (partners: AdminPartner[], allLabel?: string) => [
  ...(allLabel ? [{ value: "", label: allLabel }] : []),
  ...partners.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` })),
];

// Partners: create and edit ---------------------------------------------------------------------

const TYPES = [
  { value: "HOTEL", label: "Hotel or host" },
  { value: "AGENT", label: "Travel agent" },
  { value: "CREATOR", label: "Creator or site" },
  { value: "OTHER", label: "Other" },
];

export function CreatePartnerForm({ onDone, notify }: { onDone: () => void; notify: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState("HOTEL");
  const [status, setStatus] = useState("ACTIVE");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const rate = f.rate.trim() ? Number(f.rate) / 100 : undefined;
    const { ok, data } = await call("", "POST", {
      name: f.name,
      contactName: f.contactName,
      email: f.email,
      password: f.password,
      type,
      status,
      website: f.website,
      phone: f.phone,
      ...(rate !== undefined ? { commissionRate: rate } : {}),
    });
    setBusy(false);
    if (!ok) return setError(errorOf(data, "Couldn't create the partner."));
    e.currentTarget.reset();
    notify(`${f.name} was added.`);
    onDone();
  }

  return (
    <Panel id="create-partner" title="Add a partner">
      <form onSubmit={submit} className="grid gap-4 px-6 py-6 md:grid-cols-3" noValidate>
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 md:col-span-3">
            {error}
          </p>
        )}
        <Field id="np-name" label="Business name">
          {(id) => <input id={id} name="name" required className={field} />}
        </Field>
        <Field id="np-contact" label="Contact name">
          {(id) => <input id={id} name="contactName" required autoComplete="name" className={field} />}
        </Field>
        <Field id="np-email" label="Sign-in email">
          {(id) => <input id={id} name="email" type="email" required autoComplete="off" className={field} />}
        </Field>
        <Field id="np-password" label="Temporary password (8+)">
          {(id) => <input id={id} name="password" type="password" required minLength={8} autoComplete="new-password" className={field} />}
        </Field>
        <Field id="np-phone" label="Phone (optional)">
          {(id) => <input id={id} name="phone" type="tel" className={field} />}
        </Field>
        <Field id="np-website" label="Website (optional)">
          {(id) => <input id={id} name="website" type="url" placeholder="https://" className={field} />}
        </Field>
        <Dropdown id="np-type" label="Type" value={type} onChange={setType} options={TYPES} />
        <Dropdown
          id="np-status"
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "ACTIVE", label: "Active now" },
            { value: "PENDING", label: "Pending review" },
          ]}
        />
        <Field id="np-rate" label="Fallback rate % (blank = 10)">
          {(id) => <input id={id} name="rate" type="number" min={0} max={50} step={0.5} className={field} />}
        </Field>
        <div className="md:col-span-3">
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? "Adding…" : "Add partner"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

export function EditPartnerForm({ partner, onDone, notify }: { partner: AdminPartner; onDone: () => void; notify: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const { ok, data } = await call(`/${partner.id}`, "PATCH", {
      name: f.name,
      commissionRate: Number(f.rate) / 100,
      phone: f.phone.trim() || null,
      payoutEmail: f.payoutEmail.trim() || null,
      website: f.website.trim() || null,
    });
    setBusy(false);
    if (!ok) return setError(errorOf(data, "Couldn't save the partner."));
    notify(`${f.name} was updated.`);
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 bg-obsidian-50/60 px-6 py-5 md:grid-cols-3" noValidate aria-label={`Edit ${partner.name}`}>
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 md:col-span-3">
          {error}
        </p>
      )}
      <Field id={`ep-name-${partner.id}`} label="Business name">
        {(id) => <input id={id} name="name" defaultValue={partner.name} required className={field} />}
      </Field>
      <Field id={`ep-rate-${partner.id}`} label="Fallback commission %">
        {(id) => <input id={id} name="rate" type="number" min={0} max={50} step={0.5} defaultValue={Math.round(partner.commissionRate * 1000) / 10} required className={field} />}
      </Field>
      <Field id={`ep-payout-${partner.id}`} label="Payout email">
        {(id) => <input id={id} name="payoutEmail" type="email" defaultValue={partner.payoutEmail ?? ""} className={field} />}
      </Field>
      <Field id={`ep-phone-${partner.id}`} label="Phone">
        {(id) => <input id={id} name="phone" type="tel" defaultValue={partner.phone ?? ""} className={field} />}
      </Field>
      <Field id={`ep-site-${partner.id}`} label="Website">
        {(id) => <input id={id} name="website" type="url" defaultValue={partner.website ?? ""} className={field} />}
      </Field>
      <p className="self-end text-sm text-slate-600">Commission rules, when set, take priority over the fallback rate. Rate changes never alter commission already earned.</p>
      <div className="md:col-span-3">
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

// Commission rules ------------------------------------------------------------------------------

const CATEGORIES = ["SHARED", "PRIVATE", "SHUTTLE", "MULTIDAY", "TICKET"];

export function RulesPanel({ partners, notify }: { partners: AdminPartner[]; notify: (m: string) => void }) {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [tours, setTours] = useState<{ slug: string; title: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [affiliateId, setAffiliateId] = useState("");
  const [scope, setScope] = useState("ALL"); // ALL | TOUR | CATEGORY
  const [tourSlug, setTourSlug] = useState("");
  const [category, setCategory] = useState("SHARED");
  const [kind, setKind] = useState("percent");

  const load = useCallback(async () => {
    const { ok, data } = await call("/rules");
    if (ok) setRules(data.rules as Rule[]);
    else setError("Couldn't load rules.");
  }, []);

  useEffect(() => {
    void load();
    fetch("/api/tours")
      .then((r) => r.json())
      .then((d) =>
        setTours(
          (d.tours ?? []).map((t: { slug: string; title: string }) => ({
            slug: t.slug,
            title: t.title,
          })),
        ),
      )
      .catch(() => setTours([]));
  }, [load]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const value = Number(f.value);
    const { ok, data } = await call("/rules", "POST", {
      name: f.name,
      affiliateId: affiliateId || null,
      tourSlug: scope === "TOUR" ? tourSlug || null : null,
      category: scope === "CATEGORY" ? category : null,
      ...(kind === "percent" ? { percent: value } : { fixedAmount: value }),
      ...(f.validFrom ? { validFrom: f.validFrom } : {}),
      validTo: f.validTo || null,
    });
    setBusy(false);
    if (!ok) return setError(errorOf(data, "Couldn't create the rule."));
    e.currentTarget.reset();
    notify(`Rule "${f.name}" created.`);
    void load();
  }

  async function toggle(rule: Rule) {
    const { ok } = await call(`/rules/${rule.id}`, "PATCH", {
      active: !rule.active,
    });
    notify(ok ? `Rule "${rule.name}" ${rule.active ? "turned off" : "turned on"}.` : "Couldn't update the rule.");
    void load();
  }

  return (
    <div className="space-y-6">
      <Panel id="new-rule" title="New commission rule">
        <form onSubmit={create} className="grid gap-4 px-6 py-6 md:grid-cols-3" noValidate>
          {error && (
            <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 md:col-span-3">
              {error}
            </p>
          )}
          <p className="text-sm text-slate-600 md:col-span-3">
            The most specific active rule wins: partner + tour, partner + category, partner, then all partners in the same order. Without a rule, the partner&apos;s fallback rate
            applies. A rule applies to bookings paid while it&apos;s active; earned commission is never recalculated.
          </p>
          <Field id="rule-name" label="Rule name">
            {(id) => <input id={id} name="name" required className={field} placeholder="Hotels summer 2027" />}
          </Field>
          <Dropdown
            id="rule-partner"
            label="Partner"
            value={affiliateId}
            onChange={setAffiliateId}
            searchable={partners.length > 8}
            options={partnerOptions(partners, "All partners")}
          />
          <Dropdown
            id="rule-scope"
            label="Applies to"
            value={scope}
            onChange={setScope}
            options={[
              { value: "ALL", label: "Every tour" },
              { value: "TOUR", label: "One tour" },
              { value: "CATEGORY", label: "A category" },
            ]}
          />
          {scope === "TOUR" && (
            <Dropdown
              id="rule-tour"
              label="Tour"
              value={tourSlug}
              onChange={setTourSlug}
              searchable
              options={[{ value: "", label: "Choose a tour" }, ...tours.map((t) => ({ value: t.slug, label: t.title }))]}
            />
          )}
          {scope === "CATEGORY" && (
            <Dropdown id="rule-category" label="Category" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: words(c) }))} />
          )}
          <Dropdown
            id="rule-kind"
            label="Commission type"
            value={kind}
            onChange={setKind}
            options={[
              { value: "percent", label: "Percentage of amount paid" },
              { value: "fixed", label: "Fixed amount per booking (CAD)" },
            ]}
          />
          <Field id="rule-value" label={kind === "percent" ? "Percent" : "Amount (CAD)"}>
            {(id) => <input id={id} name="value" type="number" min={0} max={kind === "percent" ? 100 : 100000} step={0.01} required className={field} />}
          </Field>
          <Field id="rule-from" label="Valid from (optional)">
            {(id) => <input id={id} name="validFrom" type="date" className={field} />}
          </Field>
          <Field id="rule-to" label="Valid until (optional)">
            {(id) => <input id={id} name="validTo" type="date" className={field} />}
          </Field>
          <div className="md:col-span-3">
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? "Saving…" : "Create rule"}
            </button>
          </div>
        </form>
      </Panel>

      <Panel id="rules" title="Rules">
        {!rules ? (
          <Empty text="Loading…" />
        ) : rules.length === 0 ? (
          <Empty text="No rules yet. Every partner earns their fallback rate." />
        ) : (
          <Grid label="Commission rules" head={[["Rule"], ["Partner"], ["Applies to"], ["Commission", true], ["Valid"], ["Status"], [""]]}>
            {rules.map((r) => (
              <tr key={r.id}>
                <td className="px-6 py-4">{r.name}</td>
                <td className="px-6 py-4 text-sm">{r.partner ?? "All partners"}</td>
                <td className="px-6 py-4 text-sm">{r.tour ?? (r.category ? words(r.category) : "Every tour")}</td>
                <td className="px-6 py-4 text-right tabular-nums">{r.percent !== null ? `${r.percent}%` : money(r.fixedAmount ?? 0)}</td>
                <td className="px-6 py-4 text-sm">
                  {day(r.validFrom)} to {r.validTo ? day(r.validTo) : "open"}
                </td>
                <td className="px-6 py-4 text-sm">{r.active ? "On" : "Off"}</td>
                <td className="px-6 py-4 text-right">
                  <button type="button" onClick={() => toggle(r)} className={quietBtn}>
                    {r.active ? "Turn off" : "Turn on"} <span className="sr-only">{r.name}</span>
                  </button>
                </td>
              </tr>
            ))}
          </Grid>
        )}
      </Panel>
    </div>
  );
}

// Commission ledger -----------------------------------------------------------------------------

const LINE_LABEL: Record<Line["type"], string> = {
  EARNED: "Earned",
  REVERSAL: "Refund reversal",
  ADJUSTMENT: "Adjustment",
};

export function CommissionsPanel({ partners, notify, onChange }: { partners: AdminPartner[]; notify: (m: string) => void; onChange: () => void }) {
  const [affiliateId, setAffiliateId] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ total: number; lines: Line[] } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [adjustPartner, setAdjustPartner] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const q = new URLSearchParams({
      page: String(page),
      pageSize: "50",
      ...(status ? { status } : {}),
      ...(affiliateId ? { affiliateId } : {}),
    });
    const { ok, data } = await call(`/commissions?${q}`);
    if (ok) setResult({ total: data.total as number, lines: data.lines as Line[] });
    else setError("Couldn't load commission lines.");
    setSelected(new Set());
  }, [page, status, affiliateId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve() {
    setBusy(true);
    const { ok, data } = await call("/commissions/approve", "POST", {
      ids: Array.from(selected),
    });
    setBusy(false);
    notify(ok ? `${String(data.approved ?? 0)} line(s) approved.` : "Couldn't approve those lines.");
    void load();
    onChange();
  }

  async function adjust(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (!adjustPartner) return setError("Choose a partner for the adjustment.");
    setBusy(true);
    const { ok, data } = await call("/commissions/adjust", "POST", {
      affiliateId: adjustPartner,
      amount: Number(f.amount),
      reason: f.reason,
      ...(f.bookingReference.trim() ? { bookingReference: f.bookingReference.trim() } : {}),
    });
    setBusy(false);
    if (!ok) return setError(errorOf(data, "Couldn't record the adjustment."));
    e.currentTarget.reset();
    notify("Adjustment recorded. It's approved and goes into the partner's next payout.");
    void load();
    onChange();
  }

  const pendingIds = (result?.lines ?? []).filter((l) => l.status === "PENDING").map((l) => l.id);
  const pages = Math.max(1, Math.ceil((result?.total ?? 0) / 50));

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
          {error}
        </p>
      )}
      <Panel
        id="ledger"
        title="Commission ledger"
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-64">
              <Dropdown
                id="ledger-partner"
                label="Partner"
                value={affiliateId}
                searchable={partners.length > 8}
                onChange={(v) => {
                  setAffiliateId(v);
                  setPage(1);
                }}
                options={partnerOptions(partners, "All partners")}
              />
            </div>
            <div className="w-48">
              <Dropdown
                id="ledger-status"
                label="Status"
                value={status}
                onChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All" },
                  ...["PENDING", "APPROVED", "PAID"].map((s) => ({
                    value: s,
                    label: words(s),
                  })),
                ]}
              />
            </div>
            <button type="button" disabled={busy || selected.size === 0} onClick={approve} className={primaryBtn}>
              Approve selected ({selected.size})
            </button>
          </div>
        }
      >
        <p className="px-6 pt-4 text-sm text-slate-600">
          Earned lines are approved automatically the day after the tour runs. Approve early only when you&apos;re sure the booking won&apos;t be refunded.
        </p>
        {!result ? (
          <Empty text="Loading…" />
        ) : result.lines.length === 0 ? (
          <Empty text="No commission lines match." />
        ) : (
          <Grid label="Commission lines" head={[["Select"], ["Date"], ["Booking"], ["Line"], ["Status"], ["Basis", true], ["Amount", true]]}>
            {result.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-6 py-4">
                  {l.status === "PENDING" && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${l.bookingReference ?? l.reason ?? "line"}`}
                      checked={selected.has(l.id)}
                      onChange={(e) =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (e.target.checked) next.add(l.id);
                          else next.delete(l.id);
                          return next;
                        })
                      }
                      className="h-5 w-5"
                    />
                  )}
                </td>
                <td className="px-6 py-4 text-sm">{day(l.createdAt)}</td>
                <td className="px-6 py-4">
                  <span className="block font-mono text-sm">{l.bookingReference ?? "–"}</span>
                  <span className="block text-sm text-slate-600">{l.experience ? `${l.experience} · ${day(l.tourDate)}` : l.reason}</span>
                </td>
                <td className="px-6 py-4 text-sm">{LINE_LABEL[l.type]}</td>
                <td className="px-6 py-4 text-sm">
                  {words(l.status)}
                  {l.payoutId && l.status !== "PAID" ? " · in a draft payout" : ""}
                </td>
                <td className="px-6 py-4 text-right tabular-nums">{l.basis ? money(l.basis) : "–"}</td>
                <td className={`px-6 py-4 text-right tabular-nums ${l.amount < 0 ? "text-red-700" : ""}`}>{money(l.amount)}</td>
              </tr>
            ))}
          </Grid>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm">
          <button type="button" className={quietBtn} disabled={pendingIds.length === 0} onClick={() => setSelected(new Set(pendingIds))}>
            Select all pending on this page
          </button>
          {pages > 1 && (
            <span className="flex items-center gap-3">
              <button type="button" className={quietBtn} disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              Page {page} of {pages}
              <button type="button" className={quietBtn} disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </button>
            </span>
          )}
        </div>
      </Panel>

      <Panel id="adjust" title="Manual adjustment">
        <form onSubmit={adjust} className="grid gap-4 px-6 py-6 md:grid-cols-4" noValidate>
          <Dropdown
            id="adj-partner"
            label="Partner"
            value={adjustPartner}
            onChange={setAdjustPartner}
            searchable={partners.length > 8}
            options={partnerOptions(partners, "Choose a partner")}
          />
          <Field id="adj-amount" label="Amount CAD (negative to deduct)">
            {(id) => <input id={id} name="amount" type="number" step={0.01} required className={field} />}
          </Field>
          <Field id="adj-booking" label="Booking reference (optional)">
            {(id) => <input id={id} name="bookingReference" className={field} />}
          </Field>
          <Field id="adj-reason" label="Reason (kept in the audit log)">
            {(id) => <input id={id} name="reason" required minLength={5} className={field} />}
          </Field>
          <div className="md:col-span-4">
            <button type="submit" disabled={busy} className={primaryBtn}>
              Record adjustment
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

// Payouts ---------------------------------------------------------------------------------------

export function PayoutsPanel({ partners, notify, onChange }: { partners: AdminPartner[]; notify: (m: string) => void; onChange: () => void }) {
  const [payouts, setPayouts] = useState<Payout[] | null>(null);
  const [affiliateId, setAffiliateId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { ok, data } = await call("/payouts");
    if (ok) setPayouts(data.payouts as Payout[]);
    else setError("Couldn't load payouts.");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const payable = partners.filter((p) => p.commission.approved > 0);

  async function draft(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!affiliateId) return setError("Choose a partner to pay.");
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    const { ok, data } = await call("/payouts", "POST", {
      affiliateId,
      ...(f.method.trim() ? { method: f.method.trim() } : {}),
    });
    setBusy(false);
    if (!ok) return setError(errorOf(data, "Couldn't draft the payout."));
    notify("Payout drafted. Send the money, then mark it paid with the transfer reference.");
    setAffiliateId("");
    void load();
    onChange();
  }

  async function markPaid(e: FormEvent<HTMLFormElement>, p: Payout) {
    e.preventDefault();
    const reference = String(new FormData(e.currentTarget).get("reference") ?? "").trim();
    setBusy(true);
    const { ok, data } = await call(`/payouts/${p.id}/mark-paid`, "POST", {
      reference,
    });
    setBusy(false);
    if (!ok) return setError(errorOf(data, "Couldn't mark the payout paid."));
    setPaying(null);
    notify(`Payout to ${p.partner} marked paid.`);
    void load();
    onChange();
  }

  async function cancel(p: Payout) {
    setBusy(true);
    const { ok } = await call(`/payouts/${p.id}/cancel`, "POST", {});
    setBusy(false);
    notify(ok ? `Draft payout to ${p.partner} cancelled; its lines are payable again.` : "Couldn't cancel the payout.");
    void load();
    onChange();
  }

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
          {error}
        </p>
      )}
      <Panel id="draft-payout" title="Draft a payout">
        <form onSubmit={draft} className="grid gap-4 px-6 py-6 md:grid-cols-3" noValidate>
          <p className="text-sm text-slate-600 md:col-span-3">
            A payout collects the partner&apos;s approved, unpaid commission. Nothing is sent from here: pay the partner by bank transfer, e-Transfer or PayPal, then mark the
            payout paid with the reference.
          </p>
          <Dropdown
            id="payout-partner"
            label="Partner with approved commission"
            value={affiliateId}
            onChange={setAffiliateId}
            options={[
              {
                value: "",
                label: payable.length ? "Choose a partner" : "Nothing approved yet",
              },
              ...payable.map((p) => ({
                value: p.id,
                label: `${p.name}: ${money(p.commission.approved)}`,
              })),
            ]}
          />
          <Field id="payout-method" label="Method (optional)">
            {(id) => <input id={id} name="method" className={field} placeholder="Interac e-Transfer" />}
          </Field>
          <div className="self-end">
            <button type="submit" disabled={busy || !affiliateId} className={primaryBtn}>
              Draft payout
            </button>
          </div>
        </form>
      </Panel>

      <Panel id="payouts" title="Payouts">
        {!payouts ? (
          <Empty text="Loading…" />
        ) : payouts.length === 0 ? (
          <Empty text="No payouts yet." />
        ) : (
          <Grid label="Payouts" head={[["Partner"], ["Created"], ["Lines", true], ["Amount", true], ["Status"], ["Reference"], [""]]}>
            {payouts.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="px-6 py-4">
                  <span className="block">{p.partner}</span>
                  <span className="block text-sm text-slate-600">{p.payoutEmail ?? "No payout email on file"}</span>
                </td>
                <td className="px-6 py-4 text-sm">{day(p.createdAt)}</td>
                <td className="px-6 py-4 text-right tabular-nums">{p.lines}</td>
                <td className="px-6 py-4 text-right tabular-nums">
                  {money(p.amount)} {p.currency}
                </td>
                <td className="px-6 py-4 text-sm">
                  {p.status === "PAID" ? `Paid ${day(p.paidAt)}` : words(p.status)}
                  {p.method ? ` · ${p.method}` : ""}
                </td>
                <td className="px-6 py-4 font-mono text-sm">{p.reference ?? "–"}</td>
                <td className="px-6 py-4 text-right">
                  {p.status === "DRAFT" &&
                    (paying === p.id ? (
                      <form onSubmit={(e) => markPaid(e, p)} className="flex flex-wrap justify-end gap-2">
                        <label htmlFor={`ref-${p.id}`} className="sr-only">
                          Transfer reference for {p.partner}
                        </label>
                        <input
                          id={`ref-${p.id}`}
                          name="reference"
                          required
                          minLength={2}
                          placeholder="Transfer reference"
                          className="h-10 w-48 rounded-full border border-slate-300 px-4 text-sm"
                        />
                        <button type="submit" disabled={busy} className={primaryBtn}>
                          Confirm paid
                        </button>
                        <button type="button" onClick={() => setPaying(null)} className={quietBtn}>
                          Back
                        </button>
                      </form>
                    ) : (
                      <span className="flex justify-end gap-2">
                        <button type="button" onClick={() => setPaying(p.id)} className={primaryBtn}>
                          Mark paid <span className="sr-only">for {p.partner}</span>
                        </button>
                        <button type="button" disabled={busy} onClick={() => cancel(p)} className={quietBtn}>
                          Cancel <span className="sr-only">payout for {p.partner}</span>
                        </button>
                      </span>
                    ))}
                </td>
              </tr>
            ))}
          </Grid>
        )}
      </Panel>
    </div>
  );
}

// Report ----------------------------------------------------------------------------------------

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function ReportPanel() {
  const now = new Date();
  const [from, setFrom] = useState(isoDay(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(isoDay(now));
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [error, setError] = useState("");

  const query = `from=${from}T00:00:00.000Z&to=${to}T23:59:59.999Z`;

  const load = useCallback(async () => {
    setError("");
    const { ok, data } = await call(`/report?${query}`);
    if (ok) setRows(data.rows as ReportRow[]);
    else setError(errorOf(data, "Couldn't build the report."));
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const sum = (k: keyof ReportRow) => (rows ?? []).reduce((s, r) => s + (Number(r[k]) || 0), 0);

  return (
    <Panel
      id="report"
      title="Partner report"
      actions={
        <div className="flex flex-wrap items-end gap-3">
          <Field id="report-from" label="From">
            {(id) => <input id={id} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-11 rounded-xl border border-slate-300 px-3 text-sm" />}
          </Field>
          <Field id="report-to" label="To">
            {(id) => <input id={id} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-11 rounded-xl border border-slate-300 px-3 text-sm" />}
          </Field>
          <a href={`/api/affiliates/admin/report?${query}&format=csv`} className={`${quietBtn} h-11 gap-2`}>
            <Download className="h-4 w-4" aria-hidden="true" /> Download CSV
          </a>
        </div>
      }
    >
      {error && (
        <p role="alert" className="mx-6 mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {!rows ? (
        <Empty text="Loading…" />
      ) : rows.length === 0 ? (
        <Empty text="No partners yet." />
      ) : (
        <Grid
          label="Partner report"
          head={[
            ["Partner"],
            ["Clicks", true],
            ["Bookings", true],
            ["Paid", true],
            ["Guests", true],
            ["Sales", true],
            ["Earned", true],
            ["Reversed", true],
            ["Net", true],
            ["Conversion", true],
          ]}
        >
          {rows.map((r) => (
            <tr key={r.affiliateId}>
              <td className="px-6 py-4">
                {r.partner} <span className="font-mono text-sm text-slate-600">{r.code}</span>
              </td>
              <td className="px-6 py-4 text-right tabular-nums">{r.clicks}</td>
              <td className="px-6 py-4 text-right tabular-nums">{r.bookings}</td>
              <td className="px-6 py-4 text-right tabular-nums">{r.paidBookings}</td>
              <td className="px-6 py-4 text-right tabular-nums">{r.guests}</td>
              <td className="px-6 py-4 text-right tabular-nums">{money(r.sales)}</td>
              <td className="px-6 py-4 text-right tabular-nums">{money(r.commissionEarned)}</td>
              <td className="px-6 py-4 text-right tabular-nums">{money(r.commissionReversed)}</td>
              <td className="px-6 py-4 text-right tabular-nums">{money(r.commissionNet)}</td>
              <td className="px-6 py-4 text-right tabular-nums">{r.conversion === null ? "–" : `${r.conversion}%`}</td>
            </tr>
          ))}
          <tr className="bg-obsidian-50/70">
            <th scope="row" className="px-6 py-4 text-left font-normal">
              Total
            </th>
            <td className="px-6 py-4 text-right tabular-nums">{sum("clicks")}</td>
            <td className="px-6 py-4 text-right tabular-nums">{sum("bookings")}</td>
            <td className="px-6 py-4 text-right tabular-nums">{sum("paidBookings")}</td>
            <td className="px-6 py-4 text-right tabular-nums">{sum("guests")}</td>
            <td className="px-6 py-4 text-right tabular-nums">{money(sum("sales"))}</td>
            <td className="px-6 py-4 text-right tabular-nums">{money(sum("commissionEarned"))}</td>
            <td className="px-6 py-4 text-right tabular-nums">{money(sum("commissionReversed"))}</td>
            <td className="px-6 py-4 text-right tabular-nums">{money(sum("commissionNet"))}</td>
            <td className="px-6 py-4" />
          </tr>
        </Grid>
      )}
    </Panel>
  );
}
