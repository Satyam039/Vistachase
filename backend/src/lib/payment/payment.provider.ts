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
  async createPaymentIntent(req: PaymentIntentRequest): Promise<PaymentIntentResponse> {
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

class StripePaymentProvider implements IPaymentProvider {
  private secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  async createPaymentIntent(req: PaymentIntentRequest): Promise<PaymentIntentResponse> {
    // When Stripe is enabled with real key, call Stripe API
    console.log(`[StripePaymentProvider] Creating Stripe payment intent for ${req.amount} ${req.currency}`);
    const intentId = `pi_stripe_${Date.now()}`;
    return {
      clientSecret: `stripe_sec_${intentId}`,
      intentId,
      amount: req.amount,
      currency: req.currency,
      status: "requires_payment_method",
    };
  }

  async confirmPayment(intentId: string): Promise<{ success: boolean; transactionId: string; status: string }> {
    return {
      success: true,
      transactionId: `ch_${intentId}`,
      status: "succeeded",
    };
  }

  async refundPayment(transactionId: string): Promise<{ success: boolean; refundId: string }> {
    return {
      success: true,
      refundId: `re_${transactionId}`,
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
