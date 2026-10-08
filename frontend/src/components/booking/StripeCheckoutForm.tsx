"use client";

import { useState } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/Button";

export function StripeCheckoutForm({
  clientSecret,
  onSuccess,
  totalAmount,
  currency,
}: {
  clientSecret: string;
  onSuccess: () => void;
  totalAmount: number;
  currency: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);
    setError("");

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || "An error occurred.");
      setIsProcessing(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        // Return URL is required, though we might not navigate if we handle it inline.
        // For a SPA flow without redirect, we can set redirect: "if_required"
        return_url: window.location.origin + "/booking/complete",
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message || "Payment failed.");
      setIsProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
      <Button
        type="submit"
        variant="primary"
        label={isProcessing ? "Processing..." : `Pay ${totalAmount} ${currency}`}
        isDisabled={!stripe || isProcessing}
        className="w-full"
      />
    </form>
  );
}
