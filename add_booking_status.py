import re

with open('backend/prisma/schema.prisma', 'r') as f:
    content = f.read()

# Define the Enum
enum_str = """
enum BookingStatus {
  PENDING_PAYMENT
  CONFIRMED
  CANCELLED
  REFUNDED
}
"""

if 'enum BookingStatus' not in content:
    content = content.replace('enum DepartureStatus {', enum_str + '\nenum DepartureStatus {')

# Add status field to Booking
if 'status                 BookingStatus' not in content:
    content = content.replace('  customerPhone          String\n', '  customerPhone          String\n  status                 BookingStatus @default(CONFIRMED)\n')

with open('backend/prisma/schema.prisma', 'w') as f:
    f.write(content)
