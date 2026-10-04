"use client";

// Decorative looping background video (clips served by the backend from backend/media/videos).
//
// Accessibility (WCAG 2.2.2 Pause, Stop, Hide; 2.3.3): it never autoplays when the visitor
// prefers reduced motion, and a visible Pause / Play button is always available. It is muted
// and decorative, so it is hidden from assistive technology.
//
// Performance: nothing downloads until the clip scrolls into view; it pauses when it leaves the
// viewport, and it stays on the poster on data-saver connections. Large screens get the 1080p
// encode when there is one.

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

export interface AmbientVideoSource {
  src: string;
  /** 1080p encode for screens 1024px and wider. */
  srcHd?: string | null;
  poster?: string;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const saveData = () =>
  typeof navigator !== "undefined" &&
  Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

export function AmbientVideo({
  src,
  srcHd,
  poster,
  className = "",
  buttonClassName = "bottom-4 right-4",
}: AmbientVideoSource & {
  className?: string;
  /** Where the pause button sits inside the (positioned) parent. */
  buttonClassName?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [load, setLoad] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  // The visitor pressed Play themselves: that wins over reduced motion and data saver.
  const [userPlayed, setUserPlayed] = useState(false);
  const [allowed, setAllowed] = useState(false);

  // Decide once on the client whether motion is welcome.
  useEffect(() => {
    setAllowed(!prefersReducedMotion() && !saveData());
  }, []);

  // Watch visibility; start downloading the first time the clip comes near the viewport.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        // With reduced motion or data saver, nothing downloads until the visitor presses Play.
        if (entry.isIntersecting && allowed) setLoad(true);
      },
      { rootMargin: "200px 0px", threshold: 0.15 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [allowed]);

  // The <source> elements are added lazily, so tell the element to pick them up.
  useEffect(() => {
    if (load) ref.current?.load();
  }, [load]);

  // Play while visible (unless paused by the visitor or motion isn't wanted); pause otherwise.
  useEffect(() => {
    const video = ref.current;
    if (!video || !load) return;
    if ((allowed || userPlayed) && inView && !userPaused) {
      video.play().then(
        () => setPlaying(true),
        () => setPlaying(false)
      );
    } else if (!video.paused) {
      video.pause();
      setPlaying(false);
    }
  }, [allowed, userPlayed, inView, userPaused, load]);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      // The play effect starts it once the sources are in place.
      setUserPaused(false);
      setUserPlayed(true);
      setLoad(true);
    } else {
      setUserPaused(true);
      video.pause();
      setPlaying(false);
    }
  };

  return (
    <>
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        poster={poster}
        aria-hidden="true"
        tabIndex={-1}
        className={className}
      >
        {load && srcHd && <source src={srcHd} type="video/mp4" media="(min-width: 1024px)" />}
        {load && <source src={src} type="video/mp4" />}
      </video>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause background video" : "Play background video"}
        className={`absolute z-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-obsidian-900/70 text-white backdrop-blur-md border border-white/20 hover:bg-obsidian-900/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-summit-500 ${buttonClassName}`}
      >
        {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
      </button>
    </>
  );
}
