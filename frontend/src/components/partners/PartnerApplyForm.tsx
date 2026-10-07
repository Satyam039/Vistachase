"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";

const TYPES = [
  { value: "HOTEL", label: "Hotel, lodge or rental host" },
  { value: "AGENT", label: "Travel agent or tour desk" },
  { value: "CREATOR", label: "Blogger, creator or travel site" },
  { value: "OTHER", label: "Something else" },
];

const field =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-obsidian-900 focus:border-ocean-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600";

export function PartnerApplyForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [code, setCode] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setFields({});
    setStatus("sending");
    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      const res = await fetch("/api/affiliates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "We couldn't submit your application.");
        setFields(data.fields || {});
        setStatus("idle");
        return;
      }
      setCode(data.affiliate.code);
      setStatus("done");
    } catch {
      setError("Network error. Please try again.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div role="status" className="space-y-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-emerald-900">
        <p className="flex items-center gap-2 text-2xl font-light">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> Application received
        </p>
        <p className="text-base">
          Your referral code is <span className="font-mono">{code}</span>. We review applications within two business days. Once
          you&apos;re approved, every booking made through your links is credited to you.
        </p>
        <Link href="/partners/login" className="inline-flex min-h-11 items-center underline underline-offset-4">
          Sign in to your partner dashboard
        </Link>
      </div>
    );
  }

  const err = (name: string) =>
    fields[name]?.length ? (
      <p id={`partner-${name}-error`} className="text-sm text-red-700">
        {name === "website" ? "Enter a full web address, starting with https://" : name === "password" ? "Use at least 8 characters." : "Please check this field."}
      </p>
    ) : null;
  const described = (name: string) => (fields[name]?.length ? `partner-${name}-error` : undefined);

  return (
    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8" noValidate>
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="partner-name" className="text-sm text-slate-700">Business or creator name</label>
          <input id="partner-name" name="name" required autoComplete="organization" className={field} aria-describedby={described("name")} aria-invalid={!!fields.name} />
          {err("name")}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="partner-contact" className="text-sm text-slate-700">Your name</label>
          <input id="partner-contact" name="contactName" required autoComplete="name" className={field} aria-describedby={described("contactName")} aria-invalid={!!fields.contactName} />
          {err("contactName")}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="partner-email" className="text-sm text-slate-700">Email</label>
          <input id="partner-email" name="email" type="email" required autoComplete="email" className={field} aria-describedby={described("email")} aria-invalid={!!fields.email} />
          {err("email")}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="partner-password" className="text-sm text-slate-700">Password (8+ characters)</label>
          <input id="partner-password" name="password" type="password" required minLength={8} autoComplete="new-password" className={field} aria-describedby={described("password")} aria-invalid={!!fields.password} />
          {err("password")}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="partner-type" className="text-sm text-slate-700">What best describes you?</label>
          <select id="partner-type" name="type" defaultValue="HOTEL" className={field}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="partner-website" className="text-sm text-slate-700">Website (optional)</label>
          <input id="partner-website" name="website" type="url" placeholder="https://" autoComplete="url" className={field} aria-describedby={described("website")} aria-invalid={!!fields.website} />
          {err("website")}
        </div>
      </div>
      <button
        type="submit"
        disabled={status === "sending"}
        className="golden-summit-btn inline-flex h-12 items-center gap-2 rounded-md px-7 text-sm uppercase tracking-[0.14em] disabled:opacity-60"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        {status === "sending" ? "Sending…" : "Apply to partner"}
      </button>
    </form>
  );
}
