import type { Request } from "express";
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

export function getAuthenticatedStaff(
  req: Request,
  requiredRoles: UserRole[] = ["ADMIN", "OPERATOR", "DISPATCHER"]
): TokenPayload | null {
  const payload = getAuthenticatedUser(req);
  if (!payload) return null;

  if (!hasPermission(payload.role, requiredRoles)) {
    return null;
  }

  return payload;
}
