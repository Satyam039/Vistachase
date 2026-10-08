import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import { Router, Response } from "express";
import prisma from "@/lib/db/prisma";
import { hashPassword, verifyPassword, signToken, UserRole } from "@/lib/auth/auth";
import { AUTH_COOKIE_NAME, getAuthenticatedUser } from "@/lib/auth/admin-guard";
import crypto from "node:crypto";
import { getEmailProvider } from "@/lib/email/email.provider";
import { siteUrl } from "@/lib/security/signed-links";
import { emailSchema, parseOr400, z } from "@/lib/security/validate";

const router = Router();

function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

router.post("/login", rateLimitMiddleware("login", { maxRequests: 5, windowSeconds: 300 }), async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

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

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
    });

    setAuthCookie(res, token);
    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: "Login failed" });
  }
});

router.post("/register", rateLimitMiddleware("register", { maxRequests: 3, windowSeconds: 3600 }), async (req, res) => {
  try {
    const { name, email, password, phone } = req.body ?? {};

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "Name, email, and password are required" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ success: false, error: "Use a password of at least 8 characters" });
    }
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, error: "Enter a valid email address" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return res.status(409).json({ success: false, error: "An account with this email already exists" });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        phone,
        role: "CUSTOMER",
      },
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as "CUSTOMER",
    });

    setAuthCookie(res, token);
    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: "Registration failed" });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
  return res.json({ success: true, message: "Logged out" });
});

router.get("/me", (req, res) => {
  const payload = getAuthenticatedUser(req);
  if (!payload) {
    return res.json({ authenticated: false, user: null });
  }

  return res.json({
    authenticated: true,
    user: {
      id: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    },
  });
});


// Password reset: the emailed link carries a random token; only its SHA-256 hash is stored, it
// expires in an hour and works once. Responses never reveal whether an account exists.
const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

router.post("/forgot-password", rateLimitMiddleware("forgot_password", { maxRequests: 3, windowSeconds: 900 }), async (req, res, next) => {
  try {
    const body = parseOr400(z.object({ email: emailSchema }), req.body, res);
    if (!body) return;
    const done = { success: true, message: "If an account exists for that email, we've sent a reset link." };

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) return res.json(done);

    const token = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: sha256(token), resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const link = `${siteUrl()}/reset-password?token=${token}`;
    await getEmailProvider()
      .sendEmail({
        to: user.email,
        subject: "Reset your Vista Chase password",
        html: `<p>Hi ${user.name.replace(/[<>&]/g, "")},</p><p><a href="${link}">Choose a new password</a>. This link works once and expires in an hour.</p><p>If you didn't ask for this, you can ignore this email.</p>`,
        text: `Choose a new Vista Chase password: ${link}\nThis link works once and expires in an hour. If you didn't ask for this, ignore this email.`,
      })
      .catch((e) => console.error("Password reset email failed:", (e as Error).message));
    return res.json(done);
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", rateLimitMiddleware("reset_password", { maxRequests: 5, windowSeconds: 900 }), async (req, res, next) => {
  try {
    const body = parseOr400(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), newPassword: z.string().min(8).max(200) }), req.body, res);
    if (!body) return;
    const user = await prisma.user.findFirst({ where: { resetToken: sha256(body.token), resetTokenExpiry: { gt: new Date() } } });
    if (!user) return res.status(400).json({ success: false, error: "This reset link is invalid or has expired." });

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.newPassword), resetToken: null, resetTokenExpiry: null, lockedUntil: null, failedLoginAttempts: 0 },
    });
    return res.json({ success: true, message: "Password updated. You can sign in now." });
  } catch (error) {
    next(error);
  }
});

export default router;
