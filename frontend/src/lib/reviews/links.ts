// Where guests leave a review (owner's "VistaChase Website" PDF, 2026-11-14, Improvement #003): the
// "Leave a review" links in the site menu and footer, and "Google Reviews" in the home review wall.
// NEXT_PUBLIC_GOOGLE_REVIEWS_URL (the Google Business Profile "Ask for reviews" link,
// https://g.page/r/<id>/review) wins when set; until then it opens Vista Chase on Google Maps.
export const GOOGLE_REVIEWS_URL =
  process.env.NEXT_PUBLIC_GOOGLE_REVIEWS_URL || "https://www.google.com/maps/search/?api=1&query=Vista+Chase+Canmore+AB";
