import { Router } from "express";
import { getAuthenticatedUser } from "@/lib/auth/admin-guard";
import { createReview, getTourReviews } from "@/modules/reviews/review.repository";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const tourId = req.query.tourId as string | undefined;

    if (!tourId) {
      return res.status(400).json({ error: "tourId parameter is required." });
    }

    const reviews = await getTourReviews(tourId);
    return res.json({ success: true, reviews });
  } catch (error) {
    console.error("Fetch reviews error:", error);
    return res.status(500).json({ error: "Failed to load reviews." });
  }
});

router.post("/", async (req, res) => {
  try {
    const { bookingReference, rating, title, body: reviewBody, authorName } = req.body ?? {};

    if (!bookingReference || !rating || !title || !reviewBody) {
      return res.status(400).json({
        error: "Booking reference, rating (1-5), title, and review body are required.",
      });
    }

    const payload = getAuthenticatedUser(req);
    const author = payload?.name || authorName;

    const result = await createReview({
      bookingReference,
      rating: Number(rating),
      title,
      body: reviewBody,
      authorName: author,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({
      success: true,
      review: result.review,
      message: "Thank you! Your verified review has been submitted.",
    });
  } catch (error) {
    console.error("Submit review error:", error);
    return res.status(500).json({ error: "Failed to submit review." });
  }
});

export default router;
