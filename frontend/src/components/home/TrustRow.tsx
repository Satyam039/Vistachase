// Value props as a compact strip (GetYourGuide "Why book with…", Civitatis icon row): inside the
// page container, short titles, one line of detail, quiet dividers between items on wide screens.
// Copy is Vista Chase's own (2026-10-19). Each line is scoped to where it holds: the 12-guest limit
// to shared tours, the Moraine Lake shuttle to the Moraine Lake tours. Cancellation terms stay on
// each tour page, because they differ for multi-day trips and larger groups.

import { BadgeCheck, Compass, MountainSnow, Users } from "lucide-react";

const PROPS = [
  {
    icon: Users,
    title: "Small Groups, Personal Attention",
    body: "A maximum of 12 guests on shared tours, with more attention from your guide.",
  },
  {
    icon: Compass,
    title: "Guides Who Make the Difference",
    body: "Discover the stories, scenery and local insights that make the Rockies unforgettable.",
  },
  {
    icon: MountainSnow,
    title: "Moraine Lake Access Included",
    body: "Our Moraine Lake tours include the shuttle access—no separate reservation needed.",
  },
  {
    icon: BadgeCheck,
    title: "Clear, Upfront Pricing",
    body: "Required fees and taxes included. Know the total before you book.",
  },
];

export function TrustRow() {
  return (
    <section aria-label="Why book with Vista Chase" className="border-b border-obsidian-900/[0.06] bg-white">
      <ul
        className="mx-auto grid max-w-7xl grid-cols-1 gap-x-8 gap-y-6 px-page py-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:py-10"
        data-stagger
      >
        {PROPS.map(({ icon: Icon, title, body }, i) => (
          <li
            key={title}
            className={`flex items-start gap-4 ${i > 0 ? "lg:border-l lg:border-obsidian-900/[0.08] lg:pl-8" : ""} ${i < PROPS.length - 1 ? "lg:pr-6" : ""}`}
          >
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ocean-50 text-ocean-700">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-base leading-snug text-obsidian-900">{title}</span>
              <span className="mt-1 block text-sm leading-snug text-slate-600">{body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
