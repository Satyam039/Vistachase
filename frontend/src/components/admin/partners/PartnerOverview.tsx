"use client";

// Admin → Partners → one partner (owner, 2026-11-26: "click a partner like Ravinder Singh and see all
// their information: bank details, coupons, everything, like a dashboard"). One page with the
// partner's totals, profile, application and bank details (bank shown only on request, audited),
// commission and agreements, coupons, referred bookings, change requests and payouts.
// Data: GET /api/affiliates/admin/:id/overview (admins only).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";
import { Chip, Empty, Grid, Loading, Panel, Stat, quietBtn, primaryBtn } from "@/components/admin/staff/shared";
import { BOOKING_STATUS_STYLE } from "@/components/admin/staff/shared";
import { PartnerApplicationDetails, type AdminPartner } from "@/components/admin/partners/PartnerAdminPanels";
import { PartnerContractDialog } from "@/components/admin/partners/PartnerContractDialog";

interface Overview {
  partner: {
    id: string;
    name: string;
    contactName: string;
    email: string;
    phone: string | null;
    website: string | null;
    payoutEmail: string | null;
    code: string;
    type: string;
    status: AdminPartner["status"];
    commissionRate: number;
    commissionSetAt: string | null;
    bokunChannelId: string | null;
    createdAt: string;
    hasBankDetails: boolean;
  };
  totals: { bookings: number; paidBookings: number; guests: number; revenue: number; commission: number; pending: number; approved: number; paid: number; reversed: number; clicks30d: number; clicksAll: number };
  bookings: { id: string; reference: string; experience: string; date: string; guests: number; total: number; commission: number; status: string; bookedAt: string; guestName: string; promoCode: string | null }[];
  coupons: { id: string; code: string; label: string; startsOn: string | null; endsOn: string | null; appliesTo: string[]; uses: number; paidBookings: number; state: string }[];
  contracts: { version: number; commissionPercent: number; products: string[]; sentTo: string | null; sentAt: string | null }[];
  rules: { id: string; name: string; percent: number | null; fixedAmount: number | null; category: string | null; tour: string | null }[];
  requests: { id: string; category: string; subject: string; status: string; createdAt: string; staffNote: string | null }[];
  payouts: { id: string; amount: number; currency: string; status: string; method: string | null; reference: string | null; paidAt: string | null; createdAt: string }[];
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-summit-100 text-obsidian-900",
  ACTIVE: "bg-ocean-50 text-ocean-800",
  SUSPENDED: "bg-red-50 text-red-800",
  REJECTED: "bg-obsidian-100 text-slate-700",
};
const REQUEST_STYLE: Record<string, string> = {
  OPEN: "bg-summit-100 text-obsidian-900",
  IN_PROGRESS: "bg-ocean-50 text-ocean-800",
  DONE: "bg-emerald-50 text-emerald-800",
  DECLINED: "bg-obsidian-100 text-slate-700",
};
const COUPON_STYLE: Record<string, string> = {
  ACTIVE: "bg-ocean-50 text-ocean-800",
  INACTIVE: "bg-obsidian-100 text-slate-700",
  SCHEDULED: "bg-summit-100 text-obsidian-900",
  EXPIRED: "bg-obsidian-100 text-slate-700",
};
const SCOPE: Record<string, string> = { SHARED: "Shared", PRIVATE: "Private", SHUTTLE: "Shuttles" };
const words = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
const money = (n: number) => `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: iso.length === 10 ? "UTC" : "America/Edmonton" }) : "–");
const tourDay = (iso: string) => day(iso.slice(0, 10));

export function PartnerOverview({ id }: { id: string }) {
  const [data, setData] = useState<Overview | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "missing" | "error">("loading");
  const [message, setMessage] = useState("");
  const [dialog, setDialog] = useState<"approve" | "update" | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/affiliates/admin/${encodeURIComponent(id)}/overview`);
      if (res.status === 401 || res.status === 403) return setState("denied");
      if (res.status === 404) return setState("missing");
      if (!res.ok) throw new Error();
      setData(await res.json());
      setState("ok");
    } catch {
      setState("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const p = data?.partner;
  const current = data?.contracts[0];
  // The shape the approve / new agreement dialog needs.
  const asAdminPartner: AdminPartner | null = p
    ? {
        ...p,
        contract: current ? { version: current.version, commissionPercent: current.commissionPercent, products: current.products, sentAt: current.sentAt } : null,
        hasApplication: true,
        openRequests: 0,
        bookings: data!.totals.bookings,
        commission: { pending: data!.totals.pending, approved: data!.totals.approved, paid: data!.totals.paid },
      }
    : null;
  const commissionText = current
    ? `${current.commissionPercent}% on ${current.products.join(", ")}`
    : p?.commissionSetAt
      ? `${Math.round(p.commissionRate * 1000) / 10}% on all products (no agreement sent)`
      : p?.status === "ACTIVE"
        ? `${p ? Math.round(p.commissionRate * 1000) / 10 : 0}% (old default, not set by staff)`
        : "Not set yet: chosen when you approve";

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <AdminHeader
        current="/admin/partners"
        eyebrow="Staff · Partner program"
        title={p ? p.name : "Partner"}
        subtitle={
          p ? (
            <span className="flex flex-wrap items-center gap-2">
              <Chip className={STATUS_STYLE[p.status]}>{words(p.status)}</Chip>
              <span>
                Code <span className="font-mono">{p.code}</span> · {p.contactName} · {p.email}
              </span>
            </span>
          ) : undefined
        }
        actions={
          <span className="flex flex-wrap gap-2">
            <Link href="/admin/partners" className={quietBtn}>
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
              All partners
            </Link>
            <button type="button" onClick={() => void load()} className={quietBtn}>
              <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Refresh
            </button>
          </span>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 px-page py-8 sm:py-10">
        {state === "denied" && <StaffSignIn body="Sign in with an admin account to see partners." />}
        {state === "missing" && <p className="rounded-2xl bg-white px-5 py-4 ring-1 ring-obsidian-900/[0.07]">This partner wasn&apos;t found. It may have been deleted.</p>}
        {state === "error" && (
          <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
            Couldn&apos;t load this partner. Try again in a moment.
          </p>
        )}
        {state === "loading" && <Loading />}
        <p aria-live="polite" className={message ? "rounded-2xl bg-ocean-50 px-5 py-3 text-sm text-ocean-800" : "sr-only"}>
          {message}
        </p>

        {state === "ok" && data && p && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Bookings credited" value={data.totals.bookings} hint={`${data.totals.paidBookings} paid · ${data.totals.guests} guests`} />
              <Stat label="Booking value (paid)" value={money(data.totals.revenue)} hint="CAD" />
              <Stat label="Net commission" value={money(data.totals.commission)} hint={`${money(data.totals.pending)} pending · ${money(data.totals.approved)} approved · ${money(data.totals.paid)} paid`} />
              <Stat label="Link clicks" value={data.totals.clicks30d} hint={`last 30 days · ${data.totals.clicksAll} in total`} />
            </div>

            <Panel
              id="partner-commission"
              title="Commission and agreement"
              description={commissionText}
              actions={
                p.status === "ACTIVE" ? (
                  <button type="button" className={primaryBtn} onClick={() => setDialog("update")}>
                    New agreement
                  </button>
                ) : p.status === "PENDING" || p.status === "REJECTED" ? (
                  <button type="button" className={primaryBtn} onClick={() => setDialog("approve")}>
                    Approve
                  </button>
                ) : undefined
              }
            >
              {data.contracts.length === 0 ? (
                <Empty>No agreement sent yet.</Empty>
              ) : (
                <Grid label="Agreements" minWidth="min-w-[40rem]" head={[["Version"], ["Commission"], ["Products"], ["Sent"], [""]]}>
                  {data.contracts.map((c, i) => (
                    <tr key={c.version}>
                      <td className="px-6 py-4">
                        v{c.version}
                        {i === 0 ? " (current)" : ""}
                      </td>
                      <td className="px-6 py-4">{c.commissionPercent}%</td>
                      <td className="px-6 py-4 text-sm">{c.products.join(", ")}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {day(c.sentAt)}
                        {c.sentTo ? ` to ${c.sentTo}` : ""}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <a href={`/api/affiliates/admin/${p.id}/contracts/${c.version}/pdf`} className={quietBtn}>
                          <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
                          PDF <span className="sr-only">version {c.version}</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </Grid>
              )}
              {data.rules.length > 0 && (
                <p className="border-t border-obsidian-900/[0.06] px-6 py-4 text-sm text-slate-600">
                  Active commission rules:{" "}
                  {data.rules
                    .map((r) => `${r.tour ?? (r.category ? words(r.category) : data.rules.length > 1 ? "Everything else" : "All products")} ${r.percent != null ? `${r.percent}%` : money(r.fixedAmount ?? 0)}`)
                    .join(" · ")}
                </p>
              )}
            </Panel>

            <Panel id="partner-profile" title="Partner details" description="Contact details, the application form and the bank details for payouts. Bank details open only when you ask, and every view is recorded in the audit log.">
              <dl className="grid gap-x-6 gap-y-3 px-6 py-5 text-sm md:grid-cols-3">
                {(
                  [
                    ["Business name", p.name],
                    ["Contact", p.contactName],
                    ["Sign-in email", p.email],
                    ["Phone", p.phone],
                    ["Website", p.website],
                    ["Payout email", p.payoutEmail],
                    ["Type", words(p.type)],
                    ["Referral code", p.code],
                    ["Joined", day(p.createdAt)],
                    ["Bókun channel", p.bokunChannelId],
                  ] as [string, string | null][]
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-slate-600">{k}</dt>
                      <dd className="break-words text-obsidian-900">{v}</dd>
                    </div>
                  ))}
              </dl>
              <div className="border-t border-obsidian-900/[0.06] pb-5">
                <PartnerApplicationDetails partnerId={p.id} />
              </div>
            </Panel>

            <Panel
              id="partner-coupons"
              title="Coupons"
              description="Codes the team gave this partner. Bookings made with them are credited to the partner."
              actions={
                <Link href="/admin/promo-codes" className={quietBtn}>
                  Make a coupon
                </Link>
              }
            >
              {data.coupons.length === 0 ? (
                <Empty>No coupons for this partner.</Empty>
              ) : (
                <Grid label="Coupons" minWidth="min-w-[40rem]" head={[["Code"], ["Discount"], ["Dates"], ["Where"], ["Uses", true], ["Status"]]}>
                  {data.coupons.map((c) => (
                    <tr key={c.id}>
                      <td className="px-6 py-4 font-mono">{c.code}</td>
                      <td className="px-6 py-4">{c.label}</td>
                      <td className="px-6 py-4 text-sm">{!c.startsOn && !c.endsOn ? "Any time" : `${c.startsOn ? day(c.startsOn) : "Now"} to ${c.endsOn ? day(c.endsOn) : "no end"}`}</td>
                      <td className="px-6 py-4 text-sm">{c.appliesTo.map((s) => SCOPE[s] ?? s).join(", ")}</td>
                      <td className="px-6 py-4 text-right tabular-nums">
                        {c.uses}
                        <span className="block text-sm text-slate-600">{c.paidBookings} paid</span>
                      </td>
                      <td className="px-6 py-4">
                        <Chip className={COUPON_STYLE[c.state] ?? ""}>{words(c.state)}</Chip>
                      </td>
                    </tr>
                  ))}
                </Grid>
              )}
            </Panel>

            <Panel id="partner-bookings" title="Bookings credited to this partner" description="Through their referral link or one of their coupons. The latest 100.">
              {data.bookings.length === 0 ? (
                <Empty>No bookings credited yet.</Empty>
              ) : (
                <Grid label="Bookings" minWidth="min-w-[60rem]" head={[["Booking"], ["Experience"], ["Tour date"], ["Guest"], ["Total", true], ["Commission", true], ["Status"]]}>
                  {data.bookings.map((b) => (
                    <tr key={b.id}>
                      <td className="px-6 py-4">
                        <Link href={`/admin/bookings/${encodeURIComponent(b.id)}`} className="font-mono text-sm text-ocean-700 underline underline-offset-2">
                          {b.reference}
                        </Link>
                        <span className="block text-sm text-slate-600">booked {day(b.bookedAt)}</span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {b.experience}
                        {b.promoCode && <span className="block text-slate-600">Coupon {b.promoCode}</span>}
                      </td>
                      <td className="px-6 py-4 text-sm">{tourDay(b.date)}</td>
                      <td className="px-6 py-4 text-sm">
                        {b.guestName}
                        <span className="block text-slate-600">{b.guests} guests</span>
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums">{money(b.total)}</td>
                      <td className="px-6 py-4 text-right tabular-nums">{money(b.commission)}</td>
                      <td className="px-6 py-4">
                        <Chip className={BOOKING_STATUS_STYLE[b.status] ?? ""}>{words(b.status)}</Chip>
                      </td>
                    </tr>
                  ))}
                </Grid>
              )}
            </Panel>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel
                id="partner-requests"
                title="Change requests"
                actions={
                  <Link href="/admin/partners?section=requests" className={quietBtn}>
                    Answer requests
                  </Link>
                }
              >
                {data.requests.length === 0 ? (
                  <Empty>No change requests.</Empty>
                ) : (
                  <ul className="divide-y divide-obsidian-900/[0.06]">
                    {data.requests.map((r) => (
                      <li key={r.id} className="px-6 py-4">
                        <span className="flex flex-wrap items-center gap-2">
                          <Chip className={REQUEST_STYLE[r.status] ?? ""}>{words(r.status)}</Chip>
                          <span className="text-obsidian-900">{r.subject}</span>
                        </span>
                        <span className="mt-1 block text-sm text-slate-600">
                          {words(r.category)} · {day(r.createdAt)}
                          {r.staffNote ? ` · Reply: ${r.staffNote}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel id="partner-payouts" title="Payouts">
                {data.payouts.length === 0 ? (
                  <Empty>No payouts yet.</Empty>
                ) : (
                  <ul className="divide-y divide-obsidian-900/[0.06]">
                    {data.payouts.map((x) => (
                      <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
                        <span>
                          {money(x.amount)} {x.currency}
                          <span className="block text-sm text-slate-600">
                            {x.status === "PAID" ? `Paid ${day(x.paidAt)}${x.reference ? ` · ${x.reference}` : ""}` : `${words(x.status)} · ${day(x.createdAt)}`}
                          </span>
                        </span>
                        <Chip className={x.status === "PAID" ? "bg-ocean-50 text-ocean-800" : "bg-obsidian-100 text-slate-700"}>{words(x.status)}</Chip>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </>
        )}
      </div>

      <PartnerContractDialog
        partner={dialog ? asAdminPartner : null}
        mode={dialog ?? "approve"}
        onClose={() => setDialog(null)}
        onDone={(m) => {
          setDialog(null);
          setMessage(m);
          void load();
        }}
      />
    </div>
  );
}
