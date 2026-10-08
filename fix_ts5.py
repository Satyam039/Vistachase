import re

with open('backend/src/modules/bokun/bokun.provider.ts', 'r') as f:
    content = f.read()

content = content.replace('specialRequests?: string;', 'specialRequests?: string;\n  promoCode?: string;')

with open('backend/src/modules/bokun/bokun.provider.ts', 'w') as f:
    f.write(content)

with open('backend/src/routes/pricing.routes.ts', 'r') as f:
    content = f.read()

content = content.replace('!departure.tour.bokunId', '!departure.tour?.bokunId')

with open('backend/src/routes/pricing.routes.ts', 'w') as f:
    f.write(content)

