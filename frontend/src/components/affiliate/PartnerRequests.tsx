"use client";

// Partner dashboard → Requests (owner, 2026-11-26): a web form for any change a partner needs from
// Vista Chase (business or contact details, bank details, commission, a coupon code, a booking,
// products or links, anything else), and the list of their requests with the team's answers. The
// team is emailed and answers in Admin → Partners → Change requests; the partner is emailed back.

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Dropdown } from "@/components/forms/Dropdown";

type Status = "OPEN" | "IN_PROGRESS" | "DONE" | "DECLINED";

interface ChangeRequest {
  id: string;
  category: string;
  categoryLabel: string;
  subject: string;
  details: string;
  bookingReference: string | null;
  status: Status;
  staffNote: string | null;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  { value: "PROFILE", label: "Business or contact details" },
  { value: "BANK", label: "Bank / payout details" },
  { value: "COMMISSION", label: "Commission or agreement" },
  { value: "COUPON", label: "Coupon code" },
  { value: "BOOKING", label: "A booking" },
  { value: "PRODUCTS", label: "Products or links" },
  { value: "OTHER", label: "Something else" },
];

const HINTS: Record<string, string> = {
  PROFILE: "Tell us what should change, for example a new business name, address or contact person.",
  BANK: "Don't type full account numbers here. Tell us what changed and we'll contact you to confirm the new details securely.",
  COMMISSION: "Tell us what you'd like to change in your commission or agreement.",
  COUPON: "Tell us the discount you'd like, the dates, and where it should apply (shared tours, private tours, shuttles).",
  BOOKING: "Add the booking reference and tell us what's wrong, for example a booking that isn't showing in your account.",
  PRODUCTS: "Tell us which product or link you need.",
  OTHER: "Tell us what you need.",
};

const STATUS: Record<Status, { label: string; cls: string }> = {
  OPEN: { label: "Sent", cls: "bg-amber-50 text-amber-800" },
  IN_PROGRESS: { label: "In progress", cls: "bg-ocean-50 text-ocean-800" },
  DONE: { label: "Done", cls: "bg-emerald-50 text-emerald-700" },
  DECLINED: { label: "Declined", cls: "bg-slate-100 text-slate-600" },
};

const field = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-ocean-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600";
const labelCls = "text-xs font-medium uppercase tracking-wider text-slate-700";
const when = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });

export function PartnerRequests() {
  const [requests, setRequests] = useState<ChangeRequest[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [category, setCategory] = useState("PROFILE");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [bookingReference, setBookingReference] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/affiliates/me/requests").catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setLoadError("Couldn't load your requests. Try again in a moment.");
    setLoadError("");
    setRequests(data.requests ?? []);
  }, []);

  useEffect(() => {
    void load();
    // ?category=COUPON from Coupons → Ask for a coupon.
    const wanted = new URLSearchParams(window.location.search).get("category");
    if (wanted && CATEGORIES.some((c) => c.value === wanted)) {
      setCategory(wanted);
      if (wanted === "COUPON") setSubject("New coupon code");
    }
  }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (subject.trim().length < 3) found.subject = "Add a short subject.";
    if (details.trim().length < 10) found.details = "Tell us what should change (at least 10 characters).";
    setErrors(found);
    setSent("");
    setFormError("");
    if (Object.keys(found).length) return;
    setSaving(true);
    const res = await fetch("/api/affiliates/me/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, subject: subject.trim(), details: details.trim(), bookingReference: bookingReference.trim() }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setSaving(false);
    if (!res?.ok) {
      const fields = (data.fields ?? {}) as Record<string, string[]>;
      setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0]])));
      return setFormError(res?.status === 429 ? "You've sent a lot of requests in the last hour. Please try again later." : data.error || "We couldn't send your request. Please try again.");
    }
    setSent("Request sent. The Vista Chase team will email you when it's updated.");
    setSubject("");
    setDetails("");
    setBookingReference("");
    await load();
  }

  return (
    <section aria-labelledby="requests-heading" className="space-y-6">
      <div>
        <h1 id="requests-heading" className="text-2xl font-light text-slate-900">Change requests</h1>
        <p className="max-w-2xl text-xs text-slate-500">Need something changed? Send it here: your details, bank details, commission, a coupon code, a booking, anything. We&apos;ll email you when it&apos;s done.</p>
      </div>

      <form onSubmit={submit} noValidate className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <h2 className="text-lg font-light text-slate-900 md:col-span-2">New request</h2>
        <Dropdown id="req-category" label="What is it about" labelClassName={labelCls} value={category} onChange={setCategory} options={CATEGORIES} />
        <div className="space-y-1.5">
          <label htmlFor="req-subject" className={labelCls}>Subject</label>
          <input
            id="req-subject"
            className={field}
            maxLength={150}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-invalid={!!errors.subject}
            aria-describedby={errors.subject ? "req-subject-error" : undefined}
            placeholder="For example: New mailing address"
          />
          {errors.subject && <p id="req-subject-error" className="text-xs text-red-700">{errors.subject}</p>}
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label htmlFor="req-details" className={labelCls}>Details</label>
          <textarea
            id="req-details"
            rows={5}
            maxLength={4000}
            className={field}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            aria-invalid={!!errors.details}
            aria-describedby={`req-details-hint${errors.details ? " req-details-error" : ""}`}
          />
          <p id="req-details-hint" className="text-xs text-slate-500">{HINTS[category]}</p>
          {errors.details && <p id="req-details-error" className="text-xs text-red-700">{errors.details}</p>}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="req-booking" className={labelCls}>Booking reference (optional)</label>
          <input
            id="req-booking"
            className={`${field} font-mono uppercase`}
            maxLength={40}
            value={bookingReference}
            onChange={(e) => setBookingReference(e.target.value.replace(/\s+/g, ""))}
            placeholder="VC-2026-1A2B3C4D"
            aria-invalid={!!errors.bookingReference}
          />
          {errors.bookingReference && <p className="text-xs text-red-700">{errors.bookingReference}</p>}
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={saving} className="golden-summit-btn inline-flex h-11 items-center rounded-full px-7 text-xs font-medium disabled:opacity-60">
            {saving ? "Sending…" : "Send request"}
          </button>
        </div>
        {formError && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 md:col-span-2">
            {formError}
          </p>
        )}
        <p aria-live="polite" className={sent ? "rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 md:col-span-2" : "sr-only"}>
          {sent}
        </p>
      </form>

      <div className="space-y-3">
        <h2 className="text-lg font-light text-slate-900">Your requests</h2>
        {loadError && <p role="alert" className="text-sm text-red-700">{loadError}</p>}
        {!requests ? (
          !loadError && <p className="text-sm text-slate-500">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-slate-500">No requests yet.</p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{r.subject}</p>
                    <p className="text-xs text-slate-500">
                      {r.categoryLabel} · sent {when(r.createdAt)}
                      {r.bookingReference ? ` · ${r.bookingReference}` : ""}
                    </p>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{r.details}</p>
                {r.staffNote && (
                  <p className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800">
                    <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-500">Vista Chase</span>
                    {r.staffNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
