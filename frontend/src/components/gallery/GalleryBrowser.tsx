"use client";

// Photo gallery: area chips, a masonry grid at each photo's true proportions (captions always
// visible), and a full-screen viewer (native <dialog>: Esc closes, focus returns) with
// previous/next buttons and arrow keys.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";

export interface GalleryPhoto {
  src: string;
  w: number;
  h: number;
  caption: string;
  area: string;
}

export function GalleryBrowser({ photos, areas }: { photos: GalleryPhoto[]; areas: string[] }) {
  const [area, setArea] = useState("All");
  const [index, setIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const shown = useMemo(() => (area === "All" ? photos : photos.filter((p) => p.area === area)), [area, photos]);

  const open = (i: number, from: HTMLElement) => {
    opener.current = from;
    setIndex(i);
    dialog.current?.showModal();
  };
  const step = useCallback((d: number) => setIndex((i) => (i === null ? i : (i + d + shown.length) % shown.length)), [shown.length]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (!el.open) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    // Back to the photo that opened the viewer (some browsers don't focus a clicked button).
    const onClose = () => {
      setIndex(null);
      opener.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    el.addEventListener("close", onClose);
    return () => {
      window.removeEventListener("keydown", onKey);
      el.removeEventListener("close", onClose);
    };
  }, [step]);

  const current = index !== null ? shown[index] : null;

  return (
    <>
      <div role="group" aria-label="Filter by area" className="vc-rail -mx-page mb-8 flex gap-2 overflow-x-auto px-page [&>*:first-child]:ml-auto [&>*:last-child]:mr-auto">
        {["All", ...areas].map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={area === a}
            onClick={() => setArea(a)}
            className={`min-h-11 shrink-0 rounded-full border px-5 text-sm transition-colors ${
              area === a ? "border-obsidian-900 bg-obsidian-900 text-white" : "border-obsidian-900/10 bg-white text-obsidian-900 hover:border-obsidian-900/40"
            }`}
          >
            {a}
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {shown.length} photos
      </p>

      <ul key={area} className="columns-1 gap-5 sm:columns-2 lg:columns-3 [&>li]:mb-5" data-stagger>
        {shown.map((p, i) => (
          <li key={p.src} className="break-inside-avoid">
            <figure>
              <button
                type="button"
                onClick={(e) => open(i, e.currentTarget)}
                aria-label={`View larger: ${p.caption}`}
                className="group relative block w-full overflow-hidden rounded-[1.5rem] bg-obsidian-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600"
              >
                <Image
                  src={p.src}
                  alt=""
                  width={p.w}
                  height={p.h}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="h-auto w-full transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]"
                />
                <span className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-obsidian-900 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true">
                  <Expand className="h-4 w-4" />
                </span>
              </button>
              <figcaption className="mt-2.5 px-1">
                <span className="block text-xs uppercase tracking-[0.16em] text-ocean-700">{p.area}</span>
                <span className="block text-sm text-slate-700">{p.caption}</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        aria-label={current ? `Photo: ${current.caption}` : "Photo viewer"}
        className="m-0 h-full max-h-none w-full max-w-none bg-obsidian-950/95 p-0 text-white backdrop:bg-obsidian-950/80"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        {current && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <p className="text-sm text-white/75">
                {index! + 1} / {shown.length}
              </p>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                aria-label="Close viewer"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="relative min-h-0 flex-1">
              <Image key={current.src} src={current.src} alt={current.caption} fill sizes="100vw" className="object-contain motion-safe:animate-[fadeUp_400ms_ease-out]" />
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20 sm:left-6"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20 sm:right-6"
              >
                <ChevronRight className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <p className="px-4 py-4 text-center text-base text-white/90 sm:px-6">
              <span className="text-summit-300">{current.area}</span> · {current.caption}
            </p>
          </div>
        )}
      </dialog>
    </>
  );
}
