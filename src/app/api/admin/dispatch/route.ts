import { NextResponse } from "next/server";
import { getAuthenticatedStaff } from "@/lib/auth/admin-guard";
import { getDispatchManifest } from "@/modules/admin/admin.repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const staff = getAuthenticatedStaff(["ADMIN", "OPERATOR", "DISPATCHER"]);
    if (!staff) {
      return NextResponse.json({ error: "Access denied. Dispatcher privileges required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

    const manifests = await getDispatchManifest(date);
    return NextResponse.json({
      success: true,
      date,
      manifests,
    });
  } catch (error) {
    console.error("Admin dispatch error:", error);
    return NextResponse.json({ error: "Failed to load dispatch manifest." }, { status: 500 });
  }
}
