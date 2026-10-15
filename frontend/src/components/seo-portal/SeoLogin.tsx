"use client";

// Sign in to the SEO portal. Uses the site's own login (POST /api/auth/login: rate limited, locks
// after repeated failures, sets the HttpOnly session cookie), then checks the account may use the
// portal. Accounts without an SEO role are signed straight back out. There is no sign-up here:
// accounts are created by an admin (Admin → Staff → invite).

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { AUTH_FIELD } from "@/components/forms/AuthShell";

/** Only same-portal paths are followed after sign-in. */
function safeNext(next: string | null) {
  return next && /^\/seo(\/[A-Za-z0-9/_-]*)?$/.test(next) && !next.startsWith("/seo/login") ? next : "/seo";
}

export function SeoLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const expired = params.get("expired") === "1";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(res.status === 429 ? "Too many attempts. Wait a few minutes, then try again." : data.error || "That email and password don't match.");
        return;
      }
      const me = await fetch("/api/seo/portal/me", { cache: "no-store" });
      if (!me.ok) {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        setError("This account doesn't have access to the SEO portal. Ask an admin to give you an SEO role.");
        return;
      }
      router.replace(safeNext(params.get("next")));
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-obsidian-950 px-page py-12">
      <div className="w-full max-w-md rounded-[1.75rem] bg-white p-8 sm:p-10">
        <div className="flex items-center gap-2.5">
          <BrandMark size={28} />
          <span className="text-base text-obsidian-900">Vista Chase</span>
        </div>
        <h1 className="mt-6 text-3xl font-light tracking-tight text-obsidian-900">SEO portal</h1>
        <p className="mt-2 text-base text-slate-600">For the Vista Chase SEO team. Accounts are created by an admin.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          {expired && !error && (
            <p role="status" className="rounded-xl bg-ocean-50 px-4 py-3 text-sm text-ocean-800">
              Your session ended. Sign in again to carry on.
            </p>
          )}
          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          <div>
            <label htmlFor="seo-email" className="mb-1.5 block text-sm text-slate-700">
              Email
            </label>
            <input id="seo-email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={AUTH_FIELD} />
          </div>
          <div>
            <span className="mb-1.5 flex items-baseline justify-between text-sm text-slate-700">
              <label htmlFor="seo-password">Password</label>
              <Link href="/forgot-password" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-900">
                Forgot password?
              </Link>
            </span>
            <span className="relative block">
              <input id="seo-password" type={show ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${AUTH_FIELD} pr-12`} />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-1.5 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 hover:bg-obsidian-50"
              >
                {show ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
              </button>
            </span>
          </div>
          <button type="submit" disabled={busy} className="h-12 w-full rounded-full bg-ocean-600 text-base text-white hover:bg-ocean-700 disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
