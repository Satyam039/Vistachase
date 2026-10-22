"use client";

// Confirms the account's email with the one-time token from the welcome email (?token=…). Once
// confirmed, bookings made with that email show under My trips.

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { AuthShell } from "@/components/forms/AuthShell";

function Confirm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [errorMsg, setErrorMsg] = useState("");
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true; // the token works once, so never post it twice (React strict mode)
    fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) setState("done");
        else {
          setErrorMsg(data.error || "This confirmation link is invalid or has already been used.");
          setState("error");
        }
      })
      .catch(() => {
        setErrorMsg("We couldn't reach the server. Please try again.");
        setState("error");
      });
  }, [token]);

  if (!token || state === "error") {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          {token ? errorMsg : "This page needs the link from your confirmation email."} You can send a new link from{" "}
          <Link href="/account/trips" className="underline">
            My trips
          </Link>
          .
        </span>
      </p>
    );
  }

  return state === "done" ? (
    <p role="status" className="flex items-start gap-3 rounded-xl bg-ocean-50 px-4 py-4 text-base text-obsidian-900">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ocean-700" aria-hidden="true" />
      <span>
        Your email is confirmed. Bookings made with it now show under{" "}
        <Link href="/account/trips" className="text-ocean-700 underline underline-offset-2">
          My trips
        </Link>
        .
      </span>
    </p>
  ) : (
    <p role="status" className="text-base text-slate-700">
      Confirming your email…
    </p>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell
      title="Confirm your email"
      intro="One click and your bookings follow your account."
      footer={
        <Link href="/login" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-900">
          Sign in
        </Link>
      }
    >
      <Suspense>
        <Confirm />
      </Suspense>
    </AuthShell>
  );
}
