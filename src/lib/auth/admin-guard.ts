import { cookies, headers } from "next/headers";
import { verifyToken, hasPermission, UserRole, TokenPayload } from "@/lib/auth/auth";

export function getAuthenticatedStaff(requiredRoles: UserRole[] = ["ADMIN", "OPERATOR", "DISPATCHER"]): TokenPayload | null {
  const cookieStore = cookies();
  let token = cookieStore.get("vc_token")?.value;

  if (!token) {
    const headerList = headers();
    const authHeader = headerList.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  if (!hasPermission(payload.role, requiredRoles)) {
    return null;
  }

  return payload;
}
