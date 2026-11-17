import { Router } from "express";
import crypto from "node:crypto";
import prisma from "@/lib/db/prisma";
import { AUTH_COOKIE_NAME, getSessionUser } from "@/lib/auth/admin-guard";
import { hashPassword, signToken, verifyPassword, type UserRole } from "@/lib/auth/auth";
import { secureCookie } from "@/routes/auth.routes";
import { renderAccountDeletedEmail, renderPasswordChangedEmail } from "@/lib/email/account-security-email";
import { dateOnly, todayInMountainTime } from "@/lib/utils/time";
import { getCustomerBookings } from "@/modules/bookings/booking.repository";
import { paymentSummary } from "@/modules/bookings/deposit";
import { tripOf } from "@/modules/bookings/trip";
import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import { getEmailProvider } from "@/lib/email/email.provider";
import { siteUrl } from "@/lib/security/signed-links";
import { renderEmailChangeVerificationEmail, renderEmailChangedConfirmationEmail } from "@/lib/email/email-change-email";
import { renderPhoneChangedEmail } from "@/lib/email/phone-changed-email";
import { hasValidMxRecords, isSuspiciousEmail } from "@/lib/security/spam-detector";

const router = Router();
const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

// My Account (/account/settings) checks. Names are stored as one "First Last" string (User.name),
// so first and last name are joined here and split again by the page.
const NAME_MAX = 60;
// Digits with the usual separators and an optional leading +: 7 to 15 digits (E.164 allows 15).
const PHONE_CHARS = /^\+?[0-9\s().-]+$/;
function phoneProblem(phone: string): string | null {
  if (!PHONE_CHARS.test(phone)) return "Please enter a phone number using digits only (a leading + is fine).";
  const digits = phone.replace(/\D/g, "").length;
  if (digits < 7 || digits > 15) return "Please enter a full phone number, including the country code.";
  return null;
}
// Bookings that still need the guest: not cancelled, refunded, expired or completed, and the tour
// date hasn't passed (Mountain Time).
const ACTIVE_STATUSES = ["CONFIRMED", "PENDING_PAYMENT", "PAID_UNSYNCED"] as const;

router.get("/trips", async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized. Please sign in." });
    }

    const rows = await getCustomerBookings(user);
    // Amounts in dollars, like GET /api/bookings (the database keeps cents). emailVerified: false
    // tells the page to offer the confirmation link, which brings in bookings made with this email
    // before the account existed.
    // trip: the multi-day trip a booking is a day of (title, Day 1 reference, day N of M), so the
    // page can show the days together under one reference. The price snapshot itself stays here.
    const bookings = rows.map(({ payments, flags, priceSnapshot, ...b }) => ({
      ...b,
      trip: tripOf(priceSnapshot, b.bookingReference),
      cancelRequest: flags[0]
        ? {
            status: flags[0].status === "OPEN" ? ("PENDING" as const) : flags[0].resolution?.startsWith("Declined") ? ("DECLINED" as const) : ("CLOSED" as const),
            reason: flags[0].resolution?.startsWith("Declined: ") ? flags[0].resolution.slice("Declined: ".length) : null,
            requestedAt: flags[0].createdAt,
            answeredAt: flags[0].resolvedAt,
          }
        : null,
      totalAmount: b.totalAmount / 100,
      ...paymentSummary(b, payments),
    }));
    return res.json({ success: true, bookings, emailVerified: user.emailVerified });
  } catch (error) {
    console.error("Fetch trips error:", error);
    return res.status(500).json({ error: "Failed to load customer trips." });
  }
});

/** Manage Profile & Account Settings: Get User Profile */
router.get("/profile", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return res.status(401).json({ success: false, error: "Please sign in to view your profile." });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        emailVerified: true,
        pendingEmail: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: "User profile not found." });
    }

    return res.json({ success: true, user });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({ success: false, error: "Failed to load profile." });
  }
});

/** Manage Profile & Account Settings: Update Personal Information (First/Last Name, Phone) */
router.patch(
  "/profile",
  rateLimitMiddleware("profile_update", { maxRequests: 10, windowSeconds: 900 }),
  async (req, res) => {
    try {
      const session = await getSessionUser(req);
      if (!session) {
        return res.status(401).json({ success: false, error: "Please sign in to update your profile." });
      }

      const { firstName, lastName, phone } = req.body ?? {};
      let { name } = req.body ?? {};
      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found." });
      }

      // First and last name (My Account) or one full name (older callers).
      if (typeof firstName === "string" || typeof lastName === "string") {
        const first = typeof firstName === "string" ? firstName.trim().replace(/\s+/g, " ") : "";
        const last = typeof lastName === "string" ? lastName.trim().replace(/\s+/g, " ") : "";
        if (!first) return res.status(400).json({ success: false, error: "Please enter your first name." });
        if (first.length > NAME_MAX || last.length > NAME_MAX) {
          return res.status(400).json({ success: false, error: `Names can be at most ${NAME_MAX} characters.` });
        }
        name = [first, last].filter(Boolean).join(" ");
      }

      const updates: { name?: string; phone?: string | null } = {};
      if (typeof name === "string") {
        const trimmedName = name.trim().replace(/\s+/g, " ");
        if (trimmedName.length < 2) {
          return res.status(400).json({ success: false, error: "Name must be at least 2 characters long." });
        }
        if (trimmedName.length > NAME_MAX * 2 + 1) {
          return res.status(400).json({ success: false, error: "That name is too long." });
        }
        if (/[<>]/.test(trimmedName)) {
          return res.status(400).json({ success: false, error: "Names can't contain < or >." });
        }
        updates.name = trimmedName;
      }

      const currentPhone = (user.phone || "").trim();
      let phoneUpdated = false;
      if (typeof phone === "string") {
        const trimmedPhone = phone.trim();
        const problem = trimmedPhone ? phoneProblem(trimmedPhone) : null;
        if (problem) return res.status(400).json({ success: false, error: problem });
        if (trimmedPhone !== currentPhone) {
          updates.phone = trimmedPhone || null;
          phoneUpdated = true;
        }
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: updates,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          emailVerified: true,
          pendingEmail: true,
        },
      });

      // Send confirmation notification after successful phone number update
      if (phoneUpdated && updated.phone) {
        const phoneEmail = renderPhoneChangedEmail({
          name: updated.name,
          phone: updated.phone,
          site: siteUrl(),
        });
        await getEmailProvider()
          .sendEmail({
            to: updated.email,
            subject: phoneEmail.subject,
            html: phoneEmail.html,
            text: phoneEmail.text,
          })
          .catch((e) => console.error("Phone update confirmation email failed:", (e as Error).message));
      }

      return res.json({
        success: true,
        user: updated,
        message: "Profile updated successfully.",
      });
    } catch (error) {
      console.error("Update profile error:", error);
      return res.status(500).json({ success: false, error: "Failed to update profile." });
    }
  }
);

/** Manage Profile & Account Settings: Request Email Change */
router.post(
  "/change-email",
  rateLimitMiddleware("change_email", { maxRequests: 5, windowSeconds: 1800 }),
  async (req, res) => {
    try {
      const session = await getSessionUser(req);
      if (!session) {
        return res.status(401).json({ success: false, error: "Please sign in to change your email." });
      }

      const { newEmail, password } = req.body ?? {};
      if (!newEmail || !password) {
        return res.status(400).json({ success: false, error: "New email and current password are required." });
      }

      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found." });
      }

      // Verify password
      const passwordOk = await verifyPassword(password, user.passwordHash);
      if (!passwordOk) {
        return res.status(401).json({ success: false, error: "Incorrect password." });
      }

      const normalizedNewEmail = String(newEmail).toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedNewEmail)) {
        return res.status(400).json({ success: false, error: "Please enter a valid email address." });
      }

      if (normalizedNewEmail === user.email.toLowerCase()) {
        return res.status(400).json({ success: false, error: "New email address must be different from your current email." });
      }

      if (isSuspiciousEmail(normalizedNewEmail)) {
        return res.status(400).json({ success: false, error: "This email domain is not supported." });
      }

      const domain = normalizedNewEmail.split("@")[1];
      if (domain && !(await hasValidMxRecords(domain))) {
        return res.status(400).json({ success: false, error: "The provided email domain cannot receive messages." });
      }

      // Check if new email is already in use by another account
      const existing = await prisma.user.findUnique({ where: { email: normalizedNewEmail } });
      if (existing) {
        return res.status(409).json({ success: false, error: "An account with this email address already exists." });
      }

      // Generate verification token (expires in 24 hours)
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = sha256(rawToken);
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          pendingEmail: normalizedNewEmail,
          emailChangeToken: hashedToken,
          emailChangeExpiry: expiry,
        },
      });

      const verificationLink = `${siteUrl()}/verify-email-change?token=${rawToken}`;
      const changeEmail = renderEmailChangeVerificationEmail({
        name: user.name,
        newEmail: normalizedNewEmail,
        link: verificationLink,
        site: siteUrl(),
      });

      await getEmailProvider()
        .sendEmail({
          to: normalizedNewEmail,
          subject: changeEmail.subject,
          html: changeEmail.html,
          text: changeEmail.text,
        })
        .catch((e) => console.error("Email change verification dispatch failed:", (e as Error).message));

      return res.json({
        success: true,
        message: `We've sent a confirmation link to ${normalizedNewEmail}. Please check your inbox to confirm the change.`,
      });
    } catch (error) {
      console.error("Change email error:", error);
      return res.status(500).json({ success: false, error: "Failed to request email change." });
    }
  }
);

/** Manage Profile & Account Settings: Confirm Email Change */
router.post(
  "/verify-email-change",
  rateLimitMiddleware("verify_email_change", { maxRequests: 10, windowSeconds: 900 }),
  async (req, res) => {
    try {
      const { token } = req.body ?? {};
      if (!token || typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
        return res.status(400).json({ success: false, error: "Invalid or missing token." });
      }

      const hashedToken = sha256(token);
      const user = await prisma.user.findFirst({
        where: {
          emailChangeToken: hashedToken,
          emailChangeExpiry: { gt: new Date() },
          pendingEmail: { not: null },
        },
      });

      if (!user || !user.pendingEmail) {
        return res.status(400).json({ success: false, error: "This confirmation link is invalid or has expired." });
      }

      const oldEmail = user.email;
      const newEmail = user.pendingEmail;

      // Someone may have registered the address since the link was sent.
      const taken = await prisma.user.findFirst({ where: { email: { equals: newEmail, mode: "insensitive" }, id: { not: user.id } } });
      if (taken) {
        await prisma.user.update({ where: { id: user.id }, data: { pendingEmail: null, emailChangeToken: null, emailChangeExpiry: null } });
        return res.status(409).json({ success: false, error: "Another account now uses this email address, so it can't be moved to yours." });
      }

      await prisma.$transaction([
        // Trips this account saw through its old verified email stay on the account after the
        // switch (My Trips also finds bookings by the account's current email).
        ...(user.emailVerified
          ? [prisma.booking.updateMany({ where: { customerId: null, customerEmail: { equals: oldEmail, mode: "insensitive" } }, data: { customerId: user.id } })]
          : []),
        // The new address is verified now, so its guest bookings join the account too.
        prisma.booking.updateMany({ where: { customerId: null, customerEmail: { equals: newEmail, mode: "insensitive" } }, data: { customerId: user.id } }),
        prisma.user.update({
          where: { id: user.id },
          data: {
            email: newEmail,
            emailVerified: true,
            verificationToken: null,
            pendingEmail: null,
            emailChangeToken: null,
            emailChangeExpiry: null,
          },
        }),
      ]);

      // Send confirmation notification to old email and new email
      const confirmationEmail = renderEmailChangedConfirmationEmail({
        name: user.name,
        newEmail,
        site: siteUrl(),
      });

      await Promise.allSettled([
        getEmailProvider().sendEmail({
          to: oldEmail,
          subject: confirmationEmail.subject,
          html: confirmationEmail.html,
          text: confirmationEmail.text,
        }),
        getEmailProvider().sendEmail({
          to: newEmail,
          subject: confirmationEmail.subject,
          html: confirmationEmail.html,
          text: confirmationEmail.text,
        }),
      ]);

      return res.json({
        success: true,
        message: "Your email address has been successfully updated.",
      });
    } catch (error) {
      console.error("Verify email change error:", error);
      return res.status(500).json({ success: false, error: "Failed to verify email change." });
    }
  }
);

/** Cancel an email change that hasn't been confirmed yet (the link stops working). */
router.delete("/change-email", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ success: false, error: "Please sign in." });
    await prisma.user.update({ where: { id: session.userId }, data: { pendingEmail: null, emailChangeToken: null, emailChangeExpiry: null } });
    return res.json({ success: true, message: "The email change was cancelled." });
  } catch (error) {
    console.error("Cancel email change error:", error);
    return res.status(500).json({ success: false, error: "Failed to cancel the email change." });
  }
});

/**
 * Account Security: change the password. Needs the current one. Every other sign-in ends
 * (sessionsValidAfter); this browser gets a fresh sign-in so it stays signed in.
 */
router.post(
  "/password",
  rateLimitMiddleware("change_password", { maxRequests: 5, windowSeconds: 900 }),
  async (req, res) => {
    try {
      const session = await getSessionUser(req);
      if (!session) return res.status(401).json({ success: false, error: "Please sign in to change your password." });

      const { currentPassword, newPassword } = req.body ?? {};
      if (typeof currentPassword !== "string" || typeof newPassword !== "string" || !currentPassword) {
        return res.status(400).json({ success: false, error: "Current and new password are required." });
      }
      if (newPassword.length < 8 || newPassword.length > 200) {
        return res.status(400).json({ success: false, error: "The new password must be at least 8 characters." });
      }

      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (!user) return res.status(404).json({ success: false, error: "User not found." });
      if (!(await verifyPassword(currentPassword, user.passwordHash))) {
        return res.status(401).json({ success: false, error: "Your current password is incorrect." });
      }
      if (await verifyPassword(newPassword, user.passwordHash)) {
        return res.status(400).json({ success: false, error: "The new password must be different from the current one." });
      }

      // Whole seconds: token iat is in seconds, so this browser's new token (signed below) is valid.
      const validAfter = new Date(Math.floor(Date.now() / 1000) * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(newPassword), sessionsValidAfter: validAfter, resetToken: null, resetTokenExpiry: null },
      });

      const token = signToken({ userId: user.id, email: user.email, role: user.role as UserRole, name: user.name });
      res.cookie(AUTH_COOKIE_NAME, token, { httpOnly: true, secure: secureCookie(req), sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 7, path: "/" });

      const notice = renderPasswordChangedEmail({ name: user.name, site: siteUrl() });
      await getEmailProvider()
        .sendEmail({ to: user.email, subject: notice.subject, html: notice.html, text: notice.text })
        .catch((e) => console.error("Password changed email failed:", (e as Error).message));

      return res.json({ success: true, message: "Password changed. Other devices have been signed out." });
    } catch (error) {
      console.error("Change password error:", error);
      return res.status(500).json({ success: false, error: "Failed to change password." });
    }
  }
);

/** Account Security: sign out every device, this one included. */
router.post("/sign-out-everywhere", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ success: false, error: "Please sign in." });
    // One second ahead so a token issued in this same second is refused too.
    await prisma.user.update({ where: { id: session.userId }, data: { sessionsValidAfter: new Date(Date.now() + 1000) } });
    res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
    return res.json({ success: true, message: "You've been signed out on every device." });
  } catch (error) {
    console.error("Sign out everywhere error:", error);
    return res.status(500).json({ success: false, error: "Failed to sign out." });
  }
});

/** Manage Profile & Account Settings: Delete Account Permanently */
router.delete(
  "/",
  rateLimitMiddleware("delete_account", { maxRequests: 3, windowSeconds: 3600 }),
  async (req, res) => {
    try {
      const session = await getSessionUser(req);
      if (!session) {
        return res.status(401).json({ success: false, error: "Please sign in to delete your account." });
      }

      const { password, confirm } = req.body ?? {};
      if (!password || typeof password !== "string") {
        return res.status(400).json({ success: false, error: "Password is required to permanently delete your account." });
      }
      if (typeof confirm !== "string" || confirm.trim().toUpperCase() !== "DELETE") {
        return res.status(400).json({ success: false, error: 'Type DELETE to confirm.' });
      }

      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found." });
      }

      // Verify password
      const passwordOk = await verifyPassword(password, user.passwordHash);
      if (!passwordOk) {
        return res.status(401).json({ success: false, error: "Incorrect password." });
      }

      // Do not allow staff/admin accounts to self-delete via customer account deletion
      if (user.role !== "CUSTOMER") {
        return res.status(403).json({
          success: false,
          error: "Staff and administrative accounts cannot be deleted from the customer portal.",
        });
      }

      // Upcoming trips still need the guest (pickup messages, changes, refunds), so they are
      // cancelled or taken first. The page lists them.
      const upcoming = await prisma.booking.findMany({
        where: {
          status: { in: [...ACTIVE_STATUSES] },
          tourDeparture: { date: { gte: dateOnly(todayInMountainTime()) } },
          OR: [{ customerId: user.id }, ...(user.emailVerified ? [{ customerEmail: { equals: user.email, mode: "insensitive" as const } }] : [])],
        },
        select: { bookingReference: true },
        orderBy: { createdAt: "asc" },
      });
      if (upcoming.length > 0) {
        return res.status(409).json({
          success: false,
          code: "UPCOMING_TRIPS",
          upcoming: upcoming.map((b) => b.bookingReference),
          error: "You have upcoming trips on this account. Please cancel them from My Trips, or contact us, before deleting your account.",
        });
      }

      // The account goes; booking and payment records stay (tax, refunds, chargebacks) but are no
      // longer tied to a sign-in (Booking.customerId is set to null by the relation). The audit row
      // keeps only the account id and how many bookings it had, no personal details.
      const kept = await prisma.booking.count({ where: { customerId: user.id } });
      await prisma.$transaction([
        prisma.auditLog.create({ data: { userId: null, action: "ACCOUNT_DELETED_BY_CUSTOMER", entityType: "User", entityId: user.id, details: { bookingsKept: kept } } }),
        prisma.user.delete({ where: { id: user.id } }),
      ]);

      const notice = renderAccountDeletedEmail({ name: user.name, site: siteUrl() });
      await getEmailProvider()
        .sendEmail({ to: user.email, subject: notice.subject, html: notice.html, text: notice.text })
        .catch((e) => console.error("Account deleted email failed:", (e as Error).message));

      // Clear authentication cookie
      res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });

      return res.json({
        success: true,
        message: "Your account has been permanently deleted.",
      });
    } catch (error) {
      console.error("Delete account error:", error);
      return res.status(500).json({ success: false, error: "Failed to delete account." });
    }
  }
);

export default router;
