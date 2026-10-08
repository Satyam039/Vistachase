import re

with open('/Users/visithealth/.gemini/antigravity/brain/93bd20a9-c5af-4ddd-8992-4218307b8f3c/task.md', 'r') as f:
    content = f.read()

tasks = [
    ("C1: Accounts", "[x]"),
    ("C2: Vouchers and check-in", "[x]"),
    ("C3: Reviews from booking owner", "[x]"),
    ("C4: AI concierge for production", "[x]"),
    ("C5: Remove frontend fallback", "[x]"),
    ("C6: Live tracking from real GPS", "[x]"),
    ("C7: Partner commissions ledger", "[x]")
]

for old, check in tasks:
    content = re.sub(rf'- `\[.*?\]` ({old}.*)', rf'- `{check}` \1', content)

with open('/Users/visithealth/.gemini/antigravity/brain/93bd20a9-c5af-4ddd-8992-4218307b8f3c/task.md', 'w') as f:
    f.write(content)
