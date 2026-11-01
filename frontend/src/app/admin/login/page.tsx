"use client";

// Dedicated Admin Portal Sign In. Only admin and staff roles (ADMIN, OPERATOR, DISPATCHER) get through.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Lock, ShieldCheck } from "lucide-react";
import { AUTH_FIELD, AuthShell } from "@/components/forms/AuthShell";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ email, password, expectedPortal: "admin" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "That email and password don't match.");
      } else {
        const next = new URLSearchParams(window.location.search).get("next");
        if (next && next.startsWith("/admin") && !next.startsWith("/admin/login")) {
          router.push(next);
        } else {
          router.push("/admin");
        }
      }
    } catch {
      setErrorMsg("We couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Admin Portal"
      intro="Platform administration, fleet operations, bookings and staff controls."
      panelTitle="Centralized Platform Administration"
      perks={[
        "Dispatch manifests and real-time passenger tracking",
        "Tour departures, seat synchronization and Bókun controls",
        "Role-based staff access and comprehensive audit trails",
      ]}
      guestLink={false}
      footer={
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-ocean-700" aria-hidden="true" />
          <span>Restricted area. All access attempts are monitored and logged.</span>
        </div>
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
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Staff Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@vistachase.com"
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
          className="golden-summit-btn flex h-12 w-full items-center justify-center gap-2 rounded-full text-base font-medium disabled:opacity-60"
        >
          <Lock className="h-4 w-4" aria-hidden="true" />
          {loading ? "Authenticating…" : "Sign In to Admin Portal"}
        </button>
      </form>
    </AuthShell>
  );
}
