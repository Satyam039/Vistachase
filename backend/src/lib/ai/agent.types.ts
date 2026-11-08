import type { UserRole } from "@/lib/auth/auth";

export type AgentRole = "GUEST" | "CUSTOMER" | "ADMIN";

export interface SessionContext {
  userId?: string;
  email?: string;
  name?: string;
  role: AgentRole;
  authorizedPnr?: string; // Set when unauthenticated guest confirms 6-digit OTP
  rawStaffRole?: UserRole;
}

export type ToolScope = "SUITE_A" | "SUITE_B" | "SUITE_C" | "SUITE_D";

export interface ToolDefinitionMetadata {
  name: string;
  description: string;
  scope: ToolScope;
  requiredRole?: AgentRole;
  requiresOtpOrCustomerAuth?: boolean;
  inputSchema: Record<string, unknown>;
}

export interface AgentChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AgentHoldRecord {
  holdId: string;
  tripId: string;
  userId: string;
  customerEmail?: string;
  customerName?: string;
  seatCount: number;
  pickupLocationId?: string;
  subtotalCad: number;
  gstTaxCad: number;
  totalCad: number;
  expiresAt: number;
  createdAt: number;
}

export interface AgentCheckoutCardPayload {
  type: "checkout_card";
  holdId: string;
  clientSecret?: string;
  checkoutUrl?: string;
  expiresAt: number;
  expiresInSeconds: number;
  departure: {
    tripId: string;
    tourTitle: string;
    tourType: "SHARED" | "PRIVATE" | "SHUTTLE";
    date: string;
    time: string;
    seatCount: number;
    pickupLocation?: string;
  };
  pricing: {
    subtotalCad: number;
    gstTaxCad: number;
    totalCad: number;
  };
}

export interface AgentOtpCardPayload {
  type: "otp_verification_card";
  pnrCode: string;
  maskedDestination: string;
  expiresInSeconds: number;
  status: "OTP_DISPATCHED";
}

export interface AgentModificationCardPayload {
  type: "modification_preview_card";
  pnrCode: string;
  currentDetails: {
    tourTitle: string;
    date: string;
    seats: number;
  };
  proposedDetails: {
    tourTitle: string;
    date: string;
    seats: number;
  };
  fareDifferenceCad: number;
  changeFeeCad: number;
  netPayableCad: number;
  cutoffStatus: "WITHIN_POLICY" | "OUTSIDE_FREE_WINDOW";
}

export interface AgentEventPayload {
  type: "status" | "text" | "card" | "done" | "error";
  text?: string;
  card?: unknown;
  metadata?: Record<string, unknown>;
}
