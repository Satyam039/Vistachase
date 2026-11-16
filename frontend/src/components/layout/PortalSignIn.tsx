"use client";

// The one sign-in card the three portals share (admin /admin/login, SEO /seo/login, partners
// /partners/login): drawn inside the portal's own frame, never the public website's. It signs in
// through the site's login (POST /api/auth/login: rate limited, sets the session cookie) and then
// asks `check` whether the account belongs to this portal; one that doesn't is signed straight
// back out.

import { useState, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import { AUTH_FIELD } from "@/components/forms/AuthShell";

export type SignInCheck = (role: string | undefined) => Promise<{ go: string } | { error: string }>;

export function PortalSignIn({
  title,
  intro,
  help,
  notice,
  check,
  demo,
}: {
  title: string;
  intro: string;
  help: ReactNode;
  notice?: ReactNode;
  check: SignInCheck;
  /** Local development only: a button that fills a demo account. */
  demo?: { label: string; email: string; password: string };
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setError("Too many sign-in attempts. Wait 5 minutes, then try again.");
      } else if (!res.ok || !data.success) {
        setError(data.error || "That email and password don't match.");
      } else if (data.requireOtp) {
        setStep("otp");
        setOtp("");
      } else {
        const result = await check(data.user?.role);
        if ("go" in result) {
          window.location.replace(result.go);
          return;
        }
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        setError(result.error);
      }
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length !== 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otp.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error || "Invalid or expired verification code. Please try again.");
      } else {
        const result = await check(data.user?.role);
        if ("go" in result) {
          window.location.replace(result.go);
          return;
        }
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        setError(result.error);
      }
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setError("");
    setResending(true);
    setResendSuccess(false);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to resend code.");
      } else {
        setResendSuccess(true);
        setTimeout(() => setResendSuccess(false), 5000);
      }
    } catch {
      setError("Failed to reach server. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-page py-12">
      <div className="w-full max-w-md bg-white p-8 ring-1 ring-obsidian-900/[0.07] sm:p-10">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-ocean-50 text-ocean-700">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-3xl font-light tracking-tight text-obsidian-900">
          {step === "otp" ? "Verification Code" : title}
        </h1>
        <p className="mt-2 text-base text-slate-600">
          {step === "otp" ? `We sent a 6-digit verification code to ${email}. Valid for 10 minutes.` : intro}
        </p>

        {step === "credentials" ? (
          <form onSubmit={submit} className="mt-8 space-y-5">
            {notice && !error && (
              <p role="status" className="rounded-xl bg-ocean-50 px-4 py-3 text-sm text-ocean-800">
                {notice}
              </p>
            )}
            {error && (
              <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-700">Email</span>
              <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={AUTH_FIELD} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-700">Password</span>
              <span className="relative block">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${AUTH_FIELD} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 hover:bg-obsidian-50"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                </button>
              </span>
            </label>
            <button type="submit" disabled={loading} className="golden-summit-btn h-12 w-full rounded-full text-base disabled:opacity-60">
              {loading ? "Checking credentials…" : "Continue with Email"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitOtp} className="mt-8 space-y-5">
            {error && (
              <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}
            {resendSuccess && (
              <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                A fresh verification code has been sent to your email.
              </p>
            )}
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">6-Digit Verification Code</span>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className={`${AUTH_FIELD} font-mono text-center text-2xl tracking-[0.4em] font-semibold text-obsidian-900 placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-300`}
                />
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              </div>
              <span className="mt-1.5 block text-xs text-slate-500">Check your spam or junk folder if you don&apos;t see the email within 1 minute.</span>
            </label>

            <button type="submit" disabled={loading || otp.length !== 6} className="golden-summit-btn h-12 w-full rounded-full text-base disabled:opacity-60">
              {loading ? "Verifying code…" : "Verify and Sign In"}
            </button>

            <div className="flex items-center justify-between pt-2 text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("credentials");
                  setError("");
                }}
                className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </button>
              <button
                type="button"
                disabled={resending}
                onClick={handleResendOtp}
                className="font-medium text-ocean-700 hover:text-ocean-900 disabled:opacity-50"
              >
                {resending ? "Sending…" : "Resend code"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 text-sm text-slate-600">{help}</div>

        {demo && step === "credentials" && process.env.NODE_ENV !== "production" && (
          <button
            type="button"
            onClick={() => {
              setEmail(demo.email);
              setPassword(demo.password);
            }}
            className="mt-4 h-10 w-full rounded-full border border-dashed border-obsidian-900/15 text-sm text-slate-600 hover:bg-obsidian-50"
          >
            Local development only: {demo.label}
          </button>
        )}
      </div>
    </div>
  );
}
