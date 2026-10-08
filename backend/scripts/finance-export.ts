// Finance export: two CSV files for a date range (by booking date, Mountain Time).
//   bookings-<from>_<to>.csv  every paid, completed, refunded or Bókun-pending booking
//   partners-<from>_<to>.csv  commission owed to each ACTIVE partner (their rate × paid bookings)
// Amounts are in dollars; the database stores cents. No sales tax is charged.
//
//   npm run finance:export -- --from 2026-10-01 --to 2026-10-31 [--out ./exports]

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import prisma from "../src/lib/db/prisma";

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const csv = (rows: (string | number | null | undefined)[][]) =>
  rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n") + "\n";
const dollars = (cents: number) => (cents / 100).toFixed(2);

async function main() {
  const from = arg("from");
  const to = arg("to");
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error("Usage: npm run finance:export -- --from YYYY-MM-DD --to YYYY-MM-DD [--out dir]");
  }
  const outDir = arg("out", ".")!;
  const range = { gte: new Date(`${from}T07:00:00Z`), lt: new Date(new Date(`${to}T07:00:00Z`).getTime() + 86_400_000) };

  const bookings = await prisma.booking.findMany({
    where: { createdAt: range, status: { in: ["CONFIRMED", "COMPLETED", "REFUNDED", "PAID_UNSYNCED"] } },
    include: { payments: true, affiliate: true, tourDeparture: { include: { tour: true, shuttleRoute: true } } },
    orderBy: { createdAt: "asc" },
  });

  const rows: (string | number | null)[][] = [["Booking", "Booked at", "Trip date", "Experience", "Customer", "Status", "Paid", "Refunded", "Net", "Provider", "Transaction", "Partner"]];
  for (const b of bookings) {
    const paid = b.payments.filter((p) => p.status === "SUCCEEDED" || p.status === "REFUNDED").reduce((s, p) => s + p.amount, 0);
    const refunded = b.payments.filter((p) => p.status === "REFUNDED").reduce((s, p) => s + p.amount, 0);
    rows.push([
      b.bookingReference,
      b.createdAt.toISOString(),
      b.tourDeparture.date.toISOString().slice(0, 10),
      b.tourDeparture.tour?.title ?? b.tourDeparture.shuttleRoute?.name ?? "",
      b.customerName,
      b.status,
      dollars(paid),
      dollars(refunded),
      dollars(paid - refunded),
      b.payments[0]?.provider ?? "",
      b.payments[0]?.transactionId ?? "",
      b.affiliate?.code ?? "",
    ]);
  }

  // Commission on bookings that stayed paid (not refunded), at each partner's own rate.
  const partners = new Map<string, { name: string; code: string; rate: number; bookings: number; revenue: number }>();
  for (const b of bookings) {
    if (!b.affiliate || b.affiliate.status !== "ACTIVE" || b.status === "REFUNDED") continue;
    const p = partners.get(b.affiliate.id) ?? { name: b.affiliate.name, code: b.affiliate.code, rate: b.affiliate.commissionRate, bookings: 0, revenue: 0 };
    p.bookings += 1;
    p.revenue += b.totalAmount;
    partners.set(b.affiliate.id, p);
  }
  const partnerRows: (string | number)[][] = [["Partner", "Code", "Commission rate", "Bookings", "Revenue", "Commission due"]];
  for (const p of partners.values()) {
    partnerRows.push([p.name, p.code, `${Math.round(p.rate * 100)}%`, p.bookings, dollars(p.revenue), dollars(Math.round(p.revenue * p.rate))]);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const bookingsFile = path.join(outDir, `bookings-${from}_${to}.csv`);
  const partnersFile = path.join(outDir, `partners-${from}_${to}.csv`);
  fs.writeFileSync(bookingsFile, csv(rows));
  fs.writeFileSync(partnersFile, csv(partnerRows));
  console.log(`Wrote ${bookings.length} bookings to ${bookingsFile} and ${partners.size} partners to ${partnersFile}`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
