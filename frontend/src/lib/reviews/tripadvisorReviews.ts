import type { SliderReview } from "@/components/reviews/ReviewSlider";

// Tripadvisor reviews the owner picked for the home page ("Update Vista Chase web" doc, "Add These
// Reviews", approved 2026-10-22). Copied word for word with the reviewer's name, date and a link to
// the review itself; the doc gives no star rating, so none is shown. Don't edit the wording: add or
// remove whole reviews only, from the owner's list.
const TA = (url: string) => ({ label: "Tripadvisor", url });

export const TRIPADVISOR_REVIEWS: SliderReview[] = [
  {
    id: "ta-r1081821073",
    authorName: "Jorgy",
    title: "Best One Around!",
    body: "Absolutely amazing experience. Rauol was our driving and guide, and treated us and our needs with amazing tenderness and professionalism. He provided valuable commentary and local flavor as we drove to each of our stops. Even his recommendation of the Indian restaurant for lunch proved to be delicious and much faster than any other option.",
    date: "Oct 2026",
    tourTitle: "Shared small-group tour",
    tourSlug: "shared-tours",
    source: TA(
      "https://www.tripadvisor.ca/ShowUserReviews-g181727-d26569837-r1081821073-8_Iconic_Stops_12_Comfy_Seats_See_Banff_s_Best_in_First_Class-Canmore_Kananask.html",
    ),
  },
  {
    id: "ta-r1081727262",
    authorName: "Jeanette M",
    title: "Fun way to see the National Parks",
    body: "Liam was a delight! He is very knowledgeable about the region and freely shared about his own off duty experiences in the park and beyond. I hope others have a chance to spend a day with him in Banff.",
    date: "Oct 2026",
    tourTitle: "Shared small-group tour",
    tourSlug: "shared-tours",
    source: TA(
      "https://www.tripadvisor.ca/ShowUserReviews-g181727-d26569837-r1081727262-8_Iconic_Stops_12_Comfy_Seats_See_Banff_s_Best_in_First_Class-Canmore_Kananask.html",
    ),
  },
  {
    id: "ta-r1081322481",
    authorName: "jamieinomaha",
    title: "Fantastic Tour",
    body: "We absolutely loved this tour for a few specific reasons.\n1) size - 12 people max made for a nice small group as opposed to those huge bus loads of people getting off to visit a site\n2) vehicle - the bus looked brand new. Clean, leather seats and USB plugs\n3) Driver/Guide - Ankit was an excellent driver. We felt safe at all times. As a guide, he was kind, funny, offered great insights into what we were seeing and gave smart tips on bathroom usage & how to spend our time at each stop.\n4) Route/Timing - we arrived at Johnston Canyon before any buses arrived. We didn’t have to wait in line at all, even at the cave.\nIt was a great experience from start to finish.",
    date: "Oct 2026",
    tourTitle: "Shared small-group tour",
    tourSlug: "shared-tours",
    source: TA("https://www.tripadvisor.ca/ShowUserReviews-g154911-d26518659-r1081322481-Vista_Chase-Banff_Banff_National_Park_Alberta.html"),
  },
  {
    id: "ta-r1069314062",
    authorName: "Kim G",
    title: "Best Day Ever",
    body: "We had an incredible private tour of Banff with Rahul! He made the most of our time, taking us to so many breathtaking places while sharing fascinating stories and local knowledge along the way. He has a gift for making the experience engaging for everyone—even my teenagers were completely interested and asking questions, which says a lot!\nOur only regret is that we didn’t book multiple days with Rahul. If you’re considering a private tour, don’t make the same mistake—we would have loved to explore even more with him.\nThis tour company is outstanding from start to finish, and we’ll absolutely book with them again the next time we’re in Banff. Highly recommend!",
    date: "Jul 2026",
    tourTitle: "Private tour",
    tourSlug: "private-tours",
    source: TA(
      "https://www.tripadvisor.ca/ShowUserReviews-g181727-d27424278-r1069314062-Private_Customizable_Banff_Tour_Lake_Louise_Moraine_6_More_Sights-Canmore_Kana.html",
    ),
  },
  {
    id: "ta-r1073305922",
    authorName: "bmwagner1",
    title: "Amazing tour!",
    body: "Our tour was fantastic. A great start to our time in Banff. We probably could have visited a lot of the tour stops on our own, but it would have taken us much longer, we would have struggled with parking and not gotten as much information. Our guide Etiel was the best!! I highly recommend that you request him. He took care of everything, gave us great information and suggestions without rushing us.\nOverall it was an amazing day and we will definitely do another tour when we come back to Banff (hopefully with Etiel).",
    date: "Aug 2026",
    tourTitle: "Private tour",
    tourSlug: "private-tours",
    source: TA("https://www.tripadvisor.ca/ShowUserReviews-g154911-d26518659-r1073305922-Vista_Chase-Banff_Banff_National_Park_Alberta.html"),
  },
  {
    id: "ta-r1077864518",
    authorName: "Tennisbum",
    title: "Awesome tour with small group size",
    body: "The tour provides a great way to see several major landmarks in the area. Our guide Liam was awesome with a great sense of humor and energetic personality. He made sure everyone was well taken care of and took us to great photo spots (taking wonderful pictures as well). Small group of people and never felt rushed. He took us to a wonderful place for lunch. I would highly recommend the tour to anyone visiting the area.",
    date: "Sep 2026",
    tourTitle: "Shared small-group tour",
    tourSlug: "shared-tours",
    source: TA("https://www.tripadvisor.ca/ShowUserReviews-g154911-d26518659-r1077864518-Vista_Chase-Banff_Banff_National_Park_Alberta.html"),
  },
];

// Four more Tripadvisor reviews of the Private Customizable Banff Tour the owner sent on 2026-11-22
// ("yeh review add kar private wale me"), copied word for word. The owner's paste had no link to each
// review, so each one links to Vista Chase's Tripadvisor reviews page instead. Shown on private
// tour pages (approvedReviewsFor), not in the home page slider.
const TA_VISTA_CHASE_REVIEWS =
  "https://www.tripadvisor.ca/Attraction_Review-g154911-d26518659-Reviews-Vista_Chase-Banff_Banff_National_Park_Alberta.html";

export const PRIVATE_TOUR_TRIPADVISOR_REVIEWS: SliderReview[] = [
  {
    id: "ta-private-cardiffgirl78",
    authorName: "cardiffgirl78",
    title: "Great tour & Itiel was the best tour guide!",
    body: "Itiel was the best tour guide we have ever had! He was funny, friendly and extremely knowledgeable. We seen amazing sites and cannot thank or recommend him and his hard work enough. 5 starts well and truly deserved!",
    date: "Oct 2026",
    tourTitle: "Private tour",
    tourSlug: "private-tours",
    source: TA(TA_VISTA_CHASE_REVIEWS),
  },
  {
    id: "ta-private-larraine79",
    authorName: "Larraine79",
    title: "A great way to see Banff!",
    body: "A luxurious small passenger van, a personable and knowledgeable guide, and breathtaking lakes and mountains, what more could you ask for? Itiel, our guide, was wonderful and very understanding of those who were slower or wanted to refrain from the 1 or 2 parts that were a little more challenging and showed us options that worked better (but didn’t hamper the others on the tour). All in all, such a great way to see so much all in one day. Plus we didn’t have to deal with all of the parking issues at the often crowded parking lots. Highly recommend if you want an easy way to see a lot in a short amount of time!",
    date: "Oct 2026",
    tourTitle: "Private tour",
    tourSlug: "private-tours",
    source: TA(TA_VISTA_CHASE_REVIEWS),
  },
  {
    id: "ta-private-cullenshereford",
    authorName: "CullensHereford",
    title: "Fantastic Tour Experience!",
    body: "My husband & 2 daughters were visiting Banff for the first time and booked Vista Chase for a private Banff tour. I had requested Liam as our private tour guide after reading some excellent reviews about him and he didn't disappoint with our private tour experience.\nLiam was knowledgeable, friendly, passionate, full of energy and accommodating - it was like going on a tour with a family member. Liam knew all the best spots for photo opportunities and we packed so much in our day, visiting lots of lakes and tourist attractions. Whilst on a bear spotting hunt, we were extremely fortunate to have seen 2 wolves. We had such a great time that we booked Liam again to accompany us for a trip to the beautiful Moraine Lake and hiked up the Larch Valley trail for some breathtaking views. The icing on the cake was seeing Mum Grizzly Bear with her 3 cubs, crossing the road near Lake Minnewanka. Our signature phrase of the day was 'Bear Necessities' Thank you Liam for making our tour experience extra special. You are a credit to Vista Chase Tours!",
    date: "Sep 2026",
    tourTitle: "Private tour",
    tourSlug: "private-tours",
    source: TA(TA_VISTA_CHASE_REVIEWS),
  },
  {
    id: "ta-private-jennifer-n",
    authorName: "Jennifer N",
    title: "Great tour for 'must see' spots and hidden gems",
    body: "This private tour was well worth the money. We had two couples in a large van. We got to see so many wonderful spots throughout the day, both 'must see' spots and hidden gems. The itinerary was set, but we were able to adjust the timing at each stop to accommodate our needs and move how fast we wanted to go and see what we wanted to see. The tour guide - Michaela - was phenomenal. She was very personable and provided additional information about each stop. She also was nice enough to provide us with other tips and suggestions for the rest of our week in the area.",
    date: "Sep 2026",
    tourTitle: "Private tour",
    tourSlug: "private-tours",
    source: TA(TA_VISTA_CHASE_REVIEWS),
  },
];

/**
 * The four short excerpts the home page shows beside the review summary (doc: "four real review
 * excerpts, covering your guides, small-group experience and ease of travel"). Each excerpt is cut
 * word for word from one of the owner's reviews above and links to the full review.
 */
export const REVIEW_EXCERPTS: { theme: string; reviewId: string; excerpt: string }[] = [
  { theme: "Our guides", reviewId: "ta-r1081727262", excerpt: "Liam was a delight! He is very knowledgeable about the region and freely shared about his own off duty experiences in the park and beyond." },
  { theme: "Small groups", reviewId: "ta-r1081322481", excerpt: "12 people max made for a nice small group as opposed to those huge bus loads of people getting off to visit a site" },
  { theme: "Easy travel", reviewId: "ta-r1073305922", excerpt: "We probably could have visited a lot of the tour stops on our own, but it would have taken us much longer, we would have struggled with parking and not gotten as much information." },
  { theme: "Never rushed", reviewId: "ta-r1077864518", excerpt: "He made sure everyone was well taken care of and took us to great photo spots (taking wonderful pictures as well). Small group of people and never felt rushed." },
];

/**
 * The owner-approved reviews for a page about one kind of tour (owner, 2026-11-18: "every tour page
 * should have enough reviews in the slider"): the reviews of that kind first, then the others. Each
 * card names the tour it was written about, so a shared-tour review is never shown as a private one.
 */
export function approvedReviewsFor(kind: "private" | "shared"): SliderReview[] {
  const slug = kind === "private" ? "private-tours" : "shared-tours";
  const all = [...PRIVATE_TOUR_TRIPADVISOR_REVIEWS, ...TRIPADVISOR_REVIEWS];
  return [...all.filter((r) => r.tourSlug === slug), ...all.filter((r) => r.tourSlug !== slug)];
}
