"use client";

// Contact form / "Request this tour". Posts to /api/enquiries (saved + emailed to the team).
// Prefilled from the product page's Request link (?tour=slug&guests=n). Errors are announced and
// tied to their fields; success replaces the form with a confirmation.

import { useRef, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Dropdown } from "@/components/forms/Dropdown";
import { PhoneField } from "@/components/forms/PhoneField";
import { dialCode } from "@/lib/countries";
import { RequestDateCalendar, longDay, tripDates } from "@/components/forms/RequestDateCalendar";

type Fields = "name" | "email" | "phone" | "message" | "date" | "guests" | "tour";
const FIELD =
  "h-12 w-full rounded-xl border border-obsidian-900/10 bg-white px-4 text-base text-obsidian-900 placeholder:text-slate-400 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/30 aria-[invalid=true]:border-red-600";

const GENERAL_QUESTION_OPTIONS = [
  { value: "private", label: "Private" },
  { value: "shared", label: "Shared" },
  { value: "shuttle", label: "Shuttle" },
];

export function ContactForm({
  tours = [],
  defaultTour = "",
  defaultGuests,
  defaultMessage,
  defaultDate,
  tripDays = 1,
}: {
  tours?: { slug: string; title: string }[];
  defaultTour?: string;
  defaultGuests?: number;
  /** Prefilled message, e.g. for a package request. */
  defaultMessage?: string;
  /** Preselected date ("YYYY-MM-DD"), e.g. a shuttle departure's day. */
  defaultDate?: string;
  /** Days in the requested trip (2–4 for the multi-day packages); the calendar highlights them all. */
  tripDays?: number;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Fields, string>>>({});

  const initialCategory =
    defaultTour.includes("private") || defaultTour.includes("three-day") || defaultTour.includes("four-day")
      ? "private"
      : defaultTour.includes("shuttle")
      ? "shuttle"
      : "shared";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("CA");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [tourCategory, setTourCategory] = useState(initialCategory);
  const [date, setDate] = useState(defaultDate && /^\d{4}-\d{2}-\d{2}$/.test(defaultDate) ? defaultDate : "");
  const [guests, setGuests] = useState(defaultGuests ? String(defaultGuests) : "");
  const [message, setMessage] = useState(defaultMessage || "");
  // Dates the calendar wrote into the message, so choosing again replaces them but never what the
  // guest typed themselves.
  const filled = useRef<Record<string, string>>({});

  const chooseDate = (day: string) => {
    setDate(day);
    setFieldErrors((f) => ({ ...f, date: undefined }));
    const days = tripDates(day, tripDays);
    const values: Record<string, string> = { start: longDay(days[0]) };
    days.forEach((d, i) => (values[`day${i + 1}`] = longDay(d)));
    setMessage((text) =>
      text.replace(/^(Preferred (start|Day (\d)) date:)[ \t]*(.*)$/gim, (line, label: string, which: string, n: string | undefined, current: string) => {
        const key = n ? `day${n}` : "start";
        const next = values[key];
        if (!next || (current.trim() && current.trim() !== filled.current[key])) return line;
        filled.current[key] = next;
        return `${label} ${next}`;
      }),
    );
  };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const errs: Partial<Record<Fields, string>> = {};
    if (!name.trim() || name.trim().length < 2) {
      errs.name = "Enter your full name.";
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      errs.email = "Enter a valid email address.";
    }
    if (!phoneLocal.trim() || phoneLocal.replace(/\D/g, "").length < 6) {
      errs.phone = "Enter a valid phone number with country code.";
    }
    if (!tourCategory) {
      errs.tour = "Please select Private, Shared, or Shuttle.";
    }
    if (!date) {
      errs.date = "Please select your preferred date.";
    }
    if (!guests || Number(guests) < 1) {
      errs.guests = "Enter the number of guests.";
    }
    if (!message.trim() || message.trim().length < 5) {
      errs.message = "Please write a message (at least 5 characters).";
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError("Please fill in all required fields.");
      return;
    }

    setState("sending");
    const fullPhone = `+${dialCode(phoneCountry)} ${phoneLocal.trim()}`;
    const payload = {
      name: name.trim(),
      email: email.trim(),
      phone: fullPhone,
      tourSlug: tourCategory,
      date,
      guests: Number(guests),
      message: message.trim(),
    };

    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        const f = (json.fields ?? {}) as Record<string, string[]>;
        setFieldErrors(
          Object.fromEntries(
            Object.entries(f).map(([k]) => [
              k,
              k === "email"
                ? "Enter a valid email address."
                : k === "message"
                ? "Please write a short message."
                : k === "name"
                ? "Enter your name."
                : "Please check this field.",
            ]),
          ),
        );
        setError(json.error ?? "Something went wrong. Please try again.");
        setState("idle");
        return;
      }
      setState("sent");
    } catch {
      setError("We couldn't send that just now. Please try again, or email support@vistachase.com.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div role="status" className="flex flex-col items-start gap-4 py-6">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </span>
        <h3 className="text-2xl font-light text-obsidian-900">Thanks, we&rsquo;ve got your message</h3>
        <p className="text-base text-slate-600">Our team will reply by email, usually within a day. For anything urgent, call +1 (825) 734-9456.</p>
      </div>
    );
  }

  const err = (k: Fields) =>
    fieldErrors[k] ? (
      <span id={`contact-${k}-error`} className="mt-1.5 block text-sm text-red-700">
        {fieldErrors[k]}
      </span>
    ) : null;
  const aria = (k: Fields) => ({
    "aria-invalid": fieldErrors[k] ? true : undefined,
    "aria-describedby": fieldErrors[k] ? `contact-${k}-error` : undefined,
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Full name</span>
        <input
          name="name"
          required
          autoComplete="name"
          placeholder="Sarah Jenkins"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={FIELD}
          {...aria("name")}
        />
        {err("name")}
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={FIELD}
          {...aria("email")}
        />
        {err("email")}
      </label>

      <div className="block">
        <PhoneField
          label="Phone number"
          country={phoneCountry}
          onCountryChange={setPhoneCountry}
          value={phoneLocal}
          onChange={setPhoneLocal}
          heightClass="h-12"
          roundedClass="rounded-xl"
          error={fieldErrors.phone}
        />
      </div>

      <div className="block">
        <Dropdown
          name="tourSlug"
          label="General questions"
          defaultValue={initialCategory}
          value={tourCategory}
          onChange={setTourCategory}
          options={GENERAL_QUESTION_OPTIONS}
        />
        {err("tour")}
      </div>

      <div className="sm:col-span-2">
        <span id="contact-date-label" className="mb-1.5 block text-sm font-medium text-slate-700">
          {tripDays > 1 ? `Preferred start date (${tripDays}-day trip)` : "Preferred date"}
        </span>
        <input type="hidden" name="date" value={date} />
        <RequestDateCalendar
          value={date}
          onChange={chooseDate}
          tripDays={tripDays}
          labelId="contact-date-label"
          invalid={Boolean(fieldErrors.date)}
          describedBy={fieldErrors.date ? "contact-date-error" : undefined}
        />
        {err("date")}
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Guests</span>
        <input
          name="guests"
          type="number"
          required
          min={1}
          max={60}
          inputMode="numeric"
          value={guests}
          onChange={(e) => setGuests(e.target.value)}
          placeholder="2"
          className={FIELD}
          {...aria("guests")}
        />
        {err("guests")}
      </label>

      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Message</span>
        <textarea
          name="message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us your dates, where you're staying and what you'd love to see."
          className={`${FIELD} h-auto py-3 leading-relaxed`}
          {...aria("message")}
        />
        {err("message")}
      </label>

      {/* Honeypot for bots: hidden from people and assistive technology. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 sm:col-span-2">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button
          type="submit"
          disabled={state === "sending"}
          className="golden-summit-btn inline-flex h-12 items-center gap-2 rounded-full px-7 text-base disabled:opacity-70"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          {state === "sending" ? "Sending…" : "Send message"}
        </button>
        <p className="text-sm text-slate-600">We usually reply within a day.</p>
      </div>
    </form>
  );
}
