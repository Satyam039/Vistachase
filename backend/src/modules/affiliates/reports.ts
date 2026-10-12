// Partner performance report for a period: clicks, referred and paid bookings, sales, and
// commission from the ledger (earned, reversed, net). Amounts in dollars, CAD.

import prisma from "@/lib/db/prisma";
import { COMMISSION_STATUSES } from "@/modules/affiliates/affiliate.repository";

export interface AffiliateReportRow {
  affiliateId: string;
  partner: string;
  code: string;
  status: string;
  clicks: number;
  bookings: number; // referred bookings created in the period (any status)
  paidBookings: number;
  guests: number;
  sales: number;
  commissionEarned: number;
  commissionReversed: number;
  commissionNet: number;
  conversion: number | null; // paid bookings per 100 clicks
}

export async function affiliateReport(from: Date, to: Date): Promise<AffiliateReportRow[]> {
  const period = { gte: from, lte: to };
  const [affiliates, clicks, bookings, paid, ledger] = await Promise.all([
    prisma.affiliate.findMany({ select: { id: true, name: true, code: true, status: true }, orderBy: { name: "asc" } }),
    prisma.affiliateClick.groupBy({ by: ["affiliateId"], where: { createdAt: period }, _count: { _all: true } }),
    prisma.booking.groupBy({ by: ["affiliateId"], where: { affiliateId: { not: null }, createdAt: period }, _count: { _all: true } }),
    prisma.booking.groupBy({
      by: ["affiliateId"],
      where: { affiliateId: { not: null }, createdAt: period, status: { in: [...COMMISSION_STATUSES] } },
      _count: { _all: true },
      _sum: { totalAmount: true, totalSeats: true },
    }),
    prisma.commissionLedger.groupBy({ by: ["affiliateId", "type"], where: { createdAt: period }, _sum: { amountCents: true } }),
  ]);
  const cents = (id: string, type: string) => ledger.find((l) => l.affiliateId === id && l.type === type)?._sum.amountCents ?? 0;

  return affiliates.map((a) => {
    const clickCount = clicks.find((c) => c.affiliateId === a.id)?._count._all ?? 0;
    const paidRow = paid.find((p) => p.affiliateId === a.id);
    const earned = cents(a.id, "EARNED");
    const reversed = -cents(a.id, "REVERSAL");
    const adjusted = cents(a.id, "ADJUSTMENT");
    const paidBookings = paidRow?._count._all ?? 0;
    return {
      affiliateId: a.id,
      partner: a.name,
      code: a.code,
      status: a.status,
      clicks: clickCount,
      bookings: bookings.find((b) => b.affiliateId === a.id)?._count._all ?? 0,
      paidBookings,
      guests: paidRow?._sum.totalSeats ?? 0,
      sales: (paidRow?._sum.totalAmount ?? 0) / 100,
      commissionEarned: earned / 100,
      commissionReversed: reversed / 100,
      commissionNet: (earned - reversed + adjusted) / 100,
      conversion: clickCount > 0 ? Math.round((paidBookings / clickCount) * 1000) / 10 : null,
    };
  });
}

/** CSV for the accountant. Text cells are quoted, and a leading = + - @ is neutralised (spreadsheet formula injection). */
export function reportToCsv(rows: AffiliateReportRow[]) {
  const header = ["Partner", "Code", "Status", "Clicks", "Bookings", "Paid bookings", "Guests", "Sales (CAD)", "Commission earned", "Commission reversed", "Commission net", "Conversion %"];
  const cell = (v: string | number | null) => {
    if (v === null) return "";
    if (typeof v === "number") return String(v);
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = rows.map((r) =>
    [r.partner, r.code, r.status, r.clicks, r.bookings, r.paidBookings, r.guests, r.sales.toFixed(2), r.commissionEarned.toFixed(2), r.commissionReversed.toFixed(2), r.commissionNet.toFixed(2), r.conversion]
      .map((v) => cell(v as string | number | null))
      .join(","),
  );
  return [header.map(cell).join(","), ...lines].join("\n") + "\n";
}
