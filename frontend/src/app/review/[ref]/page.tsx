"use client";

// Post-trip review from the link in the follow-up email (/review/<ref>?t=<signed token>). Only
// the guest who made the booking can review it, and only after the trip.

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Star } from "lucide-react";
import { AUTH_FIELD, AuthShell } from "@/components/forms/AuthShell";

function ReviewForm({ reference }: { reference: string }) {
  const token = useSearchParams().get("t") ?? undefined;
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!rating) return setErrorMsg("Choose a star rating.");
    setLoading(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingReference: reference, rating, title, body, authorName: authorName || undefined, t: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) setErrorMsg(data.error || "We couldn't save your review.");
      else setDone(true);
    } catch {
      setErrorMsg("We couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <p role="status" className="flex items-start gap-3 rounded-xl bg-ocean-50 px-4 py-4 text-base text-obsidian-900">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ocean-700" aria-hidden="true" />
        Thank you! Your review helps other travellers plan their Rockies day.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {errorMsg && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {errorMsg}
        </p>
      )}
      <fieldset>
        <legend className="mb-1.5 block text-sm text-slate-700">Your rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-pressed={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-obsidian-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean-600"
            >
              <Star className={`h-7 w-7 ${n <= rating ? "fill-summit-500 text-summit-500" : "text-slate-300"}`} aria-hidden="true" />
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-700">Title</span>
        <input required minLength={2} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The day in a few words" className={AUTH_FIELD} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-700">Your review</span>
        <textarea
          required
          minLength={10}
          maxLength={3000}
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded-xl border border-obsidian-900/10 bg-white px-4 py-3 text-base text-obsidian-900 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/30"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-700">Name to show (optional)</span>
        <input maxLength={80} value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="e.g. Sarah J." className={AUTH_FIELD} />
      </label>
      <button type="submit" disabled={loading} className="golden-summit-btn h-12 w-full rounded-full text-base disabled:opacity-60">
        {loading ? "Sending…" : "Post review"}
      </button>
    </form>
  );
}

export default function ReviewPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = use(params);
  return (
    <AuthShell
      title="How was your day?"
      intro={`Booking ${decodeURIComponent(ref)}`}
      footer={
        <Link href="/" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-900">
          Back to Vista Chase
        </Link>
      }
    >
      <Suspense>
        <ReviewForm reference={decodeURIComponent(ref)} />
      </Suspense>
    </AuthShell>
  );
}
