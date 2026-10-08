import re

with open('backend/src/routes/webhooks.routes.ts', 'r') as f:
    content = f.read()

content = content.replace('payment: true', 'payments: true')
content = content.replace('booking.payment?', 'booking.payments[0]?')
content = content.replace('booking.payment.', 'booking.payments[0].')

with open('backend/src/routes/webhooks.routes.ts', 'w') as f:
    f.write(content)
