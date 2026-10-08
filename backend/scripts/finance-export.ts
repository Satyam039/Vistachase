import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();

async function runFinanceExport() {
  console.log("Generating Finance Export...");
  
  const bookings = await prisma.booking.findMany({
    where: { status: { in: ["CONFIRMED", "REFUNDED", "COMPLETED"] } },
    include: { payments: true, tourDeparture: { include: { tour: true } } }
  });

  let csv = "BookingRef,Date,Tour,Customer,Total,GST,Net,Status,TransactionID\n";

  for (const b of bookings) {
    const payment = b.payments[0];
    const total = payment ? payment.amount / 100 : 0;
    const net = total / 1.05;
    const gst = total - net;
    const txn = payment ? payment.transactionId : "";
    
    csv += `${b.bookingReference},${b.createdAt.toISOString().split('T')[0]},"${b.tourDeparture.tour?.title || ""}",${b.customerName},${total.toFixed(2)},${gst.toFixed(2)},${net.toFixed(2)},${b.status},${txn}\n`;
  }

  const filename = `finance_export_${Date.now()}.csv`;
  fs.writeFileSync(filename, csv);
  console.log(`Export saved to ${filename}`);
}

runFinanceExport().catch(console.error).finally(() => prisma.$disconnect());
