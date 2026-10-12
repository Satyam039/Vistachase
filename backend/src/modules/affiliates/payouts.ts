// Partner payouts. The app never moves money: an admin drafts a payout from a partner's APPROVED
// lines, pays it outside the app (bank transfer, Interac e-Transfer, PayPal…), then marks it paid
// with the transfer reference. Cancelling a draft releases its lines for the next payout.

import prisma from "@/lib/db/prisma";

export async function createPayout(input: { affiliateId: string; staffId: string; method?: string | null }) {
  return prisma.$transaction(async (tx) => {
    // Lock the partner's payable lines so two admins can't put the same line in two payouts.
    const lines = await tx.$queryRaw<{ id: string; amountCents: number }[]>`
      SELECT id, "amountCents" FROM "CommissionLedger"
      WHERE "affiliateId" = ${input.affiliateId} AND status = 'APPROVED' AND "payoutId" IS NULL
      FOR UPDATE`;
    const amountCents = lines.reduce((sum, l) => sum + l.amountCents, 0);
    if (lines.length === 0 || amountCents <= 0) {
      return { ok: false as const, error: "Nothing is payable for this partner yet." };
    }
    const payout = await tx.affiliatePayout.create({
      data: { affiliateId: input.affiliateId, amountCents, method: input.method ?? null, createdById: input.staffId },
    });
    await tx.commissionLedger.updateMany({ where: { id: { in: lines.map((l) => l.id) } }, data: { payoutId: payout.id } });
    await tx.auditLog.create({
      data: { userId: input.staffId, action: "PAYOUT_DRAFTED", entityType: "AffiliatePayout", entityId: payout.id, details: { affiliateId: input.affiliateId, amountCents, lines: lines.length } },
    });
    return { ok: true as const, payout };
  });
}

export async function markPayoutPaid(input: { payoutId: string; reference: string; staffId: string }) {
  return prisma.$transaction(async (tx) => {
    const paidAt = new Date();
    const claimed = await tx.affiliatePayout.updateMany({
      where: { id: input.payoutId, status: "DRAFT" },
      data: { status: "PAID", reference: input.reference, paidById: input.staffId, paidAt },
    });
    if (claimed.count === 0) return { ok: false as const, error: "Only a draft payout can be marked paid." };
    const lines = await tx.commissionLedger.updateMany({ where: { payoutId: input.payoutId }, data: { status: "PAID", paidAt } });
    await tx.auditLog.create({
      data: { userId: input.staffId, action: "PAYOUT_PAID", entityType: "AffiliatePayout", entityId: input.payoutId, details: { reference: input.reference, lines: lines.count } },
    });
    return { ok: true as const, payout: await tx.affiliatePayout.findUniqueOrThrow({ where: { id: input.payoutId } }) };
  });
}

export async function cancelPayout(input: { payoutId: string; staffId: string }) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.affiliatePayout.updateMany({ where: { id: input.payoutId, status: "DRAFT" }, data: { status: "CANCELLED" } });
    if (claimed.count === 0) return { ok: false as const, error: "Only a draft payout can be cancelled." };
    await tx.commissionLedger.updateMany({ where: { payoutId: input.payoutId }, data: { payoutId: null } });
    await tx.auditLog.create({
      data: { userId: input.staffId, action: "PAYOUT_CANCELLED", entityType: "AffiliatePayout", entityId: input.payoutId, details: {} },
    });
    return { ok: true as const };
  });
}

const dollars = (cents: number) => Math.round(cents) / 100;

export function payoutDto(p: { id: string; affiliateId: string; amountCents: number; currency: string; status: string; method: string | null; reference: string | null; paidAt: Date | null; createdAt: Date }) {
  return {
    id: p.id,
    affiliateId: p.affiliateId,
    amount: dollars(p.amountCents),
    currency: p.currency,
    status: p.status,
    method: p.method,
    reference: p.reference,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
  };
}

export async function listPayouts(where: { affiliateId?: string; status?: "DRAFT" | "PAID" | "CANCELLED" } = {}) {
  const payouts = await prisma.affiliatePayout.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { affiliate: { select: { name: true, code: true, payoutEmail: true } }, _count: { select: { entries: true } } },
  });
  return payouts.map((p) => ({ ...payoutDto(p), partner: p.affiliate.name, code: p.affiliate.code, payoutEmail: p.affiliate.payoutEmail, lines: p._count.entries }));
}
