import re

with open('/Users/visithealth/.gemini/antigravity/brain/93bd20a9-c5af-4ddd-8992-4218307b8f3c/task.md', 'r') as f:
    content = f.read()

tasks = [
    ("J1: Job runner", "[x]"),
    ("J2: Scheduled jobs", "[x]"),
    ("A1: Enquiry inbox", "[x]"),
    ("A2: Booking management in admin", "[x]"),
    ("A3: Audit log wired up", "[x]"),
    ("A4: Operations scope", "[x]"),
    ("A5: Staff and role management", "[x]")
]

for old, check in tasks:
    content = re.sub(rf'- `\[.*?\]` ({old}.*)', rf'- `{check}` \1', content)

with open('/Users/visithealth/.gemini/antigravity/brain/93bd20a9-c5af-4ddd-8992-4218307b8f3c/task.md', 'w') as f:
    f.write(content)
