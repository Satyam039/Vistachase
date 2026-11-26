/**
 * Credit existing bookings to a partner (owner-approved backfill, 2026-11-26).
 *
 * Until 2026-11-26 a booking a partner made with their own email or account was refused as
 * self-referral, so it never showed in their portal. This links named bookings to the partner and
 * records their commission the same way a paid booking does (PENDING, approved after the tour).
 * Only bookings with no partner yet are changed, and only CONFIRMED / COMPLETED / PAID_UNSYNCED
 * ones earn. Safe to run twice. Dry run unless --apply is given.
 *
 *   npx tsx scripts/credit-partner-bookings.ts RAVINDERSI VC-2026-298F61BD VC-2026-D6252F46 [--apply]
 */
import "dotenv/config";
import prisma from "@/lib/db/prisma";
import { earnCommission } from "@/modules/affiliates/commission";
import { COMMISSION_STATUSES } from "@/modules/affiliates/affiliate.repository";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const [code, ...refs] = args.filter((a) => a !== "--apply");
  if (!code || refs.length === 0) throw new Error("Usage: credit-partner-bookings.ts <PARTNER_CODE> <BOOKING_REF...> [--apply]");

  const affiliate = await prisma.affiliate.findUnique({ where: { code: code.toUpperCase() } });
  if (!affiliate) throw new Error(`No partner with code ${code}`);
  if (affiliate.status !== "ACTIVE") throw new Error(`Partner ${affiliate.code} is ${affiliate.status}, not ACTIVE`);

  for (const ref of refs) {
    const booking = await prisma.booking.findUnique({ where: { bookingReference: ref } });
    if (!booking) {
      console.log(`${ref}: not found, skipped`);
      continue;
    }
    if (booking.affiliateId && booking.affiliateId !== affiliate.id) {
      console.log(`${ref}: already credited to another partner, skipped`);
      continue;
    }
    const earns = (COMMISSION_STATUSES as readonly string[]).includes(booking.status);
    if (!apply) {
      console.log(`${ref}: ${booking.status}, would credit to ${affiliate.code}${earns ? " and record commission" : ""}`);
      continue;
    }
    const line = await prisma.$transaction(async (tx) => {
      if (!booking.affiliateId) {
        await tx.booking.update({ where: { id: booking.id }, data: { affiliateId: affiliate.id } });
        await tx.auditLog.create({
          data: { action: "PARTNER_CREDIT_BACKFILLED", entityType: "Booking", entityId: booking.id, details: { reference: ref, partnerCode: affiliate.code, reason: "own-email booking, owner approved 2026-11-26" } },
        });
      }
      return earns ? earnCommission(tx, booking.id, booking.totalAmount) : null;
    });
    console.log(`${ref}: credited to ${affiliate.code}${line ? `, commission ${(line.amountCents / 100).toFixed(2)} ${line.currency}` : ""}`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
