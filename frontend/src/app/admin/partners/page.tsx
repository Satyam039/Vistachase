"use client";

// Admin: review partner applications, approve or suspend partners. Commission rate and the
// partner's Bokun booking channel can be set through PATCH /api/affiliates/admin/:id.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Partner {
  id: string;
  name: string;
  contactName: string;
  email: string;
  code: string;
  type: string;
  website: string | null;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  commissionRate: number;
  bokunChannelId: string | null;
  bookings: number;
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/affiliates/admin");
    if (!res.ok) {
      setError(res.status === 403 ? "Sign in with an admin account to manage partners." : "Couldn't load partners.");
      return;
    }
    setPartners((await res.json()).affiliates);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(p: Partner, status: Partner["status"]) {
    const res = await fetch(`/api/affiliates/admin/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setMessage(res.ok ? `${p.name} is now ${status.toLowerCase()}.` : `Couldn't update ${p.name}.`);
    await load();
  }

  return (
    <div className="bg-obsidian-50 px-page py-16 text-obsidian-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-ocean-600">Admin</p>
          <h1 className="text-4xl font-light">Partners</h1>
          <p className="text-base text-slate-700">Approve applications from the partner program. Bookings are only credited to active partners.</p>
        </div>
        {error && (
          <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
            {error}{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </p>
        )}
        <p aria-live="polite" className="text-base text-emerald-800">{message}</p>
        {partners && (
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600" tabIndex={0} role="region" aria-label="Partners">
            <table className="w-full text-left text-base">
              <thead className="border-b border-slate-200 text-sm uppercase tracking-widest text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3 font-normal">Partner</th>
                  <th scope="col" className="px-5 py-3 font-normal">Code</th>
                  <th scope="col" className="px-5 py-3 font-normal">Type</th>
                  <th scope="col" className="px-5 py-3 font-normal">Bookings</th>
                  <th scope="col" className="px-5 py-3 font-normal">Status</th>
                  <th scope="col" className="px-5 py-3 font-normal">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partners.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3">
                      <span className="block">{p.name}</span>
                      <span className="block text-sm text-slate-600">
                        {p.contactName} · {p.email}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-sm">{p.code}</td>
                    <td className="px-5 py-3 text-sm">{p.type.toLowerCase()}</td>
                    <td className="px-5 py-3">{p.bookings}</td>
                    <td className="px-5 py-3 text-sm">{p.status.toLowerCase()}</td>
                    <td className="px-5 py-3">
                      {p.status === "ACTIVE" ? (
                        <button type="button" onClick={() => setStatus(p, "SUSPENDED")} className="min-h-11 rounded-md border border-slate-300 px-4 text-sm hover:bg-slate-50">
                          Suspend <span className="sr-only">{p.name}</span>
                        </button>
                      ) : (
                        <button type="button" onClick={() => setStatus(p, "ACTIVE")} className="golden-summit-btn min-h-11 rounded-md px-4 text-sm">
                          Approve <span className="sr-only">{p.name}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
