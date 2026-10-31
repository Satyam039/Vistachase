// "Why travellers choose us" (Viator / GetYourGuide reassurance grid on a dark band): a photo
// with one plain fact, six reasons beside it. Copy from the owner's "Update Vista Chase web" doc.

import Image from "next/image";
import { CarFront, ClipboardCheck, HandHeart, MapPin, Receipt, Users } from "lucide-react";

const REASONS = [
  { icon: HandHeart, title: "Passionate Local Guides", body: "Enjoy local stories, insights and a welcoming guide who makes your day memorable." },
  { icon: Users, title: "Small Groups, Personal Attention", body: "No more than 12 guests on shared tours for a friendly, more personal experience." },
  { icon: CarFront, title: "Your Own Private Tour", body: "Enjoy a dedicated guide and vehicle, with flexibility to shape the day around your interests." },
  { icon: MapPin, title: "Convenient Pickup Options", body: "Depart from Banff or Canmore, with hotel pickup available on selected experiences." },
  { icon: ClipboardCheck, title: "We Handle the Details", body: "Enjoy thoughtfully planned routes and included Moraine Lake transportation on applicable tours." },
  { icon: Receipt, title: "Clear, Upfront Pricing", body: "Understand what's included, optional extras and cancellation terms before you book." },
];

export function WhyTravelersLove() {
  return (
    <section aria-labelledby="why-heading" className="relative overflow-hidden bg-obsidian-950 py-20 text-white sm:py-28">
      <div className="pointer-events-none absolute -right-20 top-1/2 h-[34rem] w-[34rem] -translate-y-1/2 opacity-[0.04]" aria-hidden="true">
        <Image src="/media/brand/horse-emblem-gold.png" alt="" fill sizes="34rem" className="object-contain" />
      </div>

      <div className="relative mx-auto max-w-7xl px-page">
        <div className="mx-auto mb-14 max-w-3xl text-center" data-reveal>
          <p className="mb-3 text-sm uppercase tracking-[0.22em] text-summit-400">Why Vista Chase</p>
          <h2 id="why-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl">
            Why travellers choose us
          </h2>
          <p className="mt-4 text-lg font-light leading-relaxed text-slate-300">Local guides, small groups and the details taken care of.</p>
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="relative overflow-hidden rounded-none" data-reveal="clip">
              <div className="relative h-[28rem] sm:h-[34rem]">
                <Image src="/media/site/feature-image-1.webp" alt="A Vista Chase guide with guests in the Rockies" fill sizes="(max-width: 1024px) 100vw, 40vw" className="object-cover" data-parallax="10" />
                <div className="vc-scrim" aria-hidden="true" />
              </div>
              <p className="absolute inset-x-6 bottom-6 text-lg font-light text-white">Small-group, private and shuttle tours, run from Canmore.</p>
            </div>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:col-span-7" data-stagger>
            {REASONS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="group h-full rounded-none bg-gradient-to-b from-[#181d21] via-[#121619] to-[#0a0d0f] p-6 ring-1 ring-white/[0.12] transition-[transform,box-shadow,border-color] duration-500 hover:-translate-y-1.5 hover:ring-summit-400/40 hover:shadow-[0_24px_50px_-20px_rgba(0,0,0,0.6)]">
                <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-summit-500/15 text-summit-400 transition-colors group-hover:bg-summit-500/25">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-lg text-white font-medium">{title}</h3>
                <p className="mt-1.5 text-base font-light leading-relaxed text-slate-300">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
