"use client";

// Contact form / "Request this tour". Posts to /api/enquiries (saved + emailed to the team).
// Prefilled from the product page's Request link (?tour=slug&guests=n). Errors are announced and
// tied to their fields; success replaces the form with a confirmation.

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Dropdown } from "@/components/forms/Dropdown";
import { openDatePicker } from "@/lib/utils/datePicker";

type Fields = "name" | "email" | "phone" | "message" | "date" | "guests";
const FIELD =
  "h-12 w-full rounded-xl border border-obsidian-900/10 bg-white px-4 text-base text-obsidian-900 placeholder:text-slate-400 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/30 aria-[invalid=true]:border-red-600";

export function ContactForm({
  tours,
  defaultTour = "",
  defaultGuests,
}: {
  tours: { slug: string; title: string }[];
  defaultTour?: string;
  defaultGuests?: number;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Fields, string>>>({});
  const today = new Date().toISOString().slice(0, 10);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
    if (!body.guests) delete body.guests;
    setState("sending");
    try {
      const res = await fetch("/api/enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        const f = (json.fields ?? {}) as Record<string, string[]>;
        setFieldErrors(
          Object.fromEntries(
            Object.entries(f).map(([k]) => [
              k,
              k === "email" ? "Enter a valid email address." : k === "message" ? "Please write a short message." : k === "name" ? "Enter your name." : "Please check this field.",
            ]),
          ),
        );
        setError(json.error ?? "Something went wrong. Please try again.");
        setState("idle");
        return;
      }
      setState("sent");
    } catch {
      setError("We couldn't send that just now. Please try again, or email info@vistachase.com.");
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
  const aria = (k: Fields) => ({ "aria-invalid": fieldErrors[k] ? true : undefined, "aria-describedby": fieldErrors[k] ? `contact-${k}-error` : undefined });

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-700">Full name</span>
        <input name="name" required autoComplete="name" placeholder="Sarah Jenkins" className={FIELD} {...aria("name")} />
        {err("name")}
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-700">Email</span>
        <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" className={FIELD} {...aria("email")} />
        {err("email")}
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-700">
          Phone <span className="text-slate-500">(optional)</span>
        </span>
        <input name="phone" type="tel" autoComplete="tel" placeholder="+1 403 555 0192" className={FIELD} {...aria("phone")} />
      </label>
      <Dropdown
        name="tourSlug"
        defaultValue={defaultTour}
        label={
          <>
            Tour <span className="text-slate-500">(optional)</span>
          </>
        }
        searchable={tours.length > 8}
        searchPlaceholder="Search tours"
        options={[{ value: "", label: "General question" }, ...tours.map((t) => ({ value: t.slug, label: t.title }))]}
      />
      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-700">
          Preferred date <span className="text-slate-500">(optional)</span>
        </span>
        <input name="date" type="date" min={today} onClick={openDatePicker} onFocus={openDatePicker} className={FIELD} {...aria("date")} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-700">
          Guests <span className="text-slate-500">(optional)</span>
        </span>
        <input name="guests" type="number" min={1} max={60} inputMode="numeric" defaultValue={defaultGuests} placeholder="2" className={FIELD} {...aria("guests")} />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-sm text-slate-700">Message</span>
        <textarea
          name="message"
          required
          rows={5}
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
