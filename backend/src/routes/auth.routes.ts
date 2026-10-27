import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import { Router, type Request, type Response } from "express";
import prisma from "@/lib/db/prisma";
import { hashPassword, verifyPassword, signToken, UserRole } from "@/lib/auth/auth";
import { AUTH_COOKIE_NAME, getSessionUser } from "@/lib/auth/admin-guard";
import { portalFor } from "@/lib/auth/permissions";
import crypto from "node:crypto";
import { getEmailProvider } from "@/lib/email/email.provider";
import { siteUrl } from "@/lib/security/signed-links";
import { emailSchema, parseOr400, z } from "@/lib/security/validate";

const router = Router();

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

// Secure cookies are only stored by browsers on HTTPS. Until the site has HTTPS (it is served on
// plain http://<ip> today), a Secure cookie is silently dropped and nobody can stay signed in.
// So the flag follows the request's own scheme (nginx/Next pass X-Forwarded-Proto; trust proxy
// is on). COOKIE_SECURE=true or false overrides it.
export function secureCookie(req: Request) {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return req.secure;
}

function setAuthCookie(req: Request, res: Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: secureCookie(req),
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
    
    // Guest bookings made with this email join the account only once the email is verified.
    if (user.emailVerified) await linkGuestBookings(user.id, user.email);

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
    });

    setAuthCookie(req, res, token);
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

    setAuthCookie(req, res, token);
    await sendVerificationEmail(user);
    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: false,
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

// The role comes from the database, so the site stops showing staff pages as soon as a role changes.
router.get("/me", async (req, res, next) => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.json({ authenticated: false, user: null });
    }

    return res.json({
      authenticated: true,
      user: { id: user.userId, email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerified, portal: portalFor(user.role) },
    });
  } catch (e) {
    next(e);
  }
});


// Email verification: the link in the welcome email carries a random token; only its SHA-256 hash is
// stored (User.verificationToken) and it works once. A verified email lets the account see and
// manage bookings made with that address before it signed up (ownsBooking in admin-guard.ts).
async function sendVerificationEmail(user: { id: string; email: string; name: string }) {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.user.update({ where: { id: user.id }, data: { verificationToken: sha256(token) } });
  const link = `${siteUrl()}/verify-email?token=${token}`;
  await getEmailProvider()
    .sendEmail({
      to: user.email,
      subject: "Confirm your Vista Chase email",
      html: `<p>Hi ${user.name.replace(/[<>&]/g, "")},</p><p><a href="${link}">Confirm your email address</a> to see every booking made with it under My trips.</p><p>If you didn't create a Vista Chase account, you can ignore this email.</p>`,
      text: `Confirm your Vista Chase email: ${link}\nIf you didn't create a Vista Chase account, ignore this email.`,
    })
    .catch((e) => console.error("Verification email failed:", (e as Error).message));
}

/** Bookings made with this (verified) email before the account existed join the account. */
async function linkGuestBookings(userId: string, email: string) {
  await prisma.booking.updateMany({
    where: { customerEmail: { equals: email, mode: "insensitive" }, customerId: null },
    data: { customerId: userId },
  });
}

router.post("/verify-email", rateLimitMiddleware("verify_email", { maxRequests: 10, windowSeconds: 900 }), async (req, res, next) => {
  try {
    const body = parseOr400(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }), req.body, res);
    if (!body) return;
    const user = await prisma.user.findFirst({ where: { verificationToken: sha256(body.token) }, select: { id: true, email: true } });
    if (!user) return res.status(400).json({ success: false, error: "This confirmation link is invalid or has already been used." });
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true, verificationToken: null } });
    await linkGuestBookings(user.id, user.email);
    return res.json({ success: true, message: "Email confirmed." });
  } catch (error) {
    next(error);
  }
});

// A fresh confirmation link for the signed-in account (the old one stops working).
router.post("/resend-verification", rateLimitMiddleware("resend_verification", { maxRequests: 3, windowSeconds: 900 }), async (req, res, next) => {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ success: false, error: "Sign in first." });
    if (user.emailVerified) return res.json({ success: true, alreadyVerified: true });
    await sendVerificationEmail({ id: user.userId, email: user.email, name: user.name });
    return res.json({ success: true, message: `We've sent a confirmation link to ${user.email}.` });
  } catch (error) {
    next(error);
  }
});

// Password reset: the emailed link carries a random token; only its SHA-256 hash is stored, it
// expires in an hour and works once. Responses never reveal whether an account exists.
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
      // The link reached the inbox, so the email is verified. Every earlier sign-in ends.
      data: {
        passwordHash: await hashPassword(body.newPassword),
        resetToken: null,
        resetTokenExpiry: null,
        lockedUntil: null,
        failedLoginAttempts: 0,
        emailVerified: true,
        verificationToken: null,
        sessionsValidAfter: new Date(),
      },
    });
    await linkGuestBookings(user.id, user.email);
    // Staff accounts: record it (completes an invite on the Staff screen). Never the password or token.
    if (!["CUSTOMER", "AFFILIATE"].includes(user.role)) {
      await prisma.auditLog.create({ data: { userId: user.id, action: "STAFF_PASSWORD_SET", entityType: "User", entityId: user.id, details: {} } });
    }
    return res.json({ success: true, message: "Password updated. You can sign in now." });
  } catch (error) {
    next(error);
  }
});

export default router;
