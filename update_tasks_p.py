import re

with open('/Users/visithealth/.gemini/antigravity/brain/93bd20a9-c5af-4ddd-8992-4218307b8f3c/task.md', 'r') as f:
    content = f.read()

tasks = [
    ("P1: Stripe Payment Intents", "[x]"),
    ("P2: Payment Element", "[x]"),
    ("P3: Stripe webhook", "[x]"),
    ("P4: Booking states", "[x]"),
    ("P5: Refunds by policy", "[x]"),
    ("P6: Receipts with GST", "[x]"),
    ("P7: Payout reconciliation", "[x]")
]

for old, check in tasks:
    content = re.sub(rf'- `\[.*?\]` ({old}.*)', rf'- `{check}` \1', content)

with open('/Users/visithealth/.gemini/antigravity/brain/93bd20a9-c5af-4ddd-8992-4218307b8f3c/task.md', 'w') as f:
    f.write(content)
