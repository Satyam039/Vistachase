import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { verifyToken } from "@/lib/auth/auth";
import { cancelBooking } from "@/modules/bookings/booking.repository";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookingReference, email } = body;

    if (!bookingReference) {
      return NextResponse.json({ error: "Booking reference is required." }, { status: 400 });
    }

    // Optional auth check: if user is logged in, use their email; otherwise use email from body
    let customerEmail = email;
    const cookieStore = cookies();
    let token = cookieStore.get("vc_token")?.value;

    if (!token) {
      const headerList = headers();
      const authHeader = headerList.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        customerEmail = payload.email;
      }
    }

    const result = await cancelBooking(bookingReference, customerEmail);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      booking: result.booking,
    });
  } catch (error) {
    console.error("Cancellation API error:", error);
    return NextResponse.json({ error: "Failed to process cancellation." }, { status: 500 });
  }
}
