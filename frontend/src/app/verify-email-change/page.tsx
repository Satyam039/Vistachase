"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { AuthShell } from "@/components/forms/AuthShell";

function ConfirmEmailChange() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [errorMsg, setErrorMsg] = useState("");
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    fetch("/api/account/verify-email-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          setState("done");
        } else {
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
          {token ? errorMsg : "This page needs the verification link from your email."} You can request a new change from{" "}
          <Link href="/account/settings" className="underline">
            Account Settings
          </Link>
          .
        </span>
      </p>
    );
  }

  return state === "done" ? (
    <div className="space-y-4">
      <p role="status" className="flex items-start gap-3 rounded-xl bg-ocean-50 px-4 py-4 text-base text-obsidian-900">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ocean-700" aria-hidden="true" />
        <span>
          Your email address has been successfully updated. A confirmation has been sent to both your new and previous email addresses.
        </span>
      </p>
      <div className="pt-2 text-center">
        <Link
          href="/account/settings"
          className="golden-summit-btn inline-flex h-11 items-center justify-center rounded-full px-6 text-sm"
        >
          Go to Account Settings
        </Link>
      </div>
    </div>
  ) : (
    <p role="status" className="text-base text-slate-700">
      Confirming your new email address…
    </p>
  );
}

export default function VerifyEmailChangePage() {
  return (
    <AuthShell
      title="Confirm Email Change"
      intro="Verifying your new Vista Chase account email."
      footer={
        <Link href="/account/trips" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-900">
          My trips & vouchers
        </Link>
      }
    >
      <Suspense>
        <ConfirmEmailChange />
      </Suspense>
    </AuthShell>
  );
}
