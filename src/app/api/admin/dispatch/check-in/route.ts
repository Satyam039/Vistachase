import { NextResponse } from "next/server";
import { getAuthenticatedStaff } from "@/lib/auth/admin-guard";
import { toggleBoardingStatus } from "@/modules/admin/admin.repository";

export async function POST(request: Request) {
  try {
    const staff = getAuthenticatedStaff(["ADMIN", "OPERATOR", "DISPATCHER"]);
    if (!staff) {
      return NextResponse.json({ error: "Access denied. Dispatcher privileges required." }, { status: 403 });
    }

    const body = await request.json();
    const { bookingId, isBoarded } = body;

    if (!bookingId || typeof isBoarded !== "boolean") {
      return NextResponse.json({ error: "bookingId and boolean isBoarded are required." }, { status: 400 });
    }

    const updated = await toggleBoardingStatus(bookingId, isBoarded);

    return NextResponse.json({
      success: true,
      booking: updated,
    });
  } catch (error) {
    console.error("Boarding check-in error:", error);
    return NextResponse.json({ error: "Failed to update boarding status." }, { status: 500 });
  }
}
