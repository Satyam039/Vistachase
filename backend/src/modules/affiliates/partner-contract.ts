// Partner application PDF and partner agreement (owner, 2026-11-26).
//
// - The application PDF is the partner's signup form as the team received it, so it can be downloaded
//   and kept (Admin → Partners → Application PDF) and is attached to the "new partner application"
//   email. Bank details are masked unless an admin asks for them (each such download is audited).
// - The contract is drafted from the application details. Staff choose the commission % and the
//   products it applies to when they approve the partner (no automatic 10%). Approving saves the
//   commission as rules (commission.ts picks them up), stores a numbered contract snapshot, and emails
//   the partner the contract PDF. A later "Send new contract" replaces the rules of the previous one;
//   commission already earned never changes.
//
// The agreement wording below is a draft based on how the program works in this app (docs/AFFILIATES.md)
// and the website's General Terms; Vista Chase should review it. Staff can add extra terms per partner.

import type { Prisma, TourCategory } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { ON_SALE } from "@/modules/tours/product-map";
import { PARTNER_TYPE_LABELS, maskedAccount, type BankDetails } from "@/modules/affiliates/partner-application";
import { documentPdf, type DocBlock } from "@/modules/affiliates/partner-pdf";

type Tx = Prisma.TransactionClient;

export const CONTRACT_CATEGORIES = ["SHARED", "PRIVATE", "SHUTTLE", "MULTIDAY", "TICKET"] as const;
export type ContractCategory = (typeof CONTRACT_CATEGORIES)[number];
export const CATEGORY_LABELS: Record<ContractCategory, string> = {
  SHARED: "Shared tours",
  PRIVATE: "Private tours",
  SHUTTLE: "Shuttles",
  MULTIDAY: "Multi-day tours",
  TICKET: "Activity tickets",
};

export const COMPANY = "D Tourist Inc., operating as Vista Chase";
export const PAYMENT_AUTHORIZATION =
  "I am authorized to provide these details and authorize D Tourist Inc., operating as Vista Chase, to pay partner commissions to the account identified above under our signed agreement.";
const WORK_MODE: Record<string, string> = { BOOK: "Book for guests", REFER: "Refer guests", BOTH: "Both book for and refer guests" };

export interface ProductSelection {
  all: boolean;
  categories: ContractCategory[];
  tourSlugs: string[];
}

export interface ResolvedProducts {
  all: boolean;
  categories: ContractCategory[];
  tours: { id: string; slug: string; title: string; category: string }[];
}

/** Tours staff can pick for a contract: everything on sale. */
export async function contractProductOptions() {
  const tours = await prisma.tour.findMany({ where: ON_SALE, select: { slug: true, title: true, category: true }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { title: "asc" }] });
  return { categories: CONTRACT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })), tours };
}

export async function resolveProducts(selection: ProductSelection): Promise<{ ok: true; products: ResolvedProducts } | { ok: false; error: string }> {
  if (selection.all) return { ok: true, products: { all: true, categories: [], tours: [] } };
  const categories = CONTRACT_CATEGORIES.filter((c) => selection.categories.includes(c));
  const slugs = [...new Set(selection.tourSlugs)];
  const tours = slugs.length ? await prisma.tour.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true, title: true, category: true } }) : [];
  if (tours.length !== slugs.length) return { ok: false, error: "One of the chosen tours wasn't found. Reload the page and try again." };
  // A tour inside a whole chosen category is already covered.
  const extraTours = tours.filter((t) => !categories.includes(t.category as ContractCategory));
  if (categories.length === 0 && extraTours.length === 0) return { ok: false, error: "Choose the products the commission applies to." };
  return { ok: true, products: { all: false, categories, tours: extraTours } };
}

export const productLines = (p: ResolvedProducts) =>
  p.all ? ["All Vista Chase tours, shuttles and packages booked on vistachase.com"] : [...p.categories.map((c) => `${CATEGORY_LABELS[c]} (all)`), ...p.tours.map((t) => t.title)];

type AffiliateForDocs = {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  phone: string | null;
  website: string | null;
  payoutEmail: string | null;
  application: Prisma.JsonValue;
  createdAt: Date;
  user: { email: string; name: string };
};

const app = (a: AffiliateForDocs) => (a.application && typeof a.application === "object" ? (a.application as Record<string, unknown>) : {}) as Record<string, string | null | undefined> & {
  authorization?: { signatureName?: string; signedAt?: string; ip?: string | null };
};

const longDay = (d: Date | string) => new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Edmonton" });

/** The partner details both documents show. */
function partnerRows(a: AffiliateForDocs): [string, string | null | undefined][] {
  const f = app(a);
  return [
    ["Business / legal name", a.name],
    ["Trading name", f.tradingName],
    ["Partner type", PARTNER_TYPE_LABELS[a.type] ?? a.type],
    ["Contact name", a.user.name],
    ["Contact role", f.contactRole],
    ["Email", a.user.email],
    ["Phone", a.phone],
    ["Mailing address", f.mailingAddress],
    ["Website / reference", f.websiteOrReference ?? a.website],
    ["Host agency / consortium", f.hostAgency],
    ["Authorized signer", f.authorizedSigner],
  ];
}

export async function applicationPdf(a: AffiliateForDocs, bank: { details: BankDetails | null; full: boolean; stored: boolean }) {
  const f = app(a);
  const auth = f.authorization ?? {};
  const d = bank.details;
  const bankRows: [string, string | null | undefined][] = d
    ? [
        ["Beneficiary name", d.beneficiaryName],
        ["Beneficiary address", d.beneficiaryAddress],
        ["Currency", d.currency],
        ["Bank name", d.bankName],
        ["Branch address", d.branchAddress],
        ["Bank location", d.location === "CANADA" ? "Canada" : "Outside Canada"],
        ...(d.location === "CANADA"
          ? ([
              ["Institution number", bank.full ? d.institutionNumber : "•••"],
              ["Branch transit number", bank.full ? d.transitNumber : "•••••"],
              ["Account number", bank.full ? d.accountNumber : maskedAccount(d)],
            ] as [string, string][])
          : ([
              ["IBAN / account number", bank.full ? d.iban : maskedAccount(d)],
              ["Local routing code", bank.full ? d.routing : d.routing ? "(hidden)" : null],
              ["Intermediary bank", d.intermediaryBank],
              ["Intermediary SWIFT / routing", d.intermediarySwift],
              ["Correspondent / further credit", d.correspondentReference],
              ["Additional instructions", d.additionalInstructions],
            ] as [string, string | undefined][])),
        ["SWIFT / BIC", d.swift],
      ]
    : [];
  const blocks: DocBlock[] = [
    { kind: "rows", rows: [["Referral code", a.code], ["Status", a.status.charAt(0) + a.status.slice(1).toLowerCase()], ["Applied on", longDay(a.createdAt)], ["Form", String(f.formVersion ?? "Added by staff")]] },
    { kind: "heading", text: "Partner details" },
    { kind: "rows", rows: [...partnerRows(a), ["Works with Vista Chase by", WORK_MODE[String(f.workMode)] ?? f.workMode], ["Statement email", f.statementEmail ?? a.payoutEmail]] },
    { kind: "heading", text: "Wire transfer details" },
    bank.stored
      ? d
        ? { kind: "rows", rows: bankRows }
        : { kind: "paragraph", text: "Bank details are stored but can't be read with the server's current key (PARTNER_DATA_KEY or JWT_SECRET changed).", muted: true }
      : { kind: "paragraph", text: "No bank details on file.", muted: true },
    ...(bank.stored && d && !bank.full
      ? [{ kind: "paragraph" as const, text: "Account numbers are masked. An admin can download the full copy from Admin → Partners.", muted: true }]
      : []),
    { kind: "heading", text: "Payment authorization" },
    ...(auth.signatureName
      ? ([
          { kind: "paragraph", text: `"${PAYMENT_AUTHORIZATION}"` },
          { kind: "rows", rows: [["Signed (typed name)", auth.signatureName], ["Date", auth.signedAt ? longDay(auth.signedAt) : null]] },
        ] as DocBlock[])
      : ([{ kind: "paragraph", text: "This partner was added by staff or applied before the application form, so there is no signed authorization.", muted: true }] as DocBlock[])),
  ];
  return documentPdf({ title: "Partner application", subtitle: `Partner application · ${a.name}`, blocks, ...(bank.full ? { watermark: "CONFIDENTIAL" } : {}) });
}

// ---------------------------------------------------------------------------------------------
// Contract

export interface ContractTerms {
  version: number | null; // null = draft not yet issued
  date: string; // ISO
  commissionPercent: number | null;
  products: ResolvedProducts | null;
  extraTerms: string | null;
  signedForVistaChase: string | null;
}

export function contractClauses(t: Pick<ContractTerms, "commissionPercent" | "products">) {
  const rate = t.commissionPercent == null ? "[commission % to be set by Vista Chase]" : `${t.commissionPercent}%`;
  const scope = t.products ? (t.products.all ? "all Vista Chase products booked on vistachase.com" : "the products listed in this agreement") : "[products to be set by Vista Chase]";
  return [
    { title: "Appointment", text: `${COMPANY} ("Vista Chase") appoints the Partner as a non-exclusive partner to refer guests to, or book guests on, ${scope}. Nothing in this agreement makes the Partner an employee, agent or legal representative of Vista Chase.` },
    { title: "Credited bookings", text: "A booking is credited to the Partner when the guest arrives through the Partner's referral link (any vistachase.com page with ?ref= and the Partner's code) and books within 30 days of their last click on a partner link (last click wins), or when the booking uses a coupon code that Vista Chase issued to the Partner. Bookings made by the Partner for themselves are not credited." },
    { title: "Commission", text: `The Partner earns ${rate} of the amount the guest pays Vista Chase for each credited booking of ${scope}. Products not covered by this agreement earn no commission. Commission is earned only once the guest's payment has been received.` },
    { title: "When commission is payable", text: "Commission becomes payable the day after the tour, shuttle or package has run. Vista Chase pays approved commission by bank transfer to the account the Partner gave in their application, and shows every booking, commission line and payout in the partner portal." },
    { title: "Cancellations and refunds", text: "If a booking is cancelled or refunded in whole or in part, the commission is reduced in the same proportion. If that commission was already paid, the difference is deducted from the Partner's next payout." },
    { title: "Coupon codes", text: "Only the Vista Chase team creates coupon codes. The Partner may ask for a coupon code through the change request form in the partner portal." },
    { title: "Promotion and conduct", text: "The Partner will describe Vista Chase products, prices, availability and policies accurately, will not make promises on behalf of Vista Chase, will not send unsolicited messages (spam), and will follow applicable laws. The Partner may use the Vista Chase name only to promote the products covered by this agreement." },
    { title: "Guest information", text: "Vista Chase does not share guests' names or contact details with the Partner through the portal. Any guest information the Partner collects must be handled under applicable privacy law." },
    { title: "Changes", text: "Vista Chase may change the commission rate or the products covered by sending the Partner a new version of this agreement. Changes apply to bookings paid after the new version is sent and never reduce commission already earned. The Partner can request changes at any time through the change request form in the partner portal." },
    { title: "Term and termination", text: "This agreement starts on the date above and continues until either party ends it by written notice. Commission on credited bookings paid before the end date stays payable once those tours have run, unless they are refunded. Vista Chase may pause or end the partnership immediately if these terms are broken." },
    { title: "Governing law", text: "This agreement is governed by applicable Alberta and Canadian law." },
  ];
}

export async function contractPdf(a: AffiliateForDocs, t: ContractTerms, options: { draft: boolean }) {
  const products = t.products ? productLines(t.products) : ["[Products to be set by Vista Chase]"];
  const blocks: DocBlock[] = [
    {
      kind: "rows",
      rows: [
        ["Agreement", t.version == null ? "Draft" : `Version ${t.version}`],
        ["Date", longDay(t.date)],
        ["Between", COMPANY],
        ["And (the Partner)", a.name],
        ["Referral code", a.code],
      ],
    },
    { kind: "heading", text: "Partner details (from the application)" },
    { kind: "rows", rows: partnerRows(a) },
    { kind: "heading", text: "Commission" },
    { kind: "rows", rows: [["Commission rate", t.commissionPercent == null ? "[To be set by Vista Chase]" : `${t.commissionPercent}% of the amount paid`], ["Applies to", products.join("\n")]] },
    { kind: "heading", text: "Terms" },
    { kind: "clauses", items: [...contractClauses(t), ...(t.extraTerms ? [{ title: "Additional terms", text: t.extraTerms }] : [])] },
    { kind: "paragraph", text: "Please review this agreement, sign it and reply to the email it came with. Questions: support@vistachase.com.", muted: true },
    {
      kind: "signatures",
      parties: [
        { label: `For ${COMPANY}`, lines: [`Name: ${t.signedForVistaChase ?? ""}`, "Date:"] },
        { label: `For the Partner: ${a.name}`, lines: [`Name: ${app(a).authorizedSigner || a.user.name}`, "Date:"] },
      ],
    },
  ];
  return documentPdf({
    title: "Partner agreement",
    subtitle: `Partner agreement · ${a.name}${t.version != null ? ` · Version ${t.version}` : ""}`,
    blocks,
    ...(options.draft ? { watermark: "DRAFT" } : {}),
  });
}

export const affiliateForDocs = (id: string) =>
  prisma.affiliate.findUnique({ where: { id }, include: { user: { select: { email: true, name: true } } } });

/**
 * Save staff's commission choice as the partner's commission rules and a new numbered contract.
 * "All products": one partner-wide rule at the rate. Chosen products: a rule per category and tour
 * at the rate, plus a partner-wide 0% rule so nothing else earns (it outranks every all-partner
 * rule). The previous contract's rules end now. Runs inside the caller's transaction.
 */
export async function issueContract(
  tx: Tx,
  input: { affiliateId: string; commissionPercent: number; products: ResolvedProducts; extraTerms: string | null; staffId: string; staffName: string | null; sentTo: string },
) {
  const now = new Date();
  const previous = await tx.affiliateContract.findFirst({ where: { affiliateId: input.affiliateId }, orderBy: { version: "desc" } });
  if (previous?.ruleIds.length) {
    await tx.commissionRule.updateMany({ where: { id: { in: previous.ruleIds }, active: true }, data: { active: false, validTo: now } });
  }
  const version = (previous?.version ?? 0) + 1;
  const bps = Math.round(input.commissionPercent * 100);
  const base = { affiliateId: input.affiliateId, validFrom: now, createdById: input.staffId, fixedCents: null };
  const specs: { name: string; tourId: string | null; category: TourCategory | null; percentBps: number }[] = input.products.all
    ? [{ name: `Contract v${version}: all products`, tourId: null, category: null, percentBps: bps }]
    : [
        { name: `Contract v${version}: products not in the contract`, tourId: null, category: null, percentBps: 0 },
        ...input.products.categories.map((c) => ({ name: `Contract v${version}: ${CATEGORY_LABELS[c]}`, tourId: null, category: c as TourCategory, percentBps: bps })),
        ...input.products.tours.map((t) => ({ name: `Contract v${version}: ${t.title}`.slice(0, 120), tourId: t.id, category: null, percentBps: bps })),
      ];
  const ruleIds: string[] = [];
  for (const spec of specs) {
    const rule = await tx.commissionRule.create({ data: { ...base, ...spec } });
    ruleIds.push(rule.id);
  }
  await tx.affiliate.update({ where: { id: input.affiliateId }, data: { commissionRate: input.products.all ? input.commissionPercent / 100 : 0, commissionSetAt: now } });
  const terms: ContractTerms = { version, date: now.toISOString(), commissionPercent: input.commissionPercent, products: input.products, extraTerms: input.extraTerms, signedForVistaChase: input.staffName };
  const contract = await tx.affiliateContract.create({
    data: {
      affiliateId: input.affiliateId,
      version,
      commissionPercent: input.commissionPercent,
      products: input.products as unknown as Prisma.InputJsonValue,
      snapshot: terms as unknown as Prisma.InputJsonValue,
      ruleIds,
      sentTo: input.sentTo,
      sentAt: now,
      createdById: input.staffId,
    },
  });
  await tx.auditLog.create({
    data: {
      userId: input.staffId,
      action: "PARTNER_CONTRACT_ISSUED",
      entityType: "Affiliate",
      entityId: input.affiliateId,
      details: { version, commissionPercent: input.commissionPercent, products: productLines(input.products), ruleIds, replacedVersion: previous?.version ?? null },
    },
  });
  return { contract, terms };
}

export function contractDto(c: { id: string; version: number; commissionPercent: number; products: Prisma.JsonValue; sentTo: string | null; sentAt: Date | null; createdAt: Date }) {
  const products = c.products as unknown as ResolvedProducts;
  return { id: c.id, version: c.version, commissionPercent: c.commissionPercent, products: productLines(products), sentTo: c.sentTo, sentAt: c.sentAt, createdAt: c.createdAt };
}
