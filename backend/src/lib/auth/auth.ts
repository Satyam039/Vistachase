import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export type UserRole = "ADMIN" | "OPERATOR" | "DISPATCHER" | "CUSTOMER" | "AFFILIATE" | "SEO_MANAGER" | "EDITOR" | "VIEWER";

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  /** Issued-at, seconds (set by jsonwebtoken). */
  iat?: number;
}

const JWT_SECRET = process.env.JWT_SECRET!;

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * How long a sign-in lasts: guests, partners and staff sign in again after this (owner, 2026-11-26:
 * "users and affiliates should not stay logged in indefinitely, re-login after about 2-3 days").
 * The session cookie and the token both end then, and a token older than this is refused even if
 * it was issued with a longer lifetime before the change (the old 7-day tokens). SESSION_MAX_DAYS
 * (1-30) overrides the 3-day default.
 */
export function sessionMaxAgeSeconds(): number {
  const days = Number(process.env.SESSION_MAX_DAYS);
  return Math.round((Number.isFinite(days) && days >= 1 && days <= 30 ? days : 3) * 86_400);
}

/** The session cookie's maxAge (milliseconds), the same lifetime as the token. */
export const sessionCookieMaxAgeMs = () => sessionMaxAgeSeconds() * 1000;

export function signToken(payload: TokenPayload, expiresIn: string = `${sessionMaxAgeSeconds()}s`): string {
  // iat is set by jsonwebtoken; a stale one from a decoded payload must not be signed again.
  const { iat: _iat, ...claims } = payload;
  return jwt.sign(claims, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string, now = Date.now()): TokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload & { exp?: number };
    // Older than the session lifetime: sign in again (also ends tokens issued for 7 days).
    if (typeof payload.iat !== "number" || payload.iat < Math.floor(now / 1000) - sessionMaxAgeSeconds()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hasPermission(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  if (userRole === "ADMIN") return true;
  return requiredRoles.includes(userRole);
}
