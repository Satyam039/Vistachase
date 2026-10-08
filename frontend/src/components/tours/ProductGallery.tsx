"use client";

// Product gallery as a mosaic (GetYourGuide / Viator / Expedia): one large frame and four tiles,
// the last tile opening every photo and clip in a dialog. The large frame shows whichever item
// is selected; clips play once in it (AmbientVideo: reduced motion, data saver).
// The dialog is the native <dialog> (focus is contained, Esc closes, focus returns).

import { useRef, useState } from "react";
import Image from "next/image";
import { Grid2x2, Play, X } from "lucide-react";
import { AmbientVideo } from "@/components/cinematic/AmbientVideo";
import type { PageVideo } from "@/lib/api/types";

export type GallerySlide = { kind: "video"; video: PageVideo } | { kind: "image"; src: string };

const thumb = (s: GallerySlide) => (s.kind === "video" ? s.video.poster : s.src);
const label = (s: GallerySlide, i: number, n: number, title: string) =>
  s.kind === "video" ? `Play video: ${s.video.title}` : `Show photo ${i + 1} of ${n}: ${title}`;

export function ProductGallery({ slides, title }: { slides: GallerySlide[]; title: string }) {
  const [selected, setSelected] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const main = slides[selected] ?? slides[0];
  const tiles = slides.map((s, i) => ({ s, i })).slice(0, 5).filter(({ i }) => i !== selected).slice(0, 4);

  const pick = (i: number) => {
    setSelected(i);
    dialog.current?.close();
  };

  return (
    <div className="grid gap-2 lg:h-[32rem] lg:grid-cols-4 lg:grid-rows-2 lg:gap-3" data-reveal="clip">
      {/* Large frame */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-obsidian-900 sm:aspect-[16/9] lg:col-span-2 lg:row-span-2 lg:aspect-auto">
        {main?.kind === "video" ? (
          <>
            <Image src={main.video.poster} alt={main.video.alt} fill priority sizes="(max-width: 640px) 100vw, 60vw" className="object-cover" />
            <AmbientVideo key={main.video.id} src={main.video.src} srcHd={main.video.srcHd} poster={main.video.poster} className="absolute inset-0 h-full w-full object-cover" once />
          </>
        ) : (
          <Image src={main?.src ?? ""} alt={title} fill priority sizes="(max-width: 640px) 100vw, 60vw" className="object-cover" />
        )}
        <span className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-black/60 px-3 py-1.5 text-sm text-white backdrop-blur-md">
          {selected + 1} / {slides.length}
        </span>
      </div>

      {/* Tiles (desktop: a 2×2 block; phones: a row of thumbnails) */}
      <div className="grid grid-cols-4 gap-2 lg:contents">
        {tiles.map(({ s, i }, k) => {
          const last = k === tiles.length - 1 && slides.length > 5;
          return (
            <button
              key={i}
              type="button"
              onClick={() => (last ? dialog.current?.showModal() : setSelected(i))}
              aria-label={last ? `Show all ${slides.length} photos and videos` : label(s, i, slides.length, title)}
              className={`group relative aspect-square overflow-hidden rounded-2xl bg-obsidian-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600 lg:aspect-auto ${
                k >= 2 ? "lg:col-start-4" : "lg:col-start-3"
              } ${k % 2 === 0 ? "lg:row-start-1" : "lg:row-start-2"}`}
            >
              <Image src={thumb(s)} alt="" fill sizes="(max-width: 640px) 25vw, 20vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
              {s.kind === "video" && !last && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/20" aria-hidden="true">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-obsidian-900">
                    <Play className="h-4 w-4 translate-x-px" />
                  </span>
                </span>
              )}
              {last && (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-obsidian-950/60 text-white" aria-hidden="true">
                  <Grid2x2 className="h-5 w-5" />
                  <span className="text-sm">+{slides.length - 4} more</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <dialog
        ref={dialog}
        aria-label={`${title}: all photos and videos`}
        className="m-auto max-h-[90vh] w-[min(1100px,94vw)] overflow-y-auto rounded-[1.75rem] bg-white p-5 backdrop:bg-obsidian-950/80 backdrop:backdrop-blur-sm sm:p-8"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl text-obsidian-900">All photos and videos</h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-obsidian-900/10 text-obsidian-900 hover:bg-obsidian-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {slides.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => pick(i)}
                aria-label={label(s, i, slides.length, title)}
                className="group relative block aspect-[4/3] w-full overflow-hidden rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600"
              >
                <Image src={thumb(s)} alt="" fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                {s.kind === "video" && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20" aria-hidden="true">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-obsidian-900">
                      <Play className="h-4 w-4 translate-x-px" />
                    </span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </dialog>
    </div>
  );
}
