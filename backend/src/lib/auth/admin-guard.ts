import type { Request } from "express";
import prisma from "@/lib/db/prisma";
import { verifyToken, hasPermission, UserRole, TokenPayload } from "@/lib/auth/auth";

export const AUTH_COOKIE_NAME = "vc_token";

export function getRequestToken(req: Request): string | null {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return null;
}

export function getAuthenticatedUser(req: Request): TokenPayload | null {
  const token = getRequestToken(req);
  if (!token) return null;
  return verifyToken(token);
}

export interface SessionUser extends TokenPayload {
  emailVerified: boolean;
}

/** False for a token issued before the account's sessions were revoked (password reset, made staff). */
export function sessionStillValid(iat: number | undefined, validAfter: Date | null | undefined) {
  if (!validAfter) return true;
  return typeof iat === "number" && iat >= Math.floor(validAfter.getTime() / 1000);
}

/**
 * The signed-in account checked against the database: null when the account is gone or the token
 * was issued before its sessions were revoked. Role and email-verified state come from the database.
 */
export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const payload = getAuthenticatedUser(req);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, role: true, emailVerified: true, sessionsValidAfter: true },
  });
  if (!user || !sessionStillValid(payload.iat, user.sessionsValidAfter)) return null;
  return { userId: user.id, email: user.email, name: user.name, role: user.role as UserRole, emailVerified: user.emailVerified };
}

/**
 * Whether the signed-in account owns a booking: one it made while signed in (customerId), or one
 * made with its email once that email is verified. An unverified email proves nothing, so anyone
 * registering someone else's address can't see or cancel that person's bookings.
 */
export function ownsBooking(user: SessionUser | null, booking: { customerId: string | null; customerEmail: string }) {
  if (!user) return false;
  if (booking.customerId && booking.customerId === user.userId) return true;
  return user.emailVerified && user.email.toLowerCase() === booking.customerEmail.toLowerCase();
}

/**
 * The signed-in staff member, or null. The role comes from the database on every request, not
 * from the token, so a role change (or a deleted account) takes effect on the next request
 * instead of when the 7-day token expires.
 */
export async function getAuthenticatedStaff(
  req: Request,
  requiredRoles: UserRole[] = ["ADMIN", "OPERATOR", "DISPATCHER"]
): Promise<TokenPayload | null> {
  const user = await getSessionUser(req);
  if (!user || !hasPermission(user.role, requiredRoles)) {
    return null;
  }

  return { userId: user.userId, email: user.email, name: user.name, role: user.role };
}
