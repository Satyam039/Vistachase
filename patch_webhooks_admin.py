import re

with open('backend/src/routes/webhooks.routes.ts', 'r') as f:
    content = f.read()

admin_emails_logic = """
  // Send Admin Notification (based on Bókun settings)
  const adminEmails = [
    "naveensahraay@gmail.com",
    "yourguiderahul@gmail.com",
    "anchitvistachase@gmail.com",
    "business@mannosolutions.com"
  ];
  
  const { renderBookingConfirmation, renderAdminNotification } = require("@/lib/email/templates");
  const { sendEmailWithRetry } = require("@/lib/email/retry");

  // Send to Customer (P6 Receipt & N2 Branded Template)
  const subtotal = booking.payments[0] ? Math.round(booking.payments[0].amount / 1.05) : 0;
  const gst = booking.payments[0] ? booking.payments[0].amount - subtotal : 0;
  
  await sendEmailWithRetry({
    to: booking.customerEmail,
    subject: `Receipt for Booking ${booking.bookingReference}`,
    html: renderBookingConfirmation(booking),
    text: `Your booking ${booking.bookingReference} is confirmed.`
  });

  // Send to Admins
  await sendEmailWithRetry({
    to: adminEmails,
    subject: `NEW BOOKING: ${booking.bookingReference}`,
    html: renderAdminNotification(booking, "CREATED"),
  });
"""

content = re.sub(r'  // 4\. Send Email \(P6: Receipt with GST\)[\s\S]*?\}\)\.catch\(console\.error\);', admin_emails_logic.strip(), content)

with open('backend/src/routes/webhooks.routes.ts', 'w') as f:
    f.write(content)

