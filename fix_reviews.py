import re

with open('backend/src/modules/reviews/review.repository.ts', 'r') as f:
    content = f.read()

logic = """
  if (!booking) {
    return { success: false, error: "Verified booking not found for this reference" };
  }
  
  if (booking.status !== "COMPLETED") {
    return { success: false, error: "Reviews can only be submitted after the trip has been completed" };
  }
"""

content = content.replace("""  if (!booking) {
    return { success: false, error: "Verified booking not found for this reference" };
  }""", logic.strip())

with open('backend/src/modules/reviews/review.repository.ts', 'w') as f:
    f.write(content)
