import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { verifyToken } from "@/lib/auth/auth";
import { createReview, getTourReviews } from "@/modules/reviews/review.repository";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tourId = searchParams.get("tourId");

    if (!tourId) {
      return NextResponse.json({ error: "tourId parameter is required." }, { status: 400 });
    }

    const reviews = await getTourReviews(tourId);
    return NextResponse.json({ success: true, reviews });
  } catch (error) {
    console.error("Fetch reviews error:", error);
    return NextResponse.json({ error: "Failed to load reviews." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookingReference, rating, title, body: reviewBody, authorName } = body;

    if (!bookingReference || !rating || !title || !reviewBody) {
      return NextResponse.json(
        { error: "Booking reference, rating (1-5), title, and review body are required." },
        { status: 400 }
      );
    }

    let author = authorName;
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
      if (payload?.name) {
        author = payload.name;
      }
    }

    const result = await createReview({
      bookingReference,
      rating: Number(rating),
      title,
      body: reviewBody,
      authorName: author,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      review: result.review,
      message: "Thank you! Your verified review has been submitted.",
    });
  } catch (error) {
    console.error("Submit review error:", error);
    return NextResponse.json({ error: "Failed to submit review." }, { status: 500 });
  }
}
