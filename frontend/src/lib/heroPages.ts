/**
 * Pages that open on a full-bleed photo hero. The header floats transparently over these heroes
 * (globals.css: html[data-hero-page]) and only turns frosted once the hero has scrolled past.
 * The hero section itself carries data-nav-hero (SiteFrame measures it).
 * Kept as a pattern string so the before-paint script in layout.tsx can use the same list.
 */
export const HERO_PATH_PATTERN =
  "^/(shared-tours|private-tours|shuttles|banff-activity-tickets|about-us|contact-us|faq|gallery|partners|pickup-finder|destinations(/[^/]+)?)?/?$";

export function isHeroPath(pathname: string | null | undefined) {
  return !!pathname && new RegExp(HERO_PATH_PATTERN).test(pathname);
}
