// Value props directly under the hero (GetYourGuide "Why book with…", Civitatis icon row).
// Every line is a policy or fact from the live site's product pages.

import { BadgeCheck, CalendarCheck, MountainSnow, Users } from "lucide-react";

const PROPS = [
  {
    icon: CalendarCheck,
    title: "Free cancellation",
    body: "Full refund up to 24 hours before your tour.",
  },
  {
    icon: MountainSnow,
    title: "Guaranteed lake access",
    body: "Moraine Lake Road is closed to cars. Our shuttles still go.",
  },
  {
    icon: Users,
    title: "Small groups, local guides",
    body: "Never more than 12 on a shared tour.",
  },
  {
    icon: BadgeCheck,
    title: "Book direct, no hidden fees",
    body: "Clear prices in Canadian dollars, confirmed by email.",
  },
];

export function TrustRow() {
  return (
    <section aria-label="Why book with Vista Chase" className="relative z-10 bg-white">
      <ul className="mx-auto grid max-w-7xl grid-cols-1 gap-px bg-obsidian-900/[0.06] sm:grid-cols-2 lg:grid-cols-4" data-stagger>
        {PROPS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-start gap-4 bg-white px-page py-7 lg:px-8">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ocean-50 text-ocean-700">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base text-obsidian-900">{title}</span>
              <span className="mt-0.5 block text-sm leading-relaxed text-slate-600">{body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
