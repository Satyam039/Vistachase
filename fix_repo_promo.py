import re

with open('backend/src/modules/bookings/booking.repository.ts', 'r') as f:
    content = f.read()

# Add promoCode to input
content = content.replace('  paymentProvider?: "mock" | "stripe";', '  paymentProvider?: "mock" | "stripe";\n  promoCode?: string;')

# Apply discount to totalAmount
promo_logic = """
    let discountPercent = 0;
    if (input.promoCode) {
      const code = input.promoCode.toUpperCase();
      if (code === "RIMROCKBANFF5") discountPercent = 5;
      else if (code === "TESTVISTA100") discountPercent = 100;
      else if (code === "BANFF10") discountPercent = 10;
    }

    const subtotal = fareSubtotal(departure, totalSeats);
    const discountAmount = Math.round(subtotal * (discountPercent / 100));
    const addOnsTotal = (input.addOns || []).reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
    const tax = Math.round((subtotal - discountAmount + addOnsTotal) * 0.05 * 100) / 100; // 5% GST Alberta
    const totalAmount = Math.round((subtotal - discountAmount + addOnsTotal + tax) * 100) / 100;
"""

content = re.sub(r'    const subtotal = fareSubtotal\(departure, totalSeats\);\n    const addOnsTotal = [\s\S]*?const totalAmount = Math\.round\(\(subtotal \+ addOnsTotal \+ tax\) \* 100\) / 100;', promo_logic.strip(), content)

# Pass promoCode to Bókun
content = content.replace('sourceChannel: "WEBSITE",', 'sourceChannel: "WEBSITE",\n          promoCode: input.promoCode,')

with open('backend/src/modules/bookings/booking.repository.ts', 'w') as f:
    f.write(content)

