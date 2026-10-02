import { NextResponse } from "next/server";
import { getAuthenticatedStaff } from "@/lib/auth/admin-guard";
import { getAdminMetrics } from "@/modules/admin/admin.repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const staff = getAuthenticatedStaff(["ADMIN", "OPERATOR", "DISPATCHER"]);
    if (!staff) {
      return NextResponse.json({ error: "Access denied. Staff privileges required." }, { status: 403 });
    }

    const metrics = await getAdminMetrics();
    return NextResponse.json({ success: true, metrics });
  } catch (error) {
    console.error("Admin metrics error:", error);
    return NextResponse.json({ error: "Failed to load metrics." }, { status: 500 });
  }
}
