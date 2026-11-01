"use client";

// Staff sign in for the admin portal, separate from the guests' /login. Only admin, operator and
// dispatcher accounts get in; anyone else is signed straight out again. Drawn inside the admin
// portal frame (PortalFrame), so nothing here leads to the public website.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Lock } from "lucide-react";
import { AUTH_FIELD } from "@/components/forms/AuthShell";
import { portalFor, safeNextFor } from "@/lib/portals";

const DEV = process.env.NODE_ENV !== "production";

export default function AdminLoginPage() {
  const router = useRouter();
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
      const data = await res.json();
      const role = data.user?.role as string | undefined;
      if (!res.ok || !data.success) {
        setError(data.error || "That email and password don't match.");
      } else if (portalFor(role) !== "admin") {
        // Not a staff account: don't leave it signed in here.
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        setError("This isn't a staff account. Use your admin, operator or dispatcher sign-in.");
      } else {
        const next = new URLSearchParams(window.location.search).get("next");
        router.push(safeNextFor(role, next) ?? "/admin");
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
        <h1 className="mt-5 text-3xl font-light tracking-tight text-obsidian-900">Staff sign in</h1>
        <p className="mt-2 text-base text-slate-600">Bookings, departures, dispatch and operations.</p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-700">Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={AUTH_FIELD} />
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
        <p className="mt-6 text-sm text-slate-600">Forgot your password? Ask an admin for a new password link (Staff → Password link).</p>

        {DEV && (
          <button
            type="button"
            onClick={() => {
              setEmail("admin@vistachase.com");
              setPassword("VistaChaseAdmin2026!");
            }}
            className="mt-4 h-10 w-full rounded-full border border-dashed border-obsidian-900/15 text-sm text-slate-600 hover:bg-obsidian-50"
          >
            Local development only: fill the demo admin
          </button>
        )}
      </div>
    </div>
  );
}
