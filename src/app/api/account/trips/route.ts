import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { verifyToken } from "@/lib/auth/auth";
import { getCustomerBookings } from "@/modules/bookings/booking.repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const cookieStore = cookies();
    let token = cookieStore.get("vc_token")?.value;

    if (!token) {
      const headerList = headers();
      const authHeader = headerList.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
    }

    const bookings = await getCustomerBookings(payload.email);

    return NextResponse.json({
      success: true,
      bookings,
    });
  } catch (error) {
    console.error("Fetch trips error:", error);
    return NextResponse.json({ error: "Failed to load customer trips." }, { status: 500 });
  }
}
