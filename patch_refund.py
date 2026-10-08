import re

with open('backend/src/modules/bookings/booking.repository.ts', 'r') as f:
    content = f.read()

refund_logic = """
    // B6: Cancel in Bokun
    const bokunProvider = getBokunOperationsProvider();
    if (booking.bokunBookingId && booking.bokunBookingId !== "pending_sync") {
      await bokunProvider.cancelBooking(booking.bokunBookingId).catch(e => console.error("Bókun cancel error:", e));
    }

    // P5: Process Refund
    const paymentProvider = getPaymentProvider();
    const payments = await tx.payment.findMany({ where: { bookingId: booking.id, status: "SUCCEEDED" } });
    for (const payment of payments) {
      let refundAmount = payment.amount;
      // 1-6 guests: full refund. 7+ guests: minus 20% deposit
      if (booking.totalSeats >= 7) {
        refundAmount = Math.round(payment.amount * 0.8);
      }
      
      const refundResult = await paymentProvider.refundPayment(payment.transactionId, refundAmount);
      if (refundResult.success) {
         await tx.booking.update({ where: { id: booking.id }, data: { status: "REFUNDED" }});
      }
    }
"""

content = re.sub(r'    // B6: Cancel in Bókun[\s\S]*?catch\(e => console\.error\("Bókun cancel error:", e\)\);\n    \}', refund_logic.strip(), content)

# Also add getPaymentProvider import if not there
if 'import { getPaymentProvider }' not in content:
    content = content.replace('import { getEmailProvider }', 'import { getEmailProvider }\nimport { getPaymentProvider } from "@/lib/payment/payment.provider";')

with open('backend/src/modules/bookings/booking.repository.ts', 'w') as f:
    f.write(content)

