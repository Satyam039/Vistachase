import re

with open('backend/prisma/schema.prisma', 'r') as f:
    content = f.read()

user_fields = """  role         Role @default(CUSTOMER) // ADMIN, OPERATOR, DISPATCHER, CUSTOMER, AFFILIATE
  failedLoginAttempts Int @default(0)
  lockedUntil         DateTime?
  emailVerified       Boolean @default(false)
  verificationToken   String?
  resetToken          String?
  resetTokenExpiry    DateTime?
"""

content = re.sub(r'  role         Role @default\(CUSTOMER\) // ADMIN, OPERATOR, DISPATCHER, CUSTOMER, AFFILIATE', user_fields.strip(), content)

with open('backend/prisma/schema.prisma', 'w') as f:
    f.write(content)
