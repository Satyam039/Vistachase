"use client";

// Email delivery at a glance on the bookings screen: whether booking confirmations really leave the
// server (Resend or an SMTP mailbox) or only go to the log, and, for admins and operators, a test
// message to their own address that reports the provider's exact error (GET/POST /api/admin/email/*).

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { adminApi, errorOf, quietBtn } from "@/components/admin/staff/shared";

interface EmailInfo {
  provider: "resend" | "smtp" | "console";
  configured: boolean;
  problem: string | null;
  from: string | null;
}

const PROVIDER_NAME: Record<EmailInfo["provider"], string> = { resend: "Resend", smtp: "SMTP", console: "the server log only" };

export function EmailStatus({ canTest }: { canTest: boolean }) {
  const [info, setInfo] = useState<EmailInfo | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void adminApi<{ email: EmailInfo }>("/email/status").then((res) => {
      if (res.ok) setInfo(res.data.email);
    });
  }, []);

  if (!info) return null;

  const sendTest = async () => {
    setSending(true);
    setResult(null);
    const res = await adminApi<{ to: string }>("/email/test", "POST");
    setSending(false);
    setResult(res.ok ? { ok: true, text: `Test email sent to ${res.data.to}. Check that inbox (and spam).` } : { ok: false, text: errorOf(res.data, "The test email couldn't be sent.") });
  };

  return (
    <section
      aria-labelledby="email-status-title"
      className={`rounded-2xl px-5 py-4 text-sm ring-1 ${info.configured ? "bg-white ring-obsidian-900/[0.06]" : "bg-amber-50 text-amber-900 ring-amber-200"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 items-start gap-2.5">
          <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span id="email-status-title" className="font-medium">
              Booking emails: {info.configured ? "on" : "off"}
            </span>
            {info.configured ? (
              <span className="text-slate-600">
                {" "}
                · sent through {PROVIDER_NAME[info.provider]}
                {info.from ? ` from ${info.from}` : ""}. Guests get their confirmation with the PDF itinerary as soon as a booking is confirmed.
              </span>
            ) : (
              <span>
                {" "}
                · confirmations only go to the server log ({info.problem}). Set EMAIL_PROVIDER=smtp with SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS (or
                EMAIL_PROVIDER=resend with RESEND_API_KEY) in the backend settings, then restart the backend.
              </span>
            )}
          </span>
        </p>
        {canTest && info.configured && (
          <button type="button" className={quietBtn} onClick={sendTest} disabled={sending}>
            {sending ? "Sending…" : "Send test email"}
          </button>
        )}
      </div>
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`mt-3 ${result.ok ? "text-emerald-800" : "text-red-800"}`}>
          {result.text}
        </p>
      )}
    </section>
  );
}
