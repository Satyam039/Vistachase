import re

with open('backend/src/routes/auth.routes.ts', 'r') as f:
    content = f.read()

reset_routes = """
import crypto from "crypto";
// import { getEmailProvider } from "@/lib/email/email.provider"; // Assumed existing

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return res.json({ success: true }); // Silent fail for security
    
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000) }
    });
    
    // In production we would send an email here using getEmailProvider().sendEmail(...)
    console.log(`[AUTH] Password reset token for ${email}: ${token}`);
    
    res.json({ success: true, message: "If an account exists, a reset link was sent." });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: "Invalid request" });
    }
    
    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpiry: { gt: new Date() } }
    });
    
    if (!user) return res.status(400).json({ error: "Invalid or expired token" });
    
    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null, lockedUntil: null, failedLoginAttempts: 0 }
    });
    
    res.json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

"""

content = content.replace('export default router;', reset_routes + 'export default router;')

with open('backend/src/routes/auth.routes.ts', 'w') as f:
    f.write(content)

