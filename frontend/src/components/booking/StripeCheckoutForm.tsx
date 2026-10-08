"use client";

// Card payment with Stripe's Payment Element. Card details go straight from the browser to Stripe
// (PCI SAQ A); this page never sees them. The booking is confirmed by the backend when Stripe's
// webhook reports the payment, so onPaid only tells the checkout to wait for that confirmation.

import { useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@astryxdesign/core/Button";
import { FieldStatus } from "@astryxdesign/core/FieldStatus";
import { VStack } from "@astryxdesign/core/Stack";

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => (stripePromise ??= loadStripe(PUBLISHABLE_KEY));

export const stripeConfigured = PUBLISHABLE_KEY.length > 0;

function PayForm({ amountLabel, onPaid }: { amountLabel: string; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  const pay = async () => {
    if (!stripe || !elements) return;
    setIsPaying(true);
    setError("");
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || "Check your card details.");
      setIsPaying(false);
      return;
    }
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      // Cards that need a bank check (3-D Secure) return here afterwards.
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });
    if (confirmError) {
      setError(confirmError.message || "The payment didn't go through. Please try again.");
      setIsPaying(false);
      return;
    }
    onPaid();
  };

  return (
    <VStack gap={4}>
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <FieldStatus type="error" variant="detached" message={error} />}
      <Button label={`Pay ${amountLabel}`} variant="primary" width="100%" isLoading={isPaying} isDisabled={!stripe} onClick={pay} />
    </VStack>
  );
}

export function StripeCheckoutForm({ clientSecret, amountLabel, onPaid }: { clientSecret: string; amountLabel: string; onPaid: () => void }) {
  const options = useMemo(
    () => ({
      clientSecret,
      appearance: { theme: "stripe" as const, variables: { colorPrimary: "#1c1f23", fontFamily: "IBM Plex Sans, system-ui, sans-serif", borderRadius: "10px" } },
    }),
    [clientSecret],
  );
  return (
    <Elements stripe={getStripe()} options={options}>
      <PayForm amountLabel={amountLabel} onPaid={onPaid} />
    </Elements>
  );
}
