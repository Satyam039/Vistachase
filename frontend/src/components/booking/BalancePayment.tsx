"use client";

// "Pay balance" on the voucher of a deposit booking. The backend creates (or resumes) a Stripe
// PaymentIntent for exactly what is still owed; the booking is updated when Stripe's webhook
// reports the payment, so after paying we poll the booking until the balance reads zero.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard } from "lucide-react";
import { StripeCheckoutForm, stripeConfigured } from "@/components/booking/StripeCheckoutForm";

const money = (n: number) => `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Stage =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "paying"; clientSecret: string; amount: number; currency: string }
  | { kind: "confirming" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export function BalancePayment({
  bookingReference,
  token,
  balanceDue,
  currency,
  dueLabel,
}: {
  bookingReference: string;
  token?: string;
  balanceDue: number;
  currency: string;
  dueLabel: string | null;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: "idle" });

  const bookingUrl = `/api/bookings?ref=${encodeURIComponent(bookingReference)}${token ? `&t=${encodeURIComponent(token)}` : ""}`;

  async function start() {
    setStage({ kind: "starting" });
    const res = await fetch("/api/bookings/pay-balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingReference, ...(token ? { t: token } : {}) }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    if (!res?.ok || !data?.success) {
      setStage({ kind: "error", message: data?.error || "We couldn't start the payment. Please try again or call us." });
      return;
    }
    if (data.paid) {
      setStage({ kind: "done" });
      router.refresh();
      return;
    }
    if (!stripeConfigured) {
      setStage({ kind: "error", message: "Online payment isn't available right now. Please call us to pay the balance." });
      return;
    }
    setStage({ kind: "paying", clientSecret: data.clientSecret, amount: data.amount, currency: data.currency });
  }

  /** Stripe accepted the card; wait (up to about a minute) for the webhook to record it. */
  async function waitForBalance() {
    setStage({ kind: "confirming" });
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(bookingUrl, { cache: "no-store" }).catch(() => null);
      const data = res?.ok ? await res.json().catch(() => null) : null;
      if (data?.booking && Number(data.booking.balanceDue ?? 0) <= 0) {
        setStage({ kind: "done" });
        router.refresh();
        return;
      }
    }
    // Paid at Stripe but not recorded yet: say so plainly rather than asking them to pay again.
    setStage({
      kind: "error",
      message: "Your payment went through and is still being recorded. Refresh this page in a few minutes; there's no need to pay again.",
    });
  }

  if (stage.kind === "done") {
    return (
      <p className="flex items-start gap-2.5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
        Balance paid. Thank you! A receipt is on its way to your inbox.
      </p>
    );
  }

  return (
    <div className="space-y-3 print:hidden">
      {stage.kind === "paying" ? (
        <StripeCheckoutForm
          clientSecret={stage.clientSecret}
          amountLabel={`${money(stage.amount)} ${stage.currency}`}
          onPaid={waitForBalance}
        />
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={stage.kind === "starting" || stage.kind === "confirming"}
          className="golden-summit-btn inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm disabled:opacity-60"
        >
          <CreditCard className="h-4 w-4" aria-hidden="true" />
          {stage.kind === "starting"
            ? "Starting secure payment…"
            : stage.kind === "confirming"
            ? "Confirming your payment…"
            : `Pay balance ${money(balanceDue)} ${currency}`}
        </button>
      )}
      {dueLabel && stage.kind !== "confirming" && <p className="text-xs text-slate-600">Due by {dueLabel}.</p>}
      {stage.kind === "error" && (
        <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-200">
          {stage.message}
        </p>
      )}
    </div>
  );
}
