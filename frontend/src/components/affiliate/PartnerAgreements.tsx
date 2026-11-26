"use client";

// Partner dashboard → Settings → Partner agreement: every version of the partner's agreement
// (contract) the Vista Chase team sent, newest first, each as a PDF download.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";

interface Agreement {
  id: string;
  version: number;
  commissionPercent: number;
  products: string[];
  sentAt: string | null;
  createdAt: string;
}

const when = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });

export function PartnerAgreements() {
  const [agreements, setAgreements] = useState<Agreement[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/affiliates/me/contracts")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        setAgreements((await r.json()).contracts ?? []);
      })
      .catch(() => setError("Couldn't load your partner agreement. Try again in a moment."));
  }, []);

  return (
    <section aria-labelledby="agreements-heading" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 id="agreements-heading" className="text-lg font-light text-slate-900">Partner agreement</h2>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!agreements ? (
        !error && <p className="text-sm text-slate-500">Loading…</p>
      ) : agreements.length === 0 ? (
        <p className="text-sm text-slate-600">No agreement yet. The Vista Chase team sends it by email when your commission is set.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {agreements.map((a, i) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm text-slate-900">
                  Version {a.version}
                  {i === 0 ? " (current)" : ""} · {a.commissionPercent}% commission
                </p>
                <p className="text-xs text-slate-500">
                  {a.products.join(", ")} · sent {when(a.sentAt ?? a.createdAt)}
                </p>
              </div>
              <a
                href={`/api/affiliates/me/contracts/${a.version}/pdf`}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 text-xs font-medium text-slate-800 hover:border-slate-500"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download PDF <span className="sr-only">version {a.version}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-500">
        Want something changed? <Link href="/affiliate/requests?category=COMMISSION" className="text-ocean-700 underline underline-offset-2">Send a change request</Link>.
      </p>
    </section>
  );
}
