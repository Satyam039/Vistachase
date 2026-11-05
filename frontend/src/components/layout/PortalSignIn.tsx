"use client";

// The one sign-in card the three portals share (admin /admin/login, SEO /seo/login, partners
// /partners/login): drawn inside the portal's own frame, never the public website's. It signs in
// through the site's login (POST /api/auth/login: rate limited, sets the session cookie) and then
// asks `check` whether the account belongs to this portal; one that doesn't is signed straight
// back out.

import { useState, type ReactNode } from "react";
import { AlertCircle, Eye, EyeOff, Lock } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
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
      } else {
        const result = await check(data.user?.role);
        if ("go" in result) {
          // A full page load, not router.replace: the router may still hold the redirect to this
          // sign-in page that the middleware gave while signed out (prefetch), which sent people
          // straight back here with no error. A fresh request carries the new session cookie.
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

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-page py-12">
      <div className="w-full max-w-md bg-white p-8 ring-1 ring-obsidian-900/[0.07] sm:p-10">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-ocean-50 text-ocean-700">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-3xl font-light tracking-tight text-obsidian-900">{title}</h1>
        <p className="mt-2 text-base text-slate-600">{intro}</p>

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
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="mt-6 text-sm text-slate-600">{help}</div>

        {demo && process.env.NODE_ENV !== "production" && (
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
