"use client";

// Sets a new password with the one-time token from the reset email (?token=…).

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { AUTH_FIELD, AuthShell } from "@/components/forms/AuthShell";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (password.length < 8) return setErrorMsg("Use at least 8 characters.");
    if (password !== confirm) return setErrorMsg("The two passwords don't match.");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) setErrorMsg(data.error || "This reset link is invalid or has expired.");
      else setDone(true);
    } catch {
      setErrorMsg("We couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
        This page needs the link from your reset email. <Link href="/forgot-password" className="underline">Request a new link</Link>.
      </p>
    );
  }

  return done ? (
    <p role="status" className="flex items-start gap-3 rounded-xl bg-ocean-50 px-4 py-4 text-base text-obsidian-900">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ocean-700" aria-hidden="true" />
      <span>
        Your password is updated. <Link href="/login" className="text-ocean-700 underline underline-offset-2">Sign in</Link>
      </span>
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
        <span className="mb-1.5 block text-sm text-slate-700">New password</span>
        <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={AUTH_FIELD} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-slate-700">Confirm new password</span>
        <input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={AUTH_FIELD} />
      </label>
      <button type="submit" disabled={loading} className="golden-summit-btn h-12 w-full rounded-full text-base disabled:opacity-60">
        {loading ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      intro="Use at least 8 characters."
      footer={
        <Link href="/login" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-900">
          Back to sign in
        </Link>
      }
    >
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
