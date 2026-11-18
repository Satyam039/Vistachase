"use client";

// The partner application (owner, 2026-11-18: "Vista Chase Partner Application" Word file), in the
// same order and wording: partner details, wire transfer details (Canadian or international bank)
// and the payment authorization, plus the password for the partner portal. Fields the form marks
// "optional" or "if ..." are optional; everything else is required, here and in the API
// (backend/src/modules/affiliates/partner-application.ts). Bank details are stored encrypted.

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import { Dropdown } from "@/components/forms/Dropdown";
import { PhoneField } from "@/components/forms/PhoneField";
import { dialCode } from "@/lib/countries";
import { TURNSTILE_SITE_KEY, useFormToken, useTurnstile } from "@/lib/spamGuard";

const TYPES = [
  { value: "AGENCY", label: "Travel agency" },
  { value: "ADVISOR", label: "Independent advisor" },
  { value: "OPERATOR", label: "Tour operator" },
  { value: "HOTEL", label: "Hotel or concierge" },
  { value: "AFFILIATE", label: "Affiliate" },
  { value: "OTHER", label: "Other" },
];

const WORK_MODES = [
  { value: "BOOK", label: "Book for guests" },
  { value: "REFER", label: "Refer guests" },
  { value: "BOTH", label: "Both" },
];

const AUTHORIZATION =
  "I am authorized to provide these details and authorize D Tourist Inc., operating as Vista Chase, to pay partner commissions to the account identified above under our signed agreement.";

const input =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-obsidian-900 placeholder:text-slate-400 focus:border-ocean-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600 aria-[invalid=true]:border-red-600";

type Errors = Record<string, string>;
type Location = "CANADA" | "INTERNATIONAL";

const PARTNER_REQUIRED = ["name", "type", "contactName", "contactRole", "email", "mailingAddress", "websiteOrReference", "workMode", "password"];
const BANK_REQUIRED = ["bank.beneficiaryName", "bank.beneficiaryAddress", "bank.currency", "bank.bankName", "bank.branchAddress"];
const CANADA_REQUIRED = ["bank.institutionNumber", "bank.transitNumber", "bank.accountNumber"];
const INTERNATIONAL_REQUIRED = ["bank.iban"];

function today() {
  return new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

/** The same checks the API makes, so people see every problem before sending. */
function check(form: Record<string, string>, location: Location | "", phoneLocal: string, authorized: boolean): Errors {
  const errors: Errors = {};
  const required = [...PARTNER_REQUIRED, ...BANK_REQUIRED, ...(location === "CANADA" ? CANADA_REQUIRED : location === "INTERNATIONAL" ? INTERNATIONAL_REQUIRED : []), "signatureName"];
  for (const name of required) if (!form[name]?.trim()) errors[name] = "This field is required.";
  if (!location) errors["bank.location"] = "Choose where your bank is.";
  if (!phoneLocal.trim()) errors.phone = "This field is required.";
  else if (!/^[0-9().\-\s]+$/.test(phoneLocal) || phoneLocal.replace(/\D/g, "").length < 6) errors.phone = "Enter your phone number (digits and spaces).";
  const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  if (form.email?.trim() && !emailOk(form.email)) errors.email = "Enter a valid email address.";
  if (form.statementEmail?.trim() && !emailOk(form.statementEmail)) errors.statementEmail = "Enter a valid email address.";
  if (form.password && form.password.length < 8) errors.password = "Use at least 8 characters.";
  if (form["bank.currency"]?.trim() && !/^[A-Za-z]{3}$/.test(form["bank.currency"].trim())) errors["bank.currency"] = "Use a 3-letter currency code, e.g. CAD.";
  if (location === "CANADA") {
    if (form["bank.institutionNumber"] && !/^\d{3}$/.test(form["bank.institutionNumber"].trim())) errors["bank.institutionNumber"] = "3 digits.";
    if (form["bank.transitNumber"] && !/^\d{5}$/.test(form["bank.transitNumber"].trim())) errors["bank.transitNumber"] = "5 digits.";
    if (form["bank.accountNumber"] && !/^\d{5,20}$/.test(form["bank.accountNumber"].trim())) errors["bank.accountNumber"] = "Digits only, including leading zeros.";
  }
  if (!authorized) errors.authorize = "Please confirm the payment authorization.";
  return errors;
}

/** The flat form fields as the API wants them: bank.* in a `bank` object, blanks left out. */
function payload(form: Record<string, string>, location: Location, phone: string) {
  const bank: Record<string, string> = { location };
  const body: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(form)) {
    const value = raw.trim();
    if (!value || key === "fax" || key === "phoneLocal") continue;
    if (key.startsWith("bank.")) bank[key.slice(5)] = value;
    else body[key] = value;
  }
  const keep = location === "CANADA" ? ["institutionNumber", "transitNumber", "accountNumber", "swift"] : ["iban", "swift", "routing", "intermediaryBank", "intermediarySwift", "correspondentReference", "additionalInstructions"];
  const common = ["location", "beneficiaryName", "beneficiaryAddress", "currency", "bankName", "branchAddress"];
  return { ...body, phone, fax: form.fax ?? "", bank: Object.fromEntries(Object.entries(bank).filter(([k]) => common.includes(k) || keep.includes(k))) };
}

function Section({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-5 border-t border-obsidian-900/10 pt-6 first:border-t-0 first:pt-0">
      <legend className="float-left w-full pb-1">
        <span className="block text-xl font-light text-obsidian-900">{title}</span>
        {intro && <span className="mt-1 block text-sm text-slate-600">{intro}</span>}
      </legend>
      <div className="clear-both grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function PartnerApplyForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [code, setCode] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("CA");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [location, setLocation] = useState<Location | "">("");
  const [authorized, setAuthorized] = useState(false);
  const [workMode, setWorkMode] = useState("");
  // Bot checks (owner, 2026-11-15: fake partner applications): the page's signed token, a hidden
  // field (`fax`) and, when set up, Cloudflare Turnstile. The API checks the same things.
  const formToken = useFormToken();
  const turnstileBox = useRef<HTMLDivElement>(null);
  const turnstile = useTurnstile(turnstileBox);

  const clear = (name: string) =>
    setErrors((e) => {
      if (!e[name]) return e;
      const next = { ...e };
      delete next[name];
      return next;
    });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const found = check(form, location, phoneLocal, authorized);
    setErrors(found);
    if (Object.keys(found).length) {
      setError(`Please complete the highlighted fields (${Object.keys(found).length}).`);
      // Take people to the first problem.
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    if (!formToken.token) {
      formToken.reload();
      setError("Please wait a moment and try again.");
      return;
    }
    if (TURNSTILE_SITE_KEY && !turnstile.token) {
      setError("Please complete the security check above the button.");
      return;
    }
    setStatus("sending");
    const phone = `+${dialCode(phoneCountry)} ${phoneLocal.trim().replace(/^\+?0+/, "")}`;
    try {
      const res = await fetch("/api/affiliates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload(form, location as Location, phone),
          authorize: authorized,
          formToken: formToken.token,
          turnstileToken: turnstile.token || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "We couldn't submit your application.");
        const fields = (data.fields || {}) as Record<string, string[]>;
        setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0] || "Please check this field."])));
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

  const errId = (name: string) => `pa-${name.replace(".", "-")}-error`;
  const err = (name: string) =>
    errors[name] ? (
      <p id={errId(name)} className="text-sm text-red-700">
        {errors[name]}
      </p>
    ) : null;

  /** A labelled text input or textarea; `wide` spans both columns. */
  const field = (
    name: string,
    label: string,
    opts: { type?: string; autoComplete?: string; optional?: boolean; wide?: boolean; area?: boolean; placeholder?: string; inputMode?: "numeric"; maxLength?: number; hint?: string } = {},
  ) => {
    const id = `pa-${name.replace(".", "-")}`;
    const common = {
      id,
      name,
      required: !opts.optional,
      autoComplete: opts.autoComplete ?? "off",
      placeholder: opts.placeholder,
      "aria-invalid": errors[name] ? true : undefined,
      "aria-describedby": errors[name] ? errId(name) : undefined,
      className: input,
    };
    return (
      <div key={name} className={`space-y-1.5 ${opts.wide ? "sm:col-span-2" : ""}`}>
        <label htmlFor={id} className="block text-sm text-slate-700">
          {label}
        </label>
        {opts.hint && <p className="text-xs text-slate-600">{opts.hint}</p>}
        {opts.area ? <textarea {...common} rows={2} maxLength={1000} /> : <input {...common} type={opts.type ?? "text"} inputMode={opts.inputMode} maxLength={opts.maxLength} />}
        {err(name)}
      </div>
    );
  };

  const radios = (name: string, legend: string, options: { value: string; label: string }[], value: string, onChange: (v: string) => void) => (
    <div className="space-y-2 sm:col-span-2" role="radiogroup" aria-labelledby={`${name}-legend`} aria-describedby={errors[name] ? errId(name) : undefined}>
      <p id={`${name}-legend`} className="text-sm text-slate-700">
        {legend}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ocean-600 ${
              value === o.value ? "border-obsidian-900 bg-obsidian-900 text-white" : errors[name] ? "border-red-600 bg-white text-obsidian-900" : "border-slate-300 bg-white text-obsidian-900"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => {
                onChange(o.value);
                clear(name);
              }}
              aria-invalid={errors[name] ? true : undefined}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      {err(name)}
    </div>
  );

  return (
    <form onSubmit={submit} onChange={(e) => clear(((e.target as unknown) as HTMLInputElement).name ?? "")} className="space-y-8" noValidate>
      <p className="text-sm text-slate-600">
        Vista Chase reviews your application before activating bookings under your signed commission agreement. Fields marked optional or
        &ldquo;if&rdquo; can be left blank.
      </p>
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <Section title="Partner details">
        {field("name", "Legal business name or individual partner's full name", { autoComplete: "organization", wide: true })}
        {field("tradingName", "Trading name (optional)", { optional: true })}
        <div className="space-y-1.5">
          <Dropdown
            id="pa-type"
            name="type"
            label="Partner type"
            placeholder="Choose one"
            options={TYPES}
            onChange={() => clear("type")}
            invalid={!!errors.type}
            describedBy={errors.type ? errId("type") : undefined}
          />
          {err("type")}
        </div>
        {field("contactName", "Primary contact's full name", { autoComplete: "name" })}
        {field("contactRole", "Primary contact's role", { autoComplete: "organization-title", placeholder: "e.g. Owner, Travel advisor" })}
        {field("email", "Work email", { type: "email", autoComplete: "email" })}
        <PhoneField
          label="Phone number with country code"
          country={phoneCountry}
          onCountryChange={setPhoneCountry}
          value={phoneLocal}
          onChange={(v) => {
            setPhoneLocal(v);
            clear("phone");
          }}
          heightClass="h-[50px]"
          roundedClass="rounded-xl"
          error={errors.phone}
        />
        {field("mailingAddress", "Business mailing address, including country", { autoComplete: "street-address", wide: true, area: true })}
        {field("websiteOrReference", "Business website, professional listing or agency reference", { wide: true, placeholder: "https://" })}
        {field("hostAgency", "Host agency name and verification contact (if affiliated)", { optional: true, wide: true })}
        {field("authorizedSigner", "Authorized signer's name and email (if different)", { optional: true, wide: true })}
        {radios("workMode", "How will you work with Vista Chase?", WORK_MODES, workMode, setWorkMode)}
        {field("statementEmail", "Commission statement email (if different)", { type: "email", optional: true })}
        {field("password", "Create a password for the partner portal (8+ characters)", { type: "password", autoComplete: "new-password" })}
      </Section>

      <Section title="Wire transfer details" intro="Use the incoming wire instructions supplied by your bank for the currency in your agreement.">
        {field("bank.beneficiaryName", "Beneficiary's full legal name as shown on the account", { wide: true })}
        {field("bank.beneficiaryAddress", "Beneficiary's full address on file with the bank, including country", { wide: true, area: true })}
        {field("bank.currency", "Receiving account currency", { placeholder: "CAD", maxLength: 3 })}
        {field("bank.bankName", "Receiving bank name")}
        {field("bank.branchAddress", "Full branch address, including country", { wide: true, area: true })}
        {radios(
          "bank.location",
          "Receiving bank location",
          [
            { value: "CANADA", label: "Canada" },
            { value: "INTERNATIONAL", label: "Outside Canada" },
          ],
          location,
          (v) => setLocation(v as Location),
        )}
        {location === "CANADA" && (
          <>
            <p className="text-base text-obsidian-900 sm:col-span-2">Canadian bank accounts only</p>
            {field("bank.institutionNumber", "Institution number (3 digits)", { inputMode: "numeric", maxLength: 3 })}
            {field("bank.transitNumber", "Branch transit number (5 digits)", { inputMode: "numeric", maxLength: 5 })}
            {field("bank.accountNumber", "Account number, including leading zeros", { inputMode: "numeric", maxLength: 20 })}
            {field("bank.swift", "SWIFT/BIC (if supplied by your bank)", { optional: true })}
          </>
        )}
        {location === "INTERNATIONAL" && (
          <>
            <p className="text-base text-obsidian-900 sm:col-span-2">International bank accounts only</p>
            {field("bank.iban", "IBAN or account number")}
            {field("bank.swift", "Receiving bank SWIFT/BIC (if provided)", { optional: true })}
            {field("bank.routing", "Local wire routing code and type (if provided, e.g. US Fedwire ABA, sort code or IFSC)", { optional: true, wide: true })}
            <p className="text-sm text-slate-600 sm:col-span-2">Intermediary bank: complete only if specified by your bank.</p>
            {field("bank.intermediaryBank", "Intermediary bank name and full address", { optional: true, wide: true, area: true })}
            {field("bank.intermediarySwift", "Intermediary SWIFT/BIC or routing code", { optional: true })}
            {field("bank.correspondentReference", "Correspondent account or further-credit reference (if specified)", { optional: true })}
            {field("bank.additionalInstructions", "Additional bank-supplied wire instructions (if any)", { optional: true, wide: true, area: true })}
          </>
        )}
      </Section>

      <Section title="Payment authorization">
        <label className="flex items-start gap-3 text-base text-slate-700 sm:col-span-2">
          <input
            type="checkbox"
            name="authorize"
            checked={authorized}
            onChange={(e) => {
              setAuthorized(e.target.checked);
              clear("authorize");
            }}
            aria-invalid={errors.authorize ? true : undefined}
            aria-describedby={errors.authorize ? errId("authorize") : undefined}
            className="mt-1 h-5 w-5 shrink-0 accent-ocean-600"
          />
          <span>{AUTHORIZATION}</span>
        </label>
        <div className="sm:col-span-2">
          {err("authorize")}
        </div>
        {field("signatureName", "Authorized representative's name (typed as your signature)", { autoComplete: "name" })}
        <div className="space-y-1.5">
          <p className="text-sm text-slate-700">Date</p>
          <p className="flex h-[50px] items-center rounded-xl border border-slate-200 bg-obsidian-50 px-4 text-base text-obsidian-900">{today()}</p>
        </div>
      </Section>

      {/* Honeypot for bots: hidden from people and assistive technology. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Fax
          <input name="fax" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <p className="text-sm text-slate-600">
        We use these details only to run your partner account and pay your commission. Bank details are stored encrypted and only Vista Chase
        administrators can see them. Commission is earned when a guest you referred pays for a booking.
      </p>
      {TURNSTILE_SITE_KEY && <div ref={turnstileBox} />}
      <button
        type="submit"
        disabled={status === "sending"}
        className="golden-summit-btn inline-flex h-12 items-center gap-2 rounded-full px-7 text-base disabled:opacity-60"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        {status === "sending" ? "Sending…" : "Submit application"}
      </button>
    </form>
  );
}
