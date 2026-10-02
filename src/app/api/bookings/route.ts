import { NextResponse } from "next/server";
import {
  createBooking,
  getBookingByReference,
} from "@/modules/bookings/booking.repository";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      departureId,
      holdToken,
      customerName,
      customerEmail,
      customerPhone,
      pickupStopId,
      pickupCustomText,
      adultsCount,
      childrenCount,
      infantsCount,
      specialRequests,
      addOns,
      paymentProvider,
    } = body;

    if (!departureId || !customerName || !customerEmail) {
      return NextResponse.json(
        { success: false, error: "Missing required booking details" },
        { status: 400 }
      );
    }

    const result = await createBooking({
      departureId,
      holdToken,
      customerName,
      customerEmail,
      customerPhone: customerPhone || "+1-000-000-0000",
      pickupStopId,
      pickupCustomText,
      adultsCount: parseInt(adultsCount || "1", 10),
      childrenCount: parseInt(childrenCount || "0", 10),
      infantsCount: parseInt(infantsCount || "0", 10),
      specialRequests,
      addOns: addOns || [],
      paymentProvider: paymentProvider || "mock",
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      booking: result.booking,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Booking failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ref = searchParams.get("ref");

    if (!ref) {
      return NextResponse.json(
        { success: false, error: "Missing booking reference" },
        { status: 400 }
      );
    }

    const booking = await getBookingByReference(ref);
    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, booking });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Failed to retrieve booking" },
      { status: 500 }
    );
  }
}
