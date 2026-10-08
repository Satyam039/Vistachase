// Card payments. Production uses Stripe (PAYMENT_PROVIDER=stripe + STRIPE_SECRET_KEY): the server
// creates a PaymentIntent for the amount it computed, the browser pays with Stripe's Payment
// Element, and the Stripe webhook (routes/webhooks.routes.ts) confirms the booking. The mock
// provider pays instantly and only runs outside production (or with FEATURE_MOCK_PAYMENT=true on
// a staging site).

import Stripe from "stripe";

export interface PaymentIntentRequest {
  amount: number; // cents, e.g. 15000 = $150.00
  currency: string;
  bookingReference: string;
  customerEmail: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  intentId: string;
  amount: number;
  currency: string;
  /** True when the payment is already complete (mock); otherwise the guest pays in the browser. */
  paid: boolean;
}

export interface IPaymentProvider {
  readonly name: "mock" | "stripe";
  createPaymentIntent(req: PaymentIntentRequest): Promise<PaymentIntentResponse>;
  /** Refunds `amount` cents (all of it when omitted) of the payment with this intent or charge ID. */
  refundPayment(transactionId: string, amount?: number): Promise<{ success: boolean; refundId: string }>;
}

class MockPaymentProvider implements IPaymentProvider {
  readonly name = "mock" as const;

  private assertAllowed() {
    if (process.env.NODE_ENV === "production" && process.env.FEATURE_MOCK_PAYMENT !== "true") {
      throw new Error("Mock payments are disabled in production.");
    }
  }

  async createPaymentIntent(req: PaymentIntentRequest): Promise<PaymentIntentResponse> {
    this.assertAllowed();
    const intentId = `pi_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return { clientSecret: "", intentId, amount: req.amount, currency: req.currency.toUpperCase(), paid: true };
  }

  async refundPayment(): Promise<{ success: boolean; refundId: string }> {
    this.assertAllowed();
    return { success: true, refundId: `re_mock_${Date.now()}` };
  }
}

class StripePaymentProvider implements IPaymentProvider {
  readonly name = "stripe" as const;
  private stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey);
  }

  async createPaymentIntent(req: PaymentIntentRequest): Promise<PaymentIntentResponse> {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: req.amount,
        currency: req.currency.toLowerCase(),
        receipt_email: req.customerEmail,
        automatic_payment_methods: { enabled: true },
        metadata: { bookingReference: req.bookingReference, ...req.metadata },
      },
      // One intent per booking even if the request is retried.
      { idempotencyKey: `booking-${req.bookingReference}` },
    );
    return {
      clientSecret: intent.client_secret || "",
      intentId: intent.id,
      amount: req.amount,
      currency: req.currency.toUpperCase(),
      paid: intent.status === "succeeded",
    };
  }

  async refundPayment(transactionId: string, amount?: number): Promise<{ success: boolean; refundId: string }> {
    const target = transactionId.startsWith("pi_") ? { payment_intent: transactionId } : { charge: transactionId };
    const refund = await this.stripe.refunds.create({ ...target, ...(amount ? { amount } : {}) });
    return { success: refund.status === "succeeded" || refund.status === "pending", refundId: refund.id };
  }
}

let paymentInstance: IPaymentProvider | null = null;

export function getPaymentProvider(): IPaymentProvider {
  if (paymentInstance) return paymentInstance;
  if (process.env.PAYMENT_PROVIDER === "stripe") {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error("PAYMENT_PROVIDER=stripe needs STRIPE_SECRET_KEY.");
    paymentInstance = new StripePaymentProvider(process.env.STRIPE_SECRET_KEY);
  } else {
    paymentInstance = new MockPaymentProvider();
  }
  return paymentInstance;
}

/** Tests only: replace the provider (or pass null to pick it from env again). */
export function setPaymentProviderForTests(provider: IPaymentProvider | null) {
  paymentInstance = provider;
}
