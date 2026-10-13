"use client";

// Shared pieces of the staff admin screens (bookings, departures, pickup stops, manifests, audit
// log, staff): the /api/admin helper and the panel, table and form styles the SEO screens use.
// Every call goes through /api/admin/*, which checks the signed-in person's current role and
// records changes in the audit log.

export { Chip, Empty, Grid, Loading, Panel, Stat, dangerBtn, errorOf, field, labelCls, primaryBtn, quietBtn, when, words } from "@/components/admin/seo/shared";

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T & { error?: string; fields?: Record<string, string[]> };
}

export async function adminApi<T = Record<string, unknown>>(path: string, method = "GET", body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api/admin${path}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Network error. Please try again." } as never };
  }
}

/** True when the response means "not signed in as staff" (show StaffSignIn). */
export const isDenied = (status: number) => status === 401 || status === 403;

export const money = (amount: number | null | undefined, currency = "CAD") =>
  amount == null ? "–" : `$${amount.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

/** Today's date in Mountain Time as YYYY-MM-DD (departures are Mountain Time). */
export const todayMT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export const BOOKING_STATUS_STYLE: Record<string, string> = {
  CONFIRMED: "bg-ocean-50 text-ocean-800",
  PAID_UNSYNCED: "bg-ocean-50 text-ocean-800",
  COMPLETED: "bg-obsidian-100 text-slate-700",
  PENDING_PAYMENT: "bg-summit-100 text-obsidian-900",
  CANCELLED: "bg-red-50 text-red-800",
  REFUNDED: "bg-red-50 text-red-800",
  EXPIRED: "bg-obsidian-100 text-slate-700",
};

export const FLAG_LABEL: Record<string, string> = {
  PAYMENT_AMOUNT_MISMATCH: "Payment amount mismatch",
  LATE_PAYMENT: "Paid after expiry",
  REFUND_DUE: "Refund owed",
  PAYMENT_DUE: "Payment due",
  OTHER: "Other",
};
