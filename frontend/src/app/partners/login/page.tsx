"use client";

// Partner sign in (shared sign-in layout). Only partner and admin accounts get through.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { AUTH_FIELD, AuthShell } from "@/components/forms/AuthShell";

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
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok || !data.success) setError(data.error || "That email and password don't match.");
      else if (data.user?.role !== "AFFILIATE" && data.user?.role !== "ADMIN") setError("This isn't a partner account. Apply to the partner program first.");
      else router.push(data.user.role === "ADMIN" ? "/admin/partners" : "/partners/dashboard");
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Partner sign in"
      intro="Your links, referred bookings and earnings."
      panelTitle="Recommend the Rockies. Earn on every booking."
      perks={["Links to any tour or the whole site", "Bookings count for 30 days after a click", "Referred bookings and earnings in one dashboard"]}
      guestLink={false}
      footer={
        <>
          Not a partner yet?{" "}
          <Link href="/partners#apply" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-900">
            Apply to the partner program
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-700">Email</span>
          <input name="email" type="email" required autoComplete="email" className={AUTH_FIELD} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-700">Password</span>
          <input name="password" type="password" required autoComplete="current-password" className={AUTH_FIELD} />
        </label>
        <button type="submit" disabled={loading} className="golden-summit-btn h-12 w-full rounded-full text-base disabled:opacity-60">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
