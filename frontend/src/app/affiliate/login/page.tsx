"use client";

// Partner sign-in: email + password, then the 6-digit code the API emails (owner, 2026-11-18: the
// code was sent but there was nowhere to type it). Partners whose application isn't approved yet
// (or was turned down, or is paused) get a pop-up saying so instead of a code.

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Hourglass, KeyRound } from "lucide-react";
import { AUTH_FIELD, AuthShell } from "@/components/forms/AuthShell";
import { ModalDialog } from "@/components/forms/ModalDialog";

const DEV = process.env.NODE_ENV !== "production";

type PartnerStatus = "PENDING" | "REJECTED" | "SUSPENDED";
const NOTICE_TITLE: Record<PartnerStatus, string> = {
  PENDING: "Approval in progress",
  REJECTED: "Application not approved",
  SUSPENDED: "Account paused",
};

function goToDashboard() {
  const next = new URLSearchParams(window.location.search).get("next");
  if (next && next.startsWith("/affiliate") && !next.startsWith("/affiliate/login")) {
    window.location.assign(next);
  } else {
    window.location.assign("/affiliate/dashboard");
  }
}

export default function AffiliateLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [notice, setNotice] = useState<{ status: PartnerStatus; message: string } | null>(null);

  function showResult(data: { error?: string; partnerStatus?: PartnerStatus }, fallback: string) {
    if (data.partnerStatus) {
      setNotice({ status: data.partnerStatus, message: data.error || "Your partner account hasn't been approved yet." });
      setStep("credentials");
    } else {
      setErrorMsg(data.error || fallback);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, expectedPortal: "affiliate" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showResult(data, "That email and password don't match.");
      } else if (data.requireOtp) {
        setOtp("");
        setResent(false);
        setStep("otp");
      } else {
        goToDashboard();
      }
    } catch {
      setErrorMsg("We couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      setErrorMsg("Please enter the 6-digit code from your email.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otp.trim(), expectedPortal: "affiliate" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showResult(data, "That code is wrong or has expired. Please try again.");
      } else {
        goToDashboard(); // full load so the middleware sees the new cookie
      }
    } catch {
      setErrorMsg("We couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setErrorMsg("");
    setResending(true);
    setResent(false);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) setErrorMsg(data.error || "Couldn't send a new code. Please wait a moment and try again.");
      else setResent(true);
    } catch {
      setErrorMsg("We couldn't reach the server. Please try again.");
    } finally {
      setResending(false);
    }
  }

  const alert = errorMsg && (
    <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      {errorMsg}
    </p>
  );

  return (
    <AuthShell
      title={step === "otp" ? "Enter your sign-in code" : "Affiliate Portal Sign In"}
      intro={step === "otp" ? `We emailed a 6-digit code to ${email}. It works for 10 minutes.` : "Your referral links, bookings, commission statements and payouts."}
      panelTitle="Recommend the Rockies. Earn on every booking."
      perks={[
        "Custom referral links to any tour, shuttle or product",
        "30-day tracking window with accurate attribution",
        "Clear commission statements and direct payouts",
      ]}
      guestLink={false}
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
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to sign in
          </button>
        ) : (
          <>
            Not a partner yet?{" "}
            <Link href="/affiliate/register" className="text-ocean-700 font-medium underline underline-offset-2 hover:text-ocean-900">
              Apply to the partner program
            </Link>
          </>
        )
      }
    >
      {step === "credentials" ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          {alert}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Partner Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={AUTH_FIELD} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={AUTH_FIELD}
            />
          </label>
          <button type="submit" disabled={loading} className="golden-summit-btn h-12 w-full rounded-full text-base font-medium disabled:opacity-60">
            {loading ? "Signing in…" : "Sign in to Affiliate Portal"}
          </button>
          {DEV && (
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => {
                  setEmail("partner.demo@example.com");
                  setPassword("PartnerDemo2026!");
                }}
                className="text-xs text-ocean-700 hover:text-ocean-900 underline underline-offset-2"
              >
                Local development only: fill the demo partner
              </button>
            </div>
          )}
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-5">
          {alert}
          {resent && (
            <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              We sent a new code to your email.
            </p>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">6-digit code</span>
            <span className="relative block">
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
                className={`${AUTH_FIELD} text-center font-mono text-2xl tracking-[0.4em] placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400`}
              />
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            </span>
            <span className="mt-1.5 block text-xs text-slate-600">Can&apos;t see it after a minute? Check your spam or junk folder.</span>
          </label>
          <button type="submit" disabled={loading || otp.length !== 6} className="golden-summit-btn h-12 w-full rounded-full text-base font-medium disabled:opacity-60">
            {loading ? "Checking code…" : "Verify and sign in"}
          </button>
          <div className="text-center">
            <button type="button" disabled={resending} onClick={handleResend} className="text-sm text-ocean-700 hover:text-ocean-900 disabled:opacity-50">
              {resending ? "Sending a new code…" : "Didn't get a code? Send a new one"}
            </button>
          </div>
        </form>
      )}

      <ModalDialog
        open={!!notice}
        onClose={() => setNotice(null)}
        title={notice ? NOTICE_TITLE[notice.status] : ""}
        icon={
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-summit-100 text-obsidian-900">
            <Hourglass className="h-6 w-6" aria-hidden="true" />
          </span>
        }
        actions={
          <>
            <Link href="/contact-us" className="inline-flex h-11 items-center rounded-full border border-obsidian-900/10 px-5 text-sm text-obsidian-900 hover:bg-obsidian-50">
              Contact us
            </Link>
            <button type="button" onClick={() => setNotice(null)} className="golden-summit-btn inline-flex h-11 items-center rounded-full px-6 text-sm">
              OK
            </button>
          </>
        }
      >
        <p>{notice?.message}</p>
      </ModalDialog>
    </AuthShell>
  );
}
