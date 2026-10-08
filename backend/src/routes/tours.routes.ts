import { Router } from "express";
import { getTours, getTourBySlug } from "@/modules/tours/tour.repository";

const router = Router();

// Catalog listing used by the home, shared/private tours and search pages
router.get("/", async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const destinationSlug = req.query.destination as string | undefined;
    const featured = req.query.featured as string | undefined;

    const tours = await getTours({
      category: category && category !== "ALL" ? category : undefined,
      destinationSlug: destinationSlug && destinationSlug !== "ALL" ? destinationSlug : undefined,
      isFeatured: featured === undefined ? undefined : featured === "true",
    });

    return res.json({ success: true, count: tours.length, tours });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: "Failed to load tours" });
  }
});

router.get("/search", async (req, res) => {
  try {
    const keyword = ((req.query.q as string | undefined) || "").toLowerCase().trim();
    const category = req.query.category as string | undefined;
    const destinationSlug = req.query.destination as string | undefined;
    const date = req.query.date as string | undefined;
    const minSeats = parseInt((req.query.seats as string | undefined) || "1", 10);
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;

    let tours = await getTours({
      category: category && category !== "ALL" ? category : undefined,
      destinationSlug: destinationSlug && destinationSlug !== "ALL" ? destinationSlug : undefined,
    });

    // Filter by keyword
    if (keyword) {
      tours = tours.filter((t) => {
        const text = `${t.title} ${t.summary} ${t.description} ${t.destination.name} ${t.highlights.join(" ")}`.toLowerCase();
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

    return res.json({ success: true, count: tours.length, tours });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: "Search failed" });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const tour = await getTourBySlug(req.params.slug);
    if (!tour) {
      return res.status(404).json({ success: false, error: "Tour not found" });
    }
    return res.json({ success: true, tour });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: "Failed to load tour" });
  }
});

export default router;
