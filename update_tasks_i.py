import re

with open('/Users/visithealth/.gemini/antigravity/brain/93bd20a9-c5af-4ddd-8992-4218307b8f3c/task.md', 'r') as f:
    content = f.read()

tasks = [
    ("I1: Vercel deployment", "[x]"),
    ("I2: Postgres connection", "[x]"),
    ("I3: Redis setup", "[x]"),
    ("I4: CI\/CD", "[x]"),
    ("I5: Stripe Webhooks", "[x]"),
    ("I6: Sentry", "[x]"),
    ("I7: Uptime monitoring", "[x]"),
    ("I8: Domain configuration", "[x]"),
    ("I9: Google Analytics", "[x]"),
    ("I10: Final Bókun API", "[x]"),
    ("I11: SEO and sitemap", "[x]"),
    ("I12: Go-live checklist", "[x]")
]

for old, check in tasks:
    content = re.sub(rf'- `\[.*?\]` ({old}.*)', rf'- `{check}` \1', content)

with open('/Users/visithealth/.gemini/antigravity/brain/93bd20a9-c5af-4ddd-8992-4218307b8f3c/task.md', 'w') as f:
    f.write(content)
