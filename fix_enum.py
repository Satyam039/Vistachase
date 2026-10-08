import re

with open('backend/prisma/schema.prisma', 'r') as f:
    content = f.read()

content = content.replace('  CANCELLED\n  COMPLETED', '  CANCELLED\n  REFUNDED\n  COMPLETED')

with open('backend/prisma/schema.prisma', 'w') as f:
    f.write(content)

