import prisma from "@/lib/db/prisma";

export interface CreateReviewInput {
  bookingReference: string;
  authorName?: string;
  rating: number; // 1 - 5
  title: string;
  body: string;
}

export interface ReviewResult {
  success: boolean;
  review?: {
    id: string;
    tourId: string;
    authorName: string;
    rating: number;
    title: string;
    body: string;
    date: string;
  };
  error?: string;
}

export async function createReview(input: CreateReviewInput): Promise<ReviewResult> {
  if (input.rating < 1 || input.rating > 5) {
    return { success: false, error: "Rating must be between 1 and 5 stars" };
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingReference: input.bookingReference },
    include: {
      tourDeparture: {
        include: { tour: true },
      },
      review: true,
    },
  });

  if (!booking) {
    return { success: false, error: "Verified booking not found for this reference" };
  }

  if (booking.review) {
    return { success: false, error: "A review has already been submitted for this booking" };
  }

  const tourId = booking.tourDeparture.tourId;
  if (!tourId) {
    return { success: false, error: "This booking is not associated with a reviewable tour" };
  }

  const now = new Date();
  const dateFormatted = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const author = input.authorName || booking.customerName;

  const result = await prisma.$transaction(async (tx) => {
    const review = await tx.review.create({
      data: {
        tourId,
        bookingId: booking.id,
        authorName: author,
        rating: Math.round(input.rating),
        title: input.title,
        body: input.body,
        isVerified: true,
        date: dateFormatted,
      },
    });

    // Tours imported from the live site carry the published rating and count (e.g. 5.0 from 1,000+
    // reviews across TripAdvisor and Google). Those stay until the reviews left here outnumber
    // them; only then do the tour's figures come from these reviews. Seeded samples never count.
    const agg = await tx.review.aggregate({
      where: { tourId, bookingId: { not: null } },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const realCount = agg._count.rating || 1;
    const tour = await tx.tour.findUnique({ where: { id: tourId }, select: { reviewCount: true } });

    if (!tour || tour.reviewCount < realCount) {
      await tx.tour.update({
        where: { id: tourId },
        data: {
          rating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : input.rating,
          reviewCount: realCount,
        },
      });
    }

    return review;
  });

  return {
    success: true,
    review: {
      id: result.id,
      tourId: result.tourId,
      authorName: result.authorName,
      rating: result.rating,
      title: result.title,
      body: result.body,
      date: result.date,
    },
  };
}

/**
 * Public reviews of a tour: only those written by a guest against a real booking. Seeded sample
 * reviews have no booking and are never shown to customers.
 */
export async function getTourReviews(tourId: string) {
  return await prisma.review.findMany({
    where: { tourId, bookingId: { not: null } },
    orderBy: { createdAt: "desc" },
  });
}
