import { NextResponse } from "next/server";
import { getAuthenticatedStaff } from "@/lib/auth/admin-guard";
import { updateDepartureCapacity } from "@/modules/admin/admin.repository";

export async function POST(request: Request) {
  try {
    const staff = getAuthenticatedStaff(["ADMIN", "OPERATOR"]);
    if (!staff) {
      return NextResponse.json({ error: "Access denied. Admin or Operator privileges required." }, { status: 403 });
    }

    const body = await request.json();
    const { departureId, newTotalCapacity } = body;

    if (!departureId || typeof newTotalCapacity !== "number") {
      return NextResponse.json({ error: "departureId and numeric newTotalCapacity are required." }, { status: 400 });
    }

    const result = await updateDepartureCapacity(departureId, newTotalCapacity);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      departure: result.departure,
    });
  } catch (error) {
    console.error("Update capacity error:", error);
    return NextResponse.json({ error: "Failed to update departure capacity." }, { status: 500 });
  }
}
