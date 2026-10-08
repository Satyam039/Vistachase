"use client";

// Create a guest account (same layout as sign in). Phone is optional, as in the API; passwords
// need at least 8 characters (checked here and by the API).

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { AUTH_FIELD, AuthShell } from "@/components/forms/AuthShell";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const tooShort = password.length > 0 && password.length < 8;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (password.length < 8) {
      setErrorMsg("Use a password of at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone: phone || undefined, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) setErrorMsg(data.error || "We couldn't create your account.");
      else router.push("/account/trips");
    } catch {
      setErrorMsg("We couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      intro="Keep every booking, voucher and pickup time in one place."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-900">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleRegister} className="space-y-5">
        {errorMsg && (
          <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {errorMsg}
          </p>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-700">Full name</span>
          <input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sarah Jenkins" className={AUTH_FIELD} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-700">Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={AUTH_FIELD} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-700">
            Mobile phone <span className="text-slate-500">(optional, for pickup updates)</span>
          </span>
          <input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 403 555 0192" className={AUTH_FIELD} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-700">Password</span>
          <span className="relative block">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="password-hint"
              aria-invalid={tooShort || undefined}
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
          <span id="password-hint" className={`mt-1.5 block text-sm ${tooShort ? "text-red-700" : "text-slate-600"}`}>
            At least 8 characters
          </span>
        </label>
        <button type="submit" disabled={loading} className="golden-summit-btn h-12 w-full rounded-full text-base disabled:opacity-60">
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
