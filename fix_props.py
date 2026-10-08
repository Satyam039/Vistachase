import re

with open('frontend/src/components/booking/BookingCheckoutClient.tsx', 'r') as f:
    content = f.read()

content = content.replace('disabled={isApplyingPromo}', 'isDisabled={isApplyingPromo}')
content = content.replace('disabled={!promoCodeInput.trim() || isApplyingPromo}', 'isDisabled={!promoCodeInput.trim() || isApplyingPromo}')

with open('frontend/src/components/booking/BookingCheckoutClient.tsx', 'w') as f:
    f.write(content)
