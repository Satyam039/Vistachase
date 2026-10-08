import re

with open('backend/src/lib/ai/concierge.agent.ts', 'r') as f:
    content = f.read()

# Filter CUSTOMER_TOOLS if in production
production_filter = """
    ...CUSTOMER_TOOLS.filter(t => process.env.NODE_ENV !== "production" || !["hold_seats", "cancel_booking"].includes(t.name)),
"""

content = content.replace('...CUSTOMER_TOOLS,', production_filter.strip())

with open('backend/src/lib/ai/concierge.agent.ts', 'w') as f:
    f.write(content)

