"use client";

// Asks for an email and sends a one-time reset link (backend /api/auth/forgot-password). The reply
// is the same whether or not an account exists, so it can't be used to find accounts.

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, MailCheck } from "lucide-react";
import { AUTH_FIELD, AuthShell } from "@/components/forms/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) setErrorMsg("Too many requests. Please wait a few minutes and try again.");
      else if (!res.ok) setErrorMsg("Enter the email address you signed up with.");
      else setSent(true);
    } catch {
      setErrorMsg("We couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Forgot your password?"
      intro="Enter your email and we'll send you a link to choose a new one."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-900">
            Sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <p role="status" className="flex items-start gap-3 rounded-xl bg-ocean-50 px-4 py-4 text-base text-obsidian-900">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-ocean-700" aria-hidden="true" />
          If an account exists for {email}, a reset link is on its way. It works once and expires in an hour.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          {errorMsg && (
            <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {errorMsg}
            </p>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-700">Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={AUTH_FIELD} />
          </label>
          <button type="submit" disabled={loading} className="golden-summit-btn h-12 w-full rounded-full text-base disabled:opacity-60">
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
