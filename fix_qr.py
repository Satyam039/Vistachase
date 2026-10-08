import re

with open('backend/src/modules/bookings/booking.repository.ts', 'r') as f:
    content = f.read()

qr_logic = """
    // Generate signed check-in token for QR
    const hmac = crypto.createHmac("sha256", process.env.JWT_SECRET || "super-secret");
    hmac.update(bookingReference);
    const signature = hmac.digest("hex");
    
    // Generate QR code data URL (points to admin check-in page)
    const checkinUrl = `https://vistachase.com/admin/checkin?ref=${bookingReference}&sig=${signature}`;
    const qrDataUrl = await QRCode.toDataURL(checkinUrl);
"""

content = re.sub(r'    // Generate QR code data URL\n    const qrDataUrl = await QRCode\.toDataURL\(\n      JSON\.stringify\(\{\n        ref: bookingReference,\n        voucher: voucherCode,\n        guest: input\.customerName,\n        seats: totalSeats,\n        departure: departure\.date,\n      \}\)\n    \);', qr_logic.strip(), content)

with open('backend/src/modules/bookings/booking.repository.ts', 'w') as f:
    f.write(content)
