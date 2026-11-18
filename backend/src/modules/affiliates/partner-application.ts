// The partner application form (owner, 2026-11-18: "Vista Chase Partner Application" Word file):
// partner details, wire transfer details for commission payouts, and the payment authorization.
//
// Partner details are kept in Affiliate.application (JSON). Bank details are never stored in
// plain text: they are encrypted with AES-256-GCM into Affiliate.payoutDetails and only an admin
// can read them back (each read is audited). The key is PARTNER_DATA_KEY (32+ characters); without
// it a key is derived from JWT_SECRET, so set PARTNER_DATA_KEY before ever rotating JWT_SECRET.

import crypto from "node:crypto";
import { z } from "zod";

/** Partner types as worded on the form. HOTEL/AGENT/CREATOR stay valid for older partners. */
export const PARTNER_TYPE_LABELS: Record<string, string> = {
  AGENCY: "Travel agency",
  ADVISOR: "Independent advisor",
  OPERATOR: "Tour operator",
  HOTEL: "Hotel or concierge",
  AFFILIATE: "Affiliate",
  OTHER: "Other",
  AGENT: "Travel agent",
  CREATOR: "Blogger or creator",
};

const text = (max: number) => z.string().trim().min(2, "Required").max(max);
const optional = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => v || undefined);
const digits = (n: number, label: string) => z.string().trim().regex(new RegExp(`^\\d{${n}}$`), `${label} is ${n} digits`);

const canada = z.object({
  location: z.literal("CANADA"),
  institutionNumber: digits(3, "Institution number"),
  transitNumber: digits(5, "Branch transit number"),
  accountNumber: z.string().trim().regex(/^\d{5,20}$/, "Digits only, including leading zeros"),
  swift: optional(20),
});

const international = z.object({
  location: z.literal("INTERNATIONAL"),
  iban: z.string().trim().min(5, "Required").max(40),
  swift: optional(20),
  routing: optional(120),
  intermediaryBank: optional(300),
  intermediarySwift: optional(60),
  correspondentReference: optional(200),
  additionalInstructions: optional(1000),
});

export const bankSchema = z
  .object({
    beneficiaryName: text(200),
    beneficiaryAddress: text(400),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. CAD"),
    bankName: text(200),
    branchAddress: text(400),
  })
  .and(z.discriminatedUnion("location", [canada, international]));

export type BankDetails = z.infer<typeof bankSchema>;

/** Everything on the form except the sign-in fields the routes already check. */
export const applicationFields = z.object({
  tradingName: optional(200),
  contactRole: text(120),
  mailingAddress: text(400),
  websiteOrReference: text(300),
  hostAgency: optional(300),
  authorizedSigner: optional(300),
  workMode: z.enum(["BOOK", "REFER", "BOTH"]),
  statementEmail: z.string().trim().email().max(200).optional().or(z.literal("")).transform((v) => v || undefined),
  bank: bankSchema,
  authorize: z.literal(true, { errorMap: () => ({ message: "Please confirm the payment authorization" }) }),
  signatureName: text(200),
});

export type ApplicationFields = z.infer<typeof applicationFields>;

/** Partner details stored as JSON on the partner (no bank details). */
export function applicationRecord(input: Omit<ApplicationFields, "bank">, ip?: string) {
  return {
    tradingName: input.tradingName ?? null,
    contactRole: input.contactRole,
    mailingAddress: input.mailingAddress,
    websiteOrReference: input.websiteOrReference,
    hostAgency: input.hostAgency ?? null,
    authorizedSigner: input.authorizedSigner ?? null,
    workMode: input.workMode,
    statementEmail: input.statementEmail ?? null,
    authorization: { signatureName: input.signatureName, signedAt: new Date().toISOString(), ip: ip ?? null },
    formVersion: "partner-application-2026-11",
  };
}

function key() {
  const configured = process.env.PARTNER_DATA_KEY;
  if (configured && configured.length >= 32) return crypto.createHash("sha256").update(configured).digest();
  const fallback = process.env.JWT_SECRET;
  if (!fallback) throw new Error("PARTNER_DATA_KEY or JWT_SECRET must be set to store partner bank details.");
  return crypto.createHash("sha256").update(`partner-bank-details:${fallback}`).digest();
}

export function encryptBankDetails(details: BankDetails): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(details), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(".");
}

export function decryptBankDetails(sealed: string): BankDetails | null {
  const [version, iv, tag, body] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !body) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
    return JSON.parse(plain) as BankDetails;
  } catch {
    return null; // wrong key (e.g. JWT_SECRET rotated without PARTNER_DATA_KEY) or tampered
  }
}

/** "•••• 6789": what the partner and lists may show of an account number. */
export function maskedAccount(details: BankDetails | null) {
  if (!details) return null;
  const number = details.location === "CANADA" ? details.accountNumber : details.iban;
  return `•••• ${number.replace(/\s/g, "").slice(-4)}`;
}
