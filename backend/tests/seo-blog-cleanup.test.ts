// SEO audit fixes (5 Nov 2026): built-in redirects for old Webflow posts that 404'd and the retired
// "lake lousie" test post, and how a stored post body is cleaned for the page (Webflow's empty
// zero-width-joiner paragraphs, links that hit a redirect pointed at its target).

import { cleanBody } from "@/modules/seo/seo.public";
import { BUILT_IN_REDIRECTS, activeRedirectMap } from "@/modules/seo/seo.redirects";

const map: Record<string, [string, number]> = { "/blog-post/luxury-banff-tours": ["/blog-post/luxury-banff-tours-what-vip-travelers-actually-get", 301] };

describe("cleanBody", () => {
  it("drops Webflow's zero-width-joiner paragraphs and stray joiners, keeps emoji sequences", () => {
    const body = "First paragraph.\n\n‍\n\nSecond‍ paragraph.\n\n‍ \n\nFamily 👨‍👩‍👧 trip.";
    expect(cleanBody(body, {})).toBe("First paragraph.\n\nSecond paragraph.\n\nFamily 👨‍👩‍👧 trip.");
  });

  it("points site links that hit a redirect straight at the target, keeping anchors and titles", () => {
    const body = [
      "[old](/blog-post/luxury-banff-tours)",
      "[abs](https://www.vistachase.com/blog-post/luxury-banff-tours/#tips)",
      '[titled](/blog-post/luxury-banff-tours "VIP")',
      "[newer](/blog-post/luxury-banff-tours-what-vip-travelers-actually-get)",
      "[other site](https://example.com/blog-post/luxury-banff-tours)",
    ].join("\n\n");
    expect(cleanBody(body, map)!.split("\n\n")).toEqual([
      "[old](/blog-post/luxury-banff-tours-what-vip-travelers-actually-get)",
      "[abs](/blog-post/luxury-banff-tours-what-vip-travelers-actually-get#tips)",
      '[titled](/blog-post/luxury-banff-tours-what-vip-travelers-actually-get "VIP")',
      "[newer](/blog-post/luxury-banff-tours-what-vip-travelers-actually-get)",
      "[other site](https://example.com/blog-post/luxury-banff-tours)",
    ]);
  });
});

describe("built-in redirects", () => {
  it("are served with the saved ones, as permanent redirects", async () => {
    const active = await activeRedirectMap();
    for (const [from, to] of Object.entries(BUILT_IN_REDIRECTS)) expect(active[from]).toEqual([to, 301]);
  });
});
