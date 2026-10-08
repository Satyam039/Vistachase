export interface PaymentIntentRequest {
  amount: number; // in cents or currency base units (e.g. 15000 = $150.00 CAD)
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
  status: "requires_payment_method" | "succeeded" | "requires_action";
}

export interface IPaymentProvider {
  createPaymentIntent(req: PaymentIntentRequest): Promise<PaymentIntentResponse>;
  confirmPayment(intentId: string): Promise<{ success: boolean; transactionId: string; status: string }>;
  refundPayment(transactionId: string, amount?: number): Promise<{ success: boolean; refundId: string }>;
}

class MockPaymentProvider implements IPaymentProvider {
  private assertNotProduction() {
    if (process.env.NODE_ENV === "production" && process.env.FEATURE_MOCK_PAYMENT !== "true") {
      throw new Error("Mock payments are disabled in production.");
    }
  }

  async createPaymentIntent(req: PaymentIntentRequest): Promise<PaymentIntentResponse> {
    this.assertNotProduction();
    const intentId = `pi_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return {
      clientSecret: `mock_secret_${intentId}`,
      intentId,
      amount: req.amount,
      currency: req.currency.toUpperCase(),
      status: "requires_payment_method",
    };
  }

  async confirmPayment(intentId: string): Promise<{ success: boolean; transactionId: string; status: string }> {
    return {
      success: true,
      transactionId: `txn_${intentId.replace("pi_", "")}`,
      status: "succeeded",
    };
  }

  async refundPayment(transactionId: string): Promise<{ success: boolean; refundId: string }> {
    return {
      success: true,
      refundId: `re_mock_${Date.now()}`,
    };
  }
}


import Stripe from "stripe";

class StripePaymentProvider implements IPaymentProvider {
  private stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" as any });
  }

  async createPaymentIntent(req: PaymentIntentRequest): Promise<PaymentIntentResponse> {
    const intent = await this.stripe.paymentIntents.create({
      amount: req.amount,
      currency: req.currency.toLowerCase(),
      metadata: {
        bookingReference: req.bookingReference,
        customerEmail: req.customerEmail,
        ...req.metadata
      }
    });

    return {
      clientSecret: intent.client_secret || "",
      intentId: intent.id,
      amount: req.amount,
      currency: req.currency,
      status: "requires_payment_method",
    };
  }

  async confirmPayment(intentId: string): Promise<{ success: boolean; transactionId: string; status: string }> {
    const intent = await this.stripe.paymentIntents.retrieve(intentId);
    return {
      success: intent.status === "succeeded",
      transactionId: (intent as any).latest_charge || intentId,
      status: intent.status,
    };
  }

  async refundPayment(transactionId: string): Promise<{ success: boolean; refundId: string }> {
    const refund = await this.stripe.refunds.create({ charge: transactionId });
    return {
      success: refund.status === "succeeded",
      refundId: refund.id,
    };
  }
}


let paymentInstance: IPaymentProvider | null = null;

export function getPaymentProvider(): IPaymentProvider {
  if (paymentInstance) return paymentInstance;

  const providerType = process.env.PAYMENT_PROVIDER || "mock";
  if (providerType === "stripe" && process.env.STRIPE_SECRET_KEY) {
    paymentInstance = new StripePaymentProvider(process.env.STRIPE_SECRET_KEY);
  } else {
    paymentInstance = new MockPaymentProvider();
  }
  return paymentInstance;
}
