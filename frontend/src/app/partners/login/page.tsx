"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, LogIn } from "lucide-react";

const field =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-obsidian-900 focus:border-ocean-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600";

export default function PartnerLoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Sign in failed.");
      } else if (data.user?.role !== "AFFILIATE" && data.user?.role !== "ADMIN") {
        setError("This account isn't a partner account. Apply to the partner program first.");
      } else {
        router.push(data.user.role === "ADMIN" ? "/admin/partners" : "/partners/dashboard");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-obsidian-50 px-page py-20">
      <div className="mx-auto max-w-md space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-ocean-600">Vista Chase partners</p>
          <h1 className="text-4xl font-light text-obsidian-900">Partner sign in</h1>
          <p className="text-base text-slate-700">Your links, referred bookings and earnings.</p>
        </div>
        <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          <div className="space-y-1.5">
            <label htmlFor="partner-login-email" className="text-sm text-slate-700">Email</label>
            <input id="partner-login-email" name="email" type="email" required autoComplete="email" className={field} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="partner-login-password" className="text-sm text-slate-700">Password</label>
            <input id="partner-login-password" name="password" type="password" required autoComplete="current-password" className={field} />
          </div>
          <button type="submit" disabled={loading} className="golden-summit-btn inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-sm uppercase tracking-[0.14em] disabled:opacity-60">
            <LogIn className="h-4 w-4" aria-hidden="true" />
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-base text-slate-700">
          Not a partner yet?{" "}
          <Link href="/partners#apply" className="text-ocean-600 underline underline-offset-4">
            Apply to the partner program
          </Link>
        </p>
      </div>
    </div>
  );
}
