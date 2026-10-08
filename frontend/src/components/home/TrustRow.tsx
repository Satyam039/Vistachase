// Value props as a compact strip (GetYourGuide "Why book with…", Civitatis icon row): inside the
// page container, short titles that fit one line, one line of detail, quiet dividers between
// items on wide screens. Every line is a policy or fact from the live site's product pages.

import { BadgeCheck, CalendarCheck, MountainSnow, Users } from "lucide-react";

const PROPS = [
  { icon: CalendarCheck, title: "Free cancellation", body: "Full refund up to 72 hours before" },
  { icon: MountainSnow, title: "Guaranteed lake access", body: "Our shuttles still drive to Moraine Lake" },
  { icon: Users, title: "Small groups", body: "Never more than 12 on a shared tour" },
  { icon: BadgeCheck, title: "No hidden fees", body: "Clear prices in Canadian dollars" },
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
            className={`flex items-center gap-4 ${i > 0 ? "lg:border-l lg:border-obsidian-900/[0.08] lg:pl-8" : ""} ${i < PROPS.length - 1 ? "lg:pr-6" : ""}`}
          >
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ocean-50 text-ocean-700">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-base text-obsidian-900">{title}</span>
              <span className="mt-0.5 block text-sm leading-snug text-slate-600">{body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
