"use client";

// Admin → Security (owner, 2026-11-15): every enquiry, signup, partner application and chat start
// with the sender's IP and the place looked up from it, whether it went through or was caught as
// spam, and one-click Block for an IP or email. Blocked senders can't send forms, sign up, chat or
// book; staff sign-in is never blocked. Every block and unblock is in the audit log.

import { useCallback, useEffect, useRef, useState } from "react";
import { Ban, ShieldCheck } from "lucide-react";
import { Dropdown } from "@/components/forms/Dropdown";
import { Chip, Empty, Grid, Loading, Panel, Stat, adminApi, dangerBtn, errorOf, field, isDenied, labelCls, primaryBtn, quietBtn, when } from "@/components/admin/staff/shared";

interface SecurityEvent {
  id: string;
  createdAt: string;
  form: string;
  outcome: "ACCEPTED" | "SPAM" | "REFUSED" | "BLOCKED";
  reason: string | null;
  ip: string;
  city: string | null;
  region: string | null;
  country: string | null;
  email: string | null;
  name: string | null;
  userAgent: string | null;
  ipBlockId: string | null;
  emailBlockId: string | null;
}

interface TopIp {
  ip: string;
  count: number;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  ipBlockId: string | null;
}

interface EventsResponse {
  events: SecurityEvent[];
  next: string | null;
  topIps: TopIp[];
  last7Days: Record<string, number>;
  yourIp: string;
}

interface Blocked {
  id: string;
  kind: "IP" | "EMAIL";
  value: string;
  reason: string | null;
  createdAt: string;
  createdBy: string | null;
}

const FORM_LABEL: Record<string, string> = {
  ENQUIRY: "Enquiry",
  SIGNUP: "Account signup",
  PARTNER_APPLY: "Partner application",
  BANFF_ELITE: "Banff Elite enquiry",
  CHAT: "Concierge chat",
  LIVE_CHAT: "Live chat",
  CHAT_HANDOFF: "Chat → support",
  BLOCKED_REQUEST: "Blocked request",
};

const OUTCOME: Record<string, { label: string; cls: string }> = {
  ACCEPTED: { label: "Went through", cls: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" },
  SPAM: { label: "Spam, dropped", cls: "bg-red-50 text-red-800 ring-1 ring-red-200" },
  REFUSED: { label: "Refused", cls: "bg-amber-50 text-amber-900 ring-1 ring-amber-200" },
  BLOCKED: { label: "Blocked", cls: "bg-obsidian-900 text-white" },
};

const place = (p: { city?: string | null; region?: string | null; country?: string | null }) =>
  [p.city, p.region, p.country].filter(Boolean).join(", ") || "Unknown";

export function SecurityPanel({ onDenied }: { onDenied: () => void }) {
  const [data, setData] = useState<EventsResponse | null>(null);
  const [events, setEvents] = useState<SecurityEvent[] | null>(null);
  const [blocked, setBlocked] = useState<Blocked[] | null>(null);
  const [outcome, setOutcome] = useState("FLAGGED");
  const [form, setForm] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [more, setMore] = useState(false);
  const [manualKind, setManualKind] = useState<"IP" | "EMAIL">("IP");
  const [manualValue, setManualValue] = useState("");
  const [manualReason, setManualReason] = useState("");
  const request = useRef(0);

  const params = useCallback(() => {
    const p = new URLSearchParams();
    if (outcome) p.set("outcome", outcome);
    if (form) p.set("form", form);
    if (q.trim()) p.set("q", q.trim());
    return p;
  }, [outcome, form, q]);

  const load = useCallback(async () => {
    const id = ++request.current;
    const [ev, bl] = await Promise.all([adminApi<EventsResponse>(`/security/events?${params()}`), adminApi<{ blocked: Blocked[] }>("/security/blocked")]);
    if (id !== request.current) return;
    if (isDenied(ev.status) || isDenied(bl.status)) return onDenied();
    if (!ev.ok) return setError(errorOf(ev.data, "Couldn't load the security log."));
    setError("");
    setData(ev.data);
    setEvents(ev.data.events);
    if (bl.ok) setBlocked(bl.data.blocked);
  }, [params, onDenied]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  async function loadMore() {
    if (!data?.next) return;
    const id = request.current;
    setMore(true);
    const p = params();
    p.set("before", data.next);
    const res = await adminApi<EventsResponse>(`/security/events?${p}`);
    setMore(false);
    if (id !== request.current) return;
    if (!res.ok) return setError(errorOf(res.data, "Couldn't load older entries."));
    setEvents((e) => [...(e ?? []), ...res.data.events]);
    setData((d) => (d ? { ...d, next: res.data.next } : d));
  }

  async function block(kind: "IP" | "EMAIL", value: string, reason?: string) {
    setBusy(`${kind}:${value}`);
    setNotice("");
    const res = await adminApi<{ blocked: Blocked }>("/security/blocked", "POST", { kind, value, reason: reason || "Blocked from the security log" });
    setBusy("");
    if (!res.ok) return setError(errorOf(res.data, "Couldn't block that."));
    setError("");
    setNotice(`${kind === "IP" ? "IP" : "Email"} ${value} is blocked.`);
    await load();
    return true;
  }

  async function unblock(id: string, value: string) {
    setBusy(id);
    setNotice("");
    const res = await adminApi(`/security/blocked/${id}`, "DELETE");
    setBusy("");
    if (!res.ok) return setError(errorOf(res.data, "Couldn't unblock that."));
    setError("");
    setNotice(`${value} is unblocked.`);
    await load();
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualValue.trim()) return;
    if (await block(manualKind, manualValue.trim(), manualReason.trim())) {
      setManualValue("");
      setManualReason("");
    }
  }

  const stats = data?.last7Days ?? {};

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Went through (7 days)" value={stats.ACCEPTED ?? 0} tone="good" />
        <Stat label="Spam dropped (7 days)" value={stats.SPAM ?? 0} tone={(stats.SPAM ?? 0) > 0 ? "bad" : undefined} />
        <Stat label="Refused (7 days)" value={stats.REFUSED ?? 0} />
        <Stat label="Blocked senders" value={blocked?.length ?? 0} hint={data?.yourIp ? `Your IP: ${data.yourIp}` : undefined} />
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-2xl bg-emerald-50 px-5 py-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
          {notice}
        </p>
      )}

      {data && data.topIps.length > 0 && (
        <Panel id="security-top" title="Most flagged IPs, last 7 days" description="IPs whose forms were caught as spam, refused or blocked most often.">
          <Grid label="Most flagged IPs" minWidth="min-w-[40rem]" head={[["IP"], ["Place"], ["Flagged", true], ["Actions", true]]}>
            {data.topIps.map((t) => (
              <tr key={t.ip} className="hover:bg-obsidian-50/60">
                <td className="px-6 py-3 font-mono text-sm">{t.ip}</td>
                <td className="px-6 py-3 text-sm">{place(t)}</td>
                <td className="px-6 py-3 text-right text-sm tabular-nums">{t.count}</td>
                <td className="px-6 py-3 text-right">
                  {t.ipBlockId ? (
                    <button type="button" className={quietBtn} disabled={busy === t.ipBlockId} onClick={() => unblock(t.ipBlockId!, t.ip)}>
                      Unblock
                    </button>
                  ) : (
                    <button type="button" className={dangerBtn} disabled={busy === `IP:${t.ip}`} onClick={() => block("IP", t.ip, `Flagged ${t.count} times in 7 days`)}>
                      <Ban className="h-4 w-4" aria-hidden="true" /> Block IP
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Grid>
        </Panel>
      )}

      <Panel id="security-log" title="Form senders" description="Newest first. Times are Mountain Time. Places are looked up from the IP, so they're approximate (city level).">
        <div className="grid gap-3 border-b border-obsidian-900/[0.06] px-6 py-4 sm:grid-cols-3">
          <Dropdown
            id="security-outcome"
            label="Result"
            value={outcome}
            onChange={setOutcome}
            options={[
              { value: "FLAGGED", label: "Spam, refused or blocked" },
              { value: "", label: "Everything" },
              { value: "ACCEPTED", label: "Went through" },
              { value: "SPAM", label: "Spam, dropped" },
              { value: "REFUSED", label: "Refused" },
              { value: "BLOCKED", label: "Blocked" },
            ]}
          />
          <Dropdown
            id="security-form"
            label="Form"
            value={form}
            onChange={setForm}
            options={[{ value: "", label: "All forms" }, ...Object.entries(FORM_LABEL).map(([value, label]) => ({ value, label }))]}
          />
          <div>
            <label htmlFor="security-q" className={labelCls}>
              Search
            </label>
            <input id="security-q" type="search" className={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Exact IP, email, city or country" />
          </div>
        </div>

        {!events ? (
          <Loading />
        ) : events.length === 0 ? (
          <Empty>No form senders match these filters.</Empty>
        ) : (
          <>
            <Grid label="Form senders" minWidth="min-w-[72rem]" head={[["Time"], ["Form"], ["Result"], ["IP and place"], ["Sender"], ["Actions", true]]}>
              {events.map((e) => (
                <tr key={e.id} className="align-top hover:bg-obsidian-50/60">
                  <td className="whitespace-nowrap px-6 py-4 text-sm">{when(e.createdAt)}</td>
                  <td className="px-6 py-4 text-sm">{FORM_LABEL[e.form] ?? e.form}</td>
                  <td className="px-6 py-4 text-sm">
                    <Chip className={OUTCOME[e.outcome]?.cls ?? ""}>{OUTCOME[e.outcome]?.label ?? e.outcome}</Chip>
                    {e.reason && <span className="mt-1 block max-w-[14rem] text-slate-600">{e.reason}</span>}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button type="button" className="font-mono text-ocean-700 hover:underline" onClick={() => setQ(e.ip)} title="Show everything from this IP">
                      {e.ip}
                    </button>
                    <span className="block text-slate-600">{place(e)}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {e.name && <span className="block break-words text-obsidian-900">{e.name}</span>}
                    {e.email && <span className="block break-all text-slate-600">{e.email}</span>}
                    {!e.name && !e.email && <span className="text-slate-600">–</span>}
                    {e.userAgent && (
                      <span className="mt-1 block max-w-[18rem] truncate text-xs text-slate-500" title={e.userAgent}>
                        {e.userAgent}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end gap-2">
                      {e.ipBlockId ? (
                        <button type="button" className={quietBtn} disabled={busy === e.ipBlockId} onClick={() => unblock(e.ipBlockId!, e.ip)}>
                          Unblock IP
                        </button>
                      ) : (
                        <button type="button" className={dangerBtn} disabled={busy === `IP:${e.ip}`} onClick={() => block("IP", e.ip, e.reason ?? undefined)}>
                          <Ban className="h-4 w-4" aria-hidden="true" /> Block IP
                        </button>
                      )}
                      {e.email &&
                        (e.emailBlockId ? (
                          <button type="button" className={quietBtn} disabled={busy === e.emailBlockId} onClick={() => unblock(e.emailBlockId!, e.email!)}>
                            Unblock email
                          </button>
                        ) : (
                          <button type="button" className={dangerBtn} disabled={busy === `EMAIL:${e.email}`} onClick={() => block("EMAIL", e.email!, e.reason ?? undefined)}>
                            <Ban className="h-4 w-4" aria-hidden="true" /> Block email
                          </button>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </Grid>
            <div className="flex items-center justify-between gap-4 border-t border-obsidian-900/[0.06] px-6 py-4">
              <p className="text-sm text-slate-600">
                Showing {events.length} {events.length === 1 ? "entry" : "entries"}
                {data?.next ? "" : ", all that match"}
              </p>
              {data?.next && (
                <button type="button" className={quietBtn} onClick={loadMore} disabled={more}>
                  {more ? "Loading…" : "Load more"}
                </button>
              )}
            </div>
          </>
        )}
      </Panel>

      <Panel
        id="security-blocked"
        title="Blocked senders"
        description="A blocked IP or email can't send enquiries, sign up, apply as a partner, chat or book. Staff sign-in and the admin area are never blocked."
      >
        <form onSubmit={addManual} className="grid gap-3 border-b border-obsidian-900/[0.06] px-6 py-4 sm:grid-cols-[12rem_1fr_1fr_auto] sm:items-end">
          <Dropdown
            id="security-kind"
            label="Block"
            value={manualKind}
            onChange={(v) => setManualKind(v as "IP" | "EMAIL")}
            options={[
              { value: "IP", label: "IP address" },
              { value: "EMAIL", label: "Email address" },
            ]}
          />
          <div>
            <label htmlFor="security-value" className={labelCls}>
              {manualKind === "IP" ? "IP address" : "Email address"}
            </label>
            <input
              id="security-value"
              className={field}
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder={manualKind === "IP" ? "e.g. 203.0.113.7" : "e.g. spam@example.com"}
              autoComplete="off"
              maxLength={200}
            />
          </div>
          <div>
            <label htmlFor="security-reason" className={labelCls}>
              Reason (optional)
            </label>
            <input id="security-reason" className={field} value={manualReason} onChange={(e) => setManualReason(e.target.value)} maxLength={200} />
          </div>
          <button type="submit" className={primaryBtn} disabled={!manualValue.trim() || busy !== ""}>
            <Ban className="h-4 w-4" aria-hidden="true" /> Block
          </button>
        </form>
        {!blocked ? (
          <Loading />
        ) : blocked.length === 0 ? (
          <Empty>
            <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-slate-500" aria-hidden="true" />
            Nobody is blocked.
          </Empty>
        ) : (
          <Grid label="Blocked senders" minWidth="min-w-[48rem]" head={[["Blocked"], ["Type"], ["Reason"], ["When, by whom"], ["Actions", true]]}>
            {blocked.map((b) => (
              <tr key={b.id} className="hover:bg-obsidian-50/60">
                <td className="px-6 py-3 break-all font-mono text-sm">{b.value}</td>
                <td className="px-6 py-3 text-sm">{b.kind === "IP" ? "IP" : "Email"}</td>
                <td className="px-6 py-3 text-sm">{b.reason || "–"}</td>
                <td className="px-6 py-3 text-sm">
                  {when(b.createdAt)}
                  {b.createdBy && <span className="block text-slate-600">{b.createdBy}</span>}
                </td>
                <td className="px-6 py-3 text-right">
                  <button type="button" className={quietBtn} disabled={busy === b.id} onClick={() => unblock(b.id, b.value)}>
                    Unblock
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
