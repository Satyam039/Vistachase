"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, ChevronRight, AlertCircle, ShieldCheck } from "lucide-react";

export default function LoginPage() {
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
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Login failed");
      } else {
        if (data.user?.role === "ADMIN" || data.user?.role === "OPERATOR" || data.user?.role === "DISPATCHER") {
          router.push("/admin");
        } else {
          router.push("/account/trips");
        }
      }
    } catch {
      setErrorMsg("Network error during login");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-forest-950 shadow-glow font-bold text-xl">
            VC
          </div>
          <span className="font-display font-bold text-2xl tracking-wider text-forest-950">
            VISTA CHASE
          </span>
        </Link>
        <h1 className="text-2xl font-bold font-display text-forest-950">Guest &amp; Staff Login</h1>
        <p className="text-xs text-slate-500">Access your confirmed trips, vouchers, or dispatcher dashboard.</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-card rounded-3xl border border-slate-200 sm:px-10 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-forest-800"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-forest-800"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm text-forest-950 gold-gradient hover:opacity-95 shadow transition-all disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In to Account"}
            </button>
          </form>

          {/* Quick Demo Logins for Testing */}
          <div className="border-t border-slate-100 pt-4 space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block text-center">
              Quick Development Demo Logins
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => fillDemo("sarah.traveler@example.com", "Traveler2026!")}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left font-medium text-slate-700"
              >
                👤 Guest (Sarah J.)
              </button>
              <button
                type="button"
                onClick={() => fillDemo("admin@vistachase.com", "VistaChaseAdmin2026!")}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left font-medium text-slate-700"
              >
                🛡️ Admin Portal
              </button>
            </div>
          </div>

          <div className="text-center text-xs text-slate-600 pt-2 border-t border-slate-100">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-bold text-forest-800 hover:text-gold-600">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
