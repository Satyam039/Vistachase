import re

with open('backend/src/routes/auth.routes.ts', 'r') as f:
    content = f.read()

# Replace the login logic
login_logic = """
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }
    
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(403).json({ success: false, error: "Account locked due to too many failed attempts. Try again later." });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const updates: any = { failedLoginAttempts: attempts };
      if (attempts >= 5) {
         updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 mins
      }
      await prisma.user.update({ where: { id: user.id }, data: updates });
      
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }
    
    // Success: reset attempts
    if (user.failedLoginAttempts > 0) {
      await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    }
    
    // Link previous bookings to this user by email!
    await prisma.booking.updateMany({
      where: { customerEmail: normalizedEmail, customerId: null },
      data: { customerId: user.id }
    });
"""

content = re.sub(r'    const user = await prisma\.user\.findUnique\(\{[\s\S]*?if \(\!valid\) \{\n      return res\.status\(401\)\.json\(\{ success: false, error: "Invalid email or password" \}\);\n    \}', login_logic.strip(), content)

with open('backend/src/routes/auth.routes.ts', 'w') as f:
    f.write(content)

