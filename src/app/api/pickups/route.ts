import { NextResponse } from "next/server";
import { getMapsProvider } from "@/lib/maps/maps.provider";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const town = searchParams.get("town") || undefined;

    const maps = getMapsProvider();
    const pickups = await maps.searchPickups(query, town);

    return NextResponse.json({
      success: true,
      count: pickups.length,
      pickups,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Failed to fetch pickups" },
      { status: 500 }
    );
  }
}
