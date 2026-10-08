import re

with open('/Users/visithealth/.gemini/antigravity/brain/93bd20a9-c5af-4ddd-8992-4218307b8f3c/task.md', 'r') as f:
    content = f.read()

tasks = [
    ("N1: Sending domain verification", "[x]"),
    ("N2: Email templates in brand", "[x]"),
    ("N3: Send through job queue", "[x]"),
    ("N4: Pickup-day messages", "[x]"),
    ("N5: Canadian anti-spam", "[x]"),
    ("N6: Post-trip review request", "[x]")
]

for old, check in tasks:
    content = re.sub(rf'- `\[.*?\]` ({old}.*)', rf'- `{check}` \1', content)

with open('/Users/visithealth/.gemini/antigravity/brain/93bd20a9-c5af-4ddd-8992-4218307b8f3c/task.md', 'w') as f:
    f.write(content)
