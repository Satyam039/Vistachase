"use client";

// Sign in for guests, partners and staff. Each role lands on its own page afterwards.
// Demo account shortcuts exist only in local development: they are compiled out of production
// builds so no credentials ship to the browser.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { AUTH_FIELD, AuthShell } from "@/components/forms/AuthShell";

const DEV = process.env.NODE_ENV !== "production";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
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
      } else if (["ADMIN", "OPERATOR", "DISPATCHER"].includes(data.user?.role)) {
        router.push("/admin");
      } else if (data.user?.role === "AFFILIATE") {
        router.push("/partners/dashboard");
      } else {
        router.push("/account/trips");
      }
    } catch {
      setErrorMsg("We couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      intro="Sign in to see your trips, vouchers and pickup times."
      footer={
        <>
          New to Vista Chase?{" "}
          <Link href="/register" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-900">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleLogin} className="space-y-5">
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

      {DEV && (
        <div className="mt-6 rounded-2xl border border-dashed border-obsidian-900/15 p-4">
          <p className="text-sm text-slate-600">Local development only: fill a demo account</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { label: "Demo guest", email: "sarah.traveler@example.com", password: "Traveler2026!" },
              { label: "Demo admin", email: "admin@vistachase.com", password: "VistaChaseAdmin2026!" },
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
