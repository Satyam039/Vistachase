export function renderBookingConfirmation(booking: any) {
  return `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #334155; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { border-bottom: 2px solid #072019; padding-bottom: 20px; margin-bottom: 20px; text-align: center; }
  .logo { font-size: 24px; font-weight: bold; color: #072019; letter-spacing: 2px; text-transform: uppercase; }
  .content { padding: 0 10px; }
  .highlight { color: #072019; font-weight: bold; }
  .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
  .footer { border-top: 1px solid #e2e8f0; margin-top: 30px; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center; }
  .button { display: inline-block; background-color: #072019; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 15px; }
</style>
</head>
<body>
  <div class="header">
    <div class="logo">VISTA CHASE</div>
    <p>CANADIAN ROCKIES</p>
  </div>
  <div class="content">
    <h2>Your Booking is Confirmed!</h2>
    <p>Hi ${booking.customerName},</p>
    <p>Thank you for choosing Vista Chase. We're thrilled to host you in the Rockies! Your booking is confirmed and your boarding pass is ready.</p>
    
    <div class="card">
      <p><strong>Booking Reference:</strong> <span class="highlight">${booking.bookingReference}</span></p>
      <p><strong>Experience:</strong> ${booking.tourDeparture?.tour?.title || "Canadian Rockies Tour"}</p>
      <p><strong>Date:</strong> ${new Date(booking.tourDeparture?.date).toLocaleDateString()}</p>
      <p><strong>Guests:</strong> ${booking.totalSeats}</p>
      <p><strong>Pickup:</strong> ${booking.pickupStop?.name || booking.pickupCustomText || "Meeting point (see boarding pass)"}</p>
    </div>

    <center>
      <a href="https://vistachase.com/booking/${booking.bookingReference}/voucher" class="button">View Boarding Pass</a>
    </center>

    <p style="margin-top: 30px;"><strong>What's Next?</strong></p>
    <p>We'll send you a WhatsApp/SMS update the evening before your trip with your exact pickup time and guide details. If you have any questions, simply reply to this email!</p>
  </div>
  <div class="footer">
    <p>Vista Chase | Banff, Alberta</p>
    <p><a href="https://vistachase.com/terms">Terms</a> | <a href="https://vistachase.com/privacy">Privacy</a></p>
    <p>You are receiving this transactional email because you made a booking. Canadian Anti-Spam Legislation (CASL) compliance active.</p>
  </div>
</body>
</html>
  `;
}

export function renderAdminNotification(booking: any, action: "CREATED" | "CANCELLED" | "UPDATED") {
  const color = action === "CANCELLED" ? "#dc2626" : "#16a34a";
  return `
    <div style="font-family: sans-serif; max-width: 600px; padding: 20px;">
      <h2 style="color: ${color}">Booking ${action}</h2>
      <p><strong>Ref:</strong> ${booking.bookingReference}</p>
      <p><strong>Customer:</strong> ${booking.customerName} (${booking.customerEmail})</p>
      <p><strong>Tour:</strong> ${booking.tourDeparture?.tour?.title}</p>
      <p><strong>Date:</strong> ${booking.tourDeparture?.date}</p>
      <p><strong>Total Paid:</strong> $${(booking.totalAmount / 100).toFixed(2)} CAD</p>
    </div>
  `;
}
