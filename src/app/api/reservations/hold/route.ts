import { NextResponse } from "next/server";
import {
  createReservationHold,
  getHoldStatus,
  releaseHold,
} from "@/modules/reservations/reservation.repository";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { departureId, seatsCount, customerName, customerEmail, customerPhone } = body;

    if (!departureId || !seatsCount || !customerName || !customerEmail) {
      return NextResponse.json(
        { success: false, error: "Missing required hold parameters" },
        { status: 400 }
      );
    }

    const result = await createReservationHold({
      departureId,
      seatsCount: parseInt(seatsCount, 10),
      customerName,
      customerEmail,
      customerPhone,
      holdDurationSeconds: 600, // 10 minutes
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      holdToken: result.holdToken,
      expiresAt: result.expiresAt,
      remainingSeconds: result.remainingSeconds,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Failed to create reservation hold" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing hold token" },
        { status: 400 }
      );
    }

    const status = await getHoldStatus(token);
    return NextResponse.json({ success: true, ...status });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Failed to check hold status" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing hold token" },
        { status: 400 }
      );
    }

    const released = await releaseHold(token);
    return NextResponse.json({ success: true, released });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Failed to release hold" },
      { status: 500 }
    );
  }
}
