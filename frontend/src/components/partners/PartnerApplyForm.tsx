"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import { Dropdown } from "@/components/forms/Dropdown";
import { PhoneField } from "@/components/forms/PhoneField";
import { dialCode } from "@/lib/countries";
import { TURNSTILE_SITE_KEY, useFormToken, useTurnstile } from "@/lib/spamGuard";

const TYPES = [
  { value: "HOTEL", label: "Hotel, lodge or rental host" },
  { value: "AGENT", label: "Travel agent or tour desk" },
  { value: "CREATOR", label: "Blogger, creator or travel site" },
  { value: "OTHER", label: "Something else" },
];

const REQUIRED = ["name", "contactName", "email", "password", "type", "website", "phone"] as const;

function clientProblems(form: Record<string, string>, phoneLocal: string) {
  const problems: Record<string, string[]> = {};
  for (const name of REQUIRED) if (!form[name]?.trim()) problems[name] = ["required"];
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) problems.email = ["invalid"];
  if (form.password && form.password.length < 8) problems.password = ["short"];
  if (form.website?.trim() && !/^https?:\/\/\S+\.\S+/.test(form.website.trim())) problems.website = ["invalid"];
  if (phoneLocal && (!/^[0-9().\-\s]+$/.test(phoneLocal) || phoneLocal.replace(/\D/g, "").length < 6)) problems.phone = ["invalid"];
  return problems;
}

const field =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-obsidian-900 focus:border-ocean-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600";

export function PartnerApplyForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [code, setCode] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("CA");
  const [phoneLocal, setPhoneLocal] = useState("");
  // Bot checks (owner, 2026-11-15: fake partner applications): the page's signed token, a hidden
  // field (`fax`) and, when set up, Cloudflare Turnstile. The API checks the same things.
  const formToken = useFormToken();
  const turnstileBox = useRef<HTMLDivElement>(null);
  const turnstile = useTurnstile(turnstileBox);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setFields({});
    if (!formToken.token) {
      formToken.reload();
      setError("Please wait a moment and try again.");
      return;
    }
    if (TURNSTILE_SITE_KEY && !turnstile.token) {
      setError("Please complete the security check above the button.");
      return;
    }
    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    // Every field is required (owner, 2026-11-18); the API checks the same rules.
    const local = phoneLocal.trim();
    form.phone = local ? `+${dialCode(phoneCountry)} ${local.replace(/^\+?0+/, "")}` : "";
    const problems = clientProblems(form, local);
    if (Object.keys(problems).length) {
      setFields(problems);
      setError("Please fill in every field.");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/affiliates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, formToken: formToken.token, turnstileToken: turnstile.token || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "We couldn't submit your application.");
        setFields(data.fields || {});
        setStatus("idle");
        turnstile.reset();
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
      <div role="status" className="space-y-3 rounded-none bg-emerald-50 p-8 text-emerald-900 ring-1 ring-emerald-200">
        <p className="flex items-center gap-2 text-2xl font-light">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> Application received
        </p>
        <p className="text-base">
          {code && (
            <>
              Your referral code is <span className="font-mono">{code}</span>.{" "}
            </>
          )}
          We review applications within two business days and email you once your account is approved. Then you can sign in to your partner
          dashboard, and every booking made through your links is credited to you.
        </p>
        <Link href="/affiliate/login" className="inline-flex min-h-11 items-center underline underline-offset-4">
          Partner sign-in
        </Link>
      </div>
    );
  }

  const message = (name: string) => {
    if (fields[name]?.[0] === "required") return "This field is required.";
    if (name === "website") return "Enter a full web address, starting with https://";
    if (name === "password") return "Use at least 8 characters.";
    if (name === "phone") return "Enter your phone number (digits and spaces).";
    if (name === "email") return "Enter a valid email address.";
    if (name === "type") return "Choose what best describes you.";
    return "Please check this field.";
  };
  const err = (name: string) =>
    fields[name]?.length ? (
      <p id={`partner-${name}-error`} className="text-sm text-red-700">
        {message(name)}
      </p>
    ) : null;
  // A field's error goes away as soon as it is edited.
  const clear = (name: string) =>
    setFields((f) => {
      if (!f[name]) return f;
      const next = { ...f };
      delete next[name];
      return next;
    });
  const described = (name: string) => (fields[name]?.length ? `partner-${name}-error` : undefined);

  return (
    <form onSubmit={submit} onChange={(e) => clear(((e.target as unknown) as HTMLInputElement).name ?? "")} className="space-y-5 rounded-none bg-white p-6 ring-1 ring-obsidian-900/[0.07] sm:p-8" noValidate>
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
          <Dropdown
            id="partner-type"
            name="type"
            label="What best describes you?"
            placeholder="Choose one"
            options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
            onChange={() => clear("type")}
            invalid={!!fields.type}
            describedBy={described("type")}
          />
          {err("type")}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="partner-website" className="text-sm text-slate-700">Website</label>
          <input id="partner-website" name="website" type="url" required placeholder="https://" autoComplete="url" className={field} aria-describedby={described("website")} aria-invalid={!!fields.website} />
          {err("website")}
        </div>
        <PhoneField
          label="Phone"
          country={phoneCountry}
          onCountryChange={setPhoneCountry}
          value={phoneLocal}
          onChange={(v) => {
            setPhoneLocal(v);
            clear("phone");
          }}
          heightClass="h-12"
          roundedClass="rounded-xl"
          error={fields.phone?.length ? message("phone") : undefined}
        />
      </div>
      {/* Honeypot for bots: hidden from people and assistive technology. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Fax
          <input name="fax" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <p className="text-sm text-slate-600">
        We use these details only to run your partner account and pay your commission. Commission is earned when a guest you referred pays for a booking.
      </p>
      {TURNSTILE_SITE_KEY && <div ref={turnstileBox} />}
      <button
        type="submit"
        disabled={status === "sending"}
        className="golden-summit-btn inline-flex h-12 items-center gap-2 rounded-full px-7 text-base disabled:opacity-60"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        {status === "sending" ? "Sending…" : "Apply to partner"}
      </button>
    </form>
  );
}
