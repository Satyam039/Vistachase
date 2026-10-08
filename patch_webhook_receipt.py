import re

with open('backend/src/routes/webhooks.routes.ts', 'r') as f:
    content = f.read()

# Make the email a receipt
receipt_logic = """
  // 4. Send Email (P6: Receipt with GST)
  const emailProvider = getEmailProvider();
  const subtotal = booking.payment ? Math.round(booking.payment.amount / 1.05) : 0;
  const gst = booking.payment ? booking.payment.amount - subtotal : 0;
  
  await emailProvider.sendEmail({
    to: booking.customerEmail,
    subject: `Receipt for Booking ${booking.bookingReference}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #072019;">
        <h2>Vista Chase - Booking Confirmed</h2>
        <p>Hi ${booking.customerName},</p>
        <p>Your booking <strong>${booking.bookingReference}</strong> is confirmed. You can view your digital boarding pass <a href="https://vistachase.com/booking/${booking.bookingReference}/voucher">here</a>.</p>
        <hr />
        <h3>Receipt</h3>
        <table style="width: 100%; text-align: left;">
          <tr><td>Tour/Shuttle</td><td>${booking.departure?.tour?.title || "Vista Chase Experience"}</td></tr>
          <tr><td>Date</td><td>${booking.departure?.date}</td></tr>
          <tr><td>Subtotal</td><td>$${(subtotal / 100).toFixed(2)} CAD</td></tr>
          <tr><td>GST (5%)</td><td>$${(gst / 100).toFixed(2)} CAD</td></tr>
          <tr style="font-weight: bold;"><td>Total Paid</td><td>$${(booking.payment?.amount ? booking.payment.amount / 100 : 0).toFixed(2)} CAD</td></tr>
        </table>
        <p style="font-size: 0.8rem; color: #666; margin-top: 2rem;">GST Registration Number: 123456789 RT0001</p>
      </div>
    `,
    text: `Your booking ${booking.bookingReference} is confirmed. Total paid: $${(booking.payment?.amount ? booking.payment.amount / 100 : 0).toFixed(2)} CAD (includes 5% GST).`
  }).catch(console.error);
"""

content = re.sub(r'  // 4\. Send Email[\s\S]*?\}\)\.catch\(console\.error\);', receipt_logic.strip(), content)

# Also need to fetch the payment inside confirmBookingAfterPayment
content = content.replace('include: { tourDeparture: { include: { tour: true } } }', 'include: { tourDeparture: { include: { tour: true } }, payment: true }')

# Fix departure to tourDeparture
content = content.replace('booking.departure?.tour?.title', 'booking.tourDeparture?.tour?.title')
content = content.replace('booking.departure?.date', 'booking.tourDeparture?.date')


with open('backend/src/routes/webhooks.routes.ts', 'w') as f:
    f.write(content)

