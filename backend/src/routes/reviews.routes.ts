import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import { Router } from "express";
import { getAuthenticatedUser } from "@/lib/auth/admin-guard";
import { createReview, getTourReviews } from "@/modules/reviews/review.repository";
import prisma from "@/lib/db/prisma";
import { verifyBookingLink } from "@/lib/security/signed-links";
import { emailSchema, parseOr400, referenceSchema, z } from "@/lib/security/validate";

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

router.post("/", rateLimitMiddleware("review_create", { maxRequests: 3, windowSeconds: 3600 }), async (req, res) => {
  try {
    const input = parseOr400(
      z.object({
        bookingReference: referenceSchema,
        rating: z.coerce.number().int().min(1).max(5),
        title: z.string().trim().min(2).max(120),
        body: z.string().trim().min(10).max(3000),
        authorName: z.string().trim().max(80).optional(),
        email: emailSchema.optional(),
        t: z.string().max(64).optional(),
      }),
      req.body,
      res,
    );
    if (!input) return;
    const { bookingReference, rating, title, body: reviewBody, authorName } = input;

    // Only the guest who booked: signed in, the booking's email, or the signed review link.
    const payload = getAuthenticatedUser(req);
    const booking = await prisma.booking.findUnique({ where: { bookingReference }, select: { customerEmail: true } });
    const ownerEmail = booking?.customerEmail.toLowerCase();
    const isOwner =
      !!ownerEmail &&
      (payload?.email.toLowerCase() === ownerEmail || input.email === ownerEmail || verifyBookingLink(bookingReference, "review", input.t));
    if (!isOwner) return res.status(403).json({ error: "Only the guest who made this booking can review it." });
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
