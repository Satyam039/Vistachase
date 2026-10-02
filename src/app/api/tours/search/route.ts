import { NextResponse } from "next/server";
import { getTours } from "@/modules/tours/tour.repository";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = (searchParams.get("q") || "").toLowerCase().trim();
    const category = searchParams.get("category") || undefined;
    const destinationSlug = searchParams.get("destination") || undefined;
    const date = searchParams.get("date") || undefined;
    const minSeats = parseInt(searchParams.get("seats") || "1", 10);
    const maxPrice = searchParams.get("maxPrice") ? parseFloat(searchParams.get("maxPrice")!) : undefined;

    let tours = await getTours({
      category: category && category !== "ALL" ? category : undefined,
      destinationSlug: destinationSlug && destinationSlug !== "ALL" ? destinationSlug : undefined,
    });

    // Filter by keyword
    if (keyword) {
      tours = tours.filter((t) => {
        const text = `${t.title} ${t.summary} ${t.description} ${t.destination.name}`.toLowerCase();
        return text.includes(keyword);
      });
    }

    // Filter by price
    if (maxPrice !== undefined && !isNaN(maxPrice)) {
      tours = tours.filter((t) => t.basePrice <= maxPrice);
    }

    // Filter by date & capacity
    if (date) {
      tours = tours.map((t) => ({
        ...t,
        departures: t.departures.filter(
          (d) => d.date === date && d.seatsAvailable >= minSeats
        ),
      })).filter((t) => t.departures.length > 0);
    } else if (minSeats > 1) {
      // Must have at least one departure that can accommodate minSeats
      tours = tours.map((t) => ({
        ...t,
        departures: t.departures.filter((d) => d.seatsAvailable >= minSeats),
      })).filter((t) => t.departures.length > 0);
    }

    return NextResponse.json({
      success: true,
      count: tours.length,
      tours,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Search failed" },
      { status: 500 }
    );
  }
}
