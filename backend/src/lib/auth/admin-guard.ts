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

/**
 * The signed-in staff member, or null. The role comes from the database on every request, not
 * from the token, so a role change (or a deleted account) takes effect on the next request
 * instead of when the 7-day token expires.
 */
export async function getAuthenticatedStaff(
  req: Request,
  requiredRoles: UserRole[] = ["ADMIN", "OPERATOR", "DISPATCHER"]
): Promise<TokenPayload | null> {
  const payload = getAuthenticatedUser(req);
  if (!payload) return null;

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, email: true, name: true, role: true } });
  if (!user || !hasPermission(user.role as UserRole, requiredRoles)) {
    return null;
  }

  return { userId: user.id, email: user.email, name: user.name, role: user.role as UserRole };
}
