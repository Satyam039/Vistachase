"use client";

// Staff check-in from a voucher QR code. The code opens /admin/checkin?ref=…&sig=…; the server
// checks the signature, then marks the guest boarded. Needs a staff session.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface CheckedIn {
  bookingReference: string;
  customerName: string;
  totalSeats: number;
  experience?: string;
  date: string;
  departureTime: string;
}

function CheckIn() {
  const search = useSearchParams();
  const ref = search.get("ref") ?? "";
  const sig = search.get("sig") ?? "";
  const [result, setResult] = useState<{ booking?: CheckedIn; error?: string } | null>(null);

  useEffect(() => {
    if (!ref || !sig) {
      setResult({ error: "Scan the QR code on the guest's voucher." });
      return;
    }
    fetch("/api/admin/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref, sig }) })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) setResult({ error: "Sign in with a staff account to check guests in." });
        else if (!res.ok || !data.success) setResult({ error: data.error || "This voucher couldn't be checked in." });
        else setResult({ booking: data.booking });
      })
      .catch(() => setResult({ error: "We couldn't reach the server. Try again." }));
  }, [ref, sig]);

  if (!result) {
    return (
      <p className="flex items-center gap-2 text-base text-slate-700">
        <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Checking the voucher…
      </p>
    );
  }
  if (result.error || !result.booking) {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-2xl bg-red-50 p-5 text-base text-red-900">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <span>
          {result.error}{" "}
          {result.error?.startsWith("Sign in") && (
            <Link href="/login" className="underline">
              Sign in
            </Link>
          )}
        </span>
      </div>
    );
  }
  const b = result.booking;
  return (
    <div role="status" className="rounded-2xl bg-emerald-50 p-6 text-emerald-950">
      <p className="flex items-center gap-2 text-xl">
        <CheckCircle2 className="h-6 w-6 text-emerald-700" aria-hidden="true" /> Checked in
      </p>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base">
        <dt className="text-emerald-800">Guest</dt>
        <dd>{b.customerName}</dd>
        <dt className="text-emerald-800">Seats</dt>
        <dd>{b.totalSeats}</dd>
        <dt className="text-emerald-800">Trip</dt>
        <dd>
          {b.experience} · {b.date} {b.departureTime}
        </dd>
        <dt className="text-emerald-800">Booking</dt>
        <dd className="font-mono text-sm">{b.bookingReference}</dd>
      </dl>
    </div>
  );
}

export default function CheckInPage() {
  return (
    <main className="mx-auto max-w-xl px-page py-12">
      <h1 className="mb-6 text-3xl font-light text-obsidian-900">Voucher check-in</h1>
      <Suspense>
        <CheckIn />
      </Suspense>
      <p className="mt-8">
        <Link href="/admin/dispatch" className="text-ocean-700 underline underline-offset-2">
          Open the dispatch board
        </Link>
      </p>
    </main>
  );
}
