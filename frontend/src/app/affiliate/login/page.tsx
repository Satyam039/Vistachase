"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { AUTH_FIELD, AuthShell } from "@/components/forms/AuthShell";

export default function AffiliateLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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
        setErrorMsg(data.error || "That email and password don't match.");
      } else {
        const next = new URLSearchParams(window.location.search).get("next");
        if (next && next.startsWith("/affiliate") && !next.startsWith("/affiliate/login")) {
          window.location.assign(next);
        } else {
          window.location.assign("/affiliate/dashboard");
        }
      }
    } catch {
      setErrorMsg("We couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Affiliate Portal Sign In"
      intro="Your referral links, bookings, commission statements and payouts."
      panelTitle="Recommend the Rockies. Earn on every booking."
      perks={[
        "Custom referral links to any tour, shuttle or product",
        "30-day tracking window with accurate attribution",
        "Clear commission statements and direct payouts",
      ]}
      guestLink={false}
      footer={
        <>
          Not a partner yet?{" "}
          <Link href="/affiliate/register" className="text-ocean-700 font-medium underline underline-offset-2 hover:text-ocean-900">
            Apply to the partner program
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMsg && (
          <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {errorMsg}
          </p>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Partner Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={AUTH_FIELD}
          />
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
        <button
          type="submit"
          disabled={loading}
          className="golden-summit-btn h-12 w-full rounded-full text-base font-medium disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in to Affiliate Portal"}
        </button>
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={() => {
              setEmail("partner.demo@example.com");
              setPassword("PartnerDemo2026!");
            }}
            className="text-xs text-ocean-700 hover:text-ocean-900 underline underline-offset-2"
          >
            Fill Demo Partner: partner.demo@example.com
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
