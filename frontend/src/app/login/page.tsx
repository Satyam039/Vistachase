"use client";

// Sign in for guests only. Staff and partners have their own sign-in pages in their portals.
// Demo account shortcuts exist only in local development: they are compiled out of production
// builds so no credentials ship to the browser.

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
import { AUTH_FIELD, AuthShell } from "@/components/forms/AuthShell";
import { portalFor, safeNextFor, signInFor } from "@/lib/portals";

const DEV = process.env.NODE_ENV !== "production";

/** Back to the page that sent the guest here (?next=, e.g. /account/settings), else My Trips. */
function afterSignIn(role?: string) {
  const next = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("next");
  return safeNextFor(role, next) ?? "/account/trips";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "That email and password don't match.");
      } else if (data.requireOtp) {
        // Transition to OTP verification step
        setStep("otp");
        setOtp("");
      } else {
        // Fallback for direct logins (e.g. test environments)
        const portal = portalFor(data.user?.role);
        if (portal !== "customer") {
          await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
          setErrorMsg(`This is a staff or partner account. Sign in at ${signInFor(portal)} instead.`);
        } else {
          window.location.assign(afterSignIn(data.user?.role));
        }
      }
    } catch {
      setErrorMsg("We couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length !== 6) {
      setErrorMsg("Please enter the 6-digit verification code.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Invalid or expired verification code. Please try again.");
      } else {
        const portal = portalFor(data.user?.role);
        if (portal !== "customer") {
          await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
          setErrorMsg(`This is a staff or partner account. Sign in at ${signInFor(portal)} instead.`);
        } else {
          window.location.assign(afterSignIn(data.user?.role)); // full load so the middleware sees the new cookie
        }
      }
    } catch {
      setErrorMsg("We couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setErrorMsg("");
    setResending(true);
    setResendSuccess(false);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Failed to resend code. Please wait a moment and try again.");
      } else {
        setResendSuccess(true);
        setTimeout(() => setResendSuccess(false), 5000);
      }
    } catch {
      setErrorMsg("Failed to reach server. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      title={step === "otp" ? "Verification Code" : "Welcome back"}
      intro={
        step === "otp"
          ? `We sent a 6-digit verification code to ${email}. Valid for 10 minutes.`
          : "Sign in to see your trips, vouchers and pickup times."
      }
      footer={
        step === "otp" ? (
          <button
            type="button"
            onClick={() => {
              setStep("credentials");
              setErrorMsg("");
            }}
            className="inline-flex items-center gap-1.5 text-ocean-700 underline underline-offset-2 hover:text-ocean-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </button>
        ) : (
          <>
            New to Vista Chase?{" "}
            <Link href="/register" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-900">
              Create an account
            </Link>
          </>
        )
      }
    >
      {step === "credentials" ? (
        <form onSubmit={handleLogin} className="space-y-5">
          {errorMsg && (
            <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {errorMsg}
            </p>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-700">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={AUTH_FIELD}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-baseline justify-between text-sm text-slate-700">
              Password
              <Link href="/forgot-password" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-900">
                Forgot password?
              </Link>
            </span>
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
        <form onSubmit={handleVerifyOtp} className="space-y-5">
          {errorMsg && (
            <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {errorMsg}
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

          <div className="pt-2 text-center">
            <button
              type="button"
              disabled={resending}
              onClick={handleResendOtp}
              className="text-sm font-medium text-ocean-700 hover:text-ocean-900 disabled:opacity-50"
            >
              {resending ? "Sending new code…" : "Didn't receive a code? Resend"}
            </button>
          </div>
        </form>
      )}

      {DEV && step === "credentials" && (
        <div className="mt-6 rounded-2xl border border-dashed border-obsidian-900/15 p-4">
          <p className="text-sm text-slate-600">Local development only: fill a demo account</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { label: "Demo guest", email: "sarah.traveler@example.com", password: "Traveler2026!" },
            ].map((d) => (
              <button
                key={d.label}
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.password);
                }}
                className="h-10 rounded-full border border-obsidian-900/10 text-sm text-obsidian-900 hover:bg-obsidian-50"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  );
}
