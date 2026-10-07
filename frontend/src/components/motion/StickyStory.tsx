"use client";

// Sticky scroll storytelling: on large screens the media stays pinned while the chapters scroll
// past beside it, and the pinned frame cross-fades to whichever chapter is in the middle of the
// viewport (a progress rail marks the place). On small screens every chapter carries its own
// media inline, so nothing depends on the pinned frame.
//
// Videos only play for the active chapter (AmbientVideo handles pause, data saver and reduced
// motion). The pinned frame is decorative duplication of the chapter media, so it is hidden from
// assistive technology; each chapter's own image carries the alt text.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AmbientVideo } from "@/components/cinematic/AmbientVideo";

export interface StoryChapter {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  facts?: string[];
  cta?: { label: string; href: string };
  image: string;
  imageAlt: string;
  video?: { src: string; poster: string };
}

export function StickyStory({ chapters, tone = "dark" }: { chapters: StoryChapter[]; tone?: "dark" | "light" }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [chapters.length]);

  const dark = tone === "dark";

  return (
    <div className="relative lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
      {/* Pinned media frame (large screens) */}
      <div className="hidden lg:block" aria-hidden="true">
        <div className="sticky top-[calc(var(--vc-header-h,80px)+2rem)] h-[calc(100vh-var(--vc-header-h,80px)-4rem)] overflow-hidden rounded-[2rem]">
          {chapters.map((c, i) => (
            <div
              key={c.id}
              className={`absolute inset-0 transition-[opacity,transform] duration-1000 ease-out ${
                i === active ? "scale-100 opacity-100" : "scale-105 opacity-0"
              }`}
            >
              <Image src={c.image} alt="" fill sizes="55vw" className="object-cover" />
              {c.video && i === active && (
                <AmbientVideo src={c.video.src} poster={c.video.poster} className="absolute inset-0 h-full w-full object-cover" buttonClassName="bottom-5 right-5" />
              )}
            </div>
          ))}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          {/* chapter counter */}
          <div className="pointer-events-none absolute bottom-6 left-6 flex items-center gap-3 text-white">
            <span className="text-5xl font-light tabular-nums">{String(active + 1).padStart(2, "0")}</span>
            <span className="text-sm text-white/80">/ {String(chapters.length).padStart(2, "0")}</span>
          </div>
        </div>
      </div>

      {/* Chapters */}
      <ol className="relative">
        {/* progress rail */}
        <span className={`absolute left-0 top-0 hidden h-full w-px lg:block ${dark ? "bg-white/15" : "bg-obsidian-900/10"}`} aria-hidden="true">
          <span
            className="block w-px bg-summit-500 transition-[height] duration-700 ease-out"
            style={{ height: `${((active + 1) / chapters.length) * 100}%` }}
          />
        </span>
        {chapters.map((c, i) => (
          <li
            key={c.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-index={i}
            className="flex min-h-0 flex-col justify-center py-10 lg:min-h-[85vh] lg:pl-12"
          >
            <div className="relative mb-6 aspect-[4/3] overflow-hidden rounded-3xl lg:hidden" data-reveal="clip">
              <Image src={c.image} alt={c.imageAlt} fill sizes="100vw" className="object-cover" />
            </div>
            <div
              className={`transition-opacity duration-700 ${i === active ? "lg:opacity-100" : "lg:opacity-40"}`}
              data-reveal
            >
              <p className={`text-sm uppercase tracking-[0.22em] ${dark ? "text-summit-300" : "text-ocean-600"}`}>{c.eyebrow}</p>
              <h3 className={`mt-3 text-3xl font-light leading-tight sm:text-4xl lg:text-5xl ${dark ? "text-white" : "text-obsidian-900"}`}>
                {c.title}
              </h3>
              <p className={`mt-5 max-w-xl text-lg font-light leading-relaxed ${dark ? "text-slate-300" : "text-slate-600"}`}>{c.body}</p>
              {c.facts && (
                <ul className="mt-6 flex flex-wrap gap-2">
                  {c.facts.map((f) => (
                    <li
                      key={f}
                      className={`rounded-full border px-3.5 py-1.5 text-sm ${dark ? "border-white/20 text-slate-200" : "border-obsidian-900/15 text-obsidian-700"}`}
                    >
                      {f}
                    </li>
                  ))}
                </ul>
              )}
              {c.cta && (
                <Link
                  href={c.cta.href}
                  className={`group mt-8 inline-flex items-center gap-2 border-b pb-1 text-base ${
                    dark ? "border-summit-500 text-white" : "border-ocean-600 text-obsidian-900"
                  }`}
                >
                  {c.cta.label}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
