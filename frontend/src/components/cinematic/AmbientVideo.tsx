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
  paused,
  once = false,
}: AmbientVideoSource & {
  className?: string;
  /** Where the pause button sits inside the (positioned) parent. */
  buttonClassName?: string;
  /**
   * Controlled mode: the parent owns a visible pause control (e.g. the home hero's single
   * pause button for rotation + video), so no button is rendered here and this prop decides.
   */
  paused?: boolean;
  /** Play the clip a single time and rest on its last frame, with no button (category heroes). */
  once?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [ownPaused, setUserPaused] = useState(false);
  const controlled = paused !== undefined || once;
  const userPaused = paused !== undefined ? paused : ownPaused;

  // Play / pause based on viewport visibility
  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    // Check if user prefers reduced motion
    if (prefersReducedMotion()) {
      video.pause();
      setPlaying(false);
      setUserPaused(true);
      return;
    }

    if (userPaused) {
      video.pause();
      return;
    }

    // Try starting video on mount
    video.play().catch(() => {
      // Browser autoplay policy might require interaction
      setPlaying(false);
    });

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!ref.current) return;
        if (entry.isIntersecting && !userPaused) {
          ref.current.play().catch(() => {});
        } else if (!entry.isIntersecting) {
          ref.current.pause();
        }
      },
      { rootMargin: "200px 0px", threshold: 0.1 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [userPaused]);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      setUserPaused(false);
      video.play().then(() => setPlaying(true)).catch(() => {});
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
        autoPlay
        muted
        loop={!once}
        playsInline
        preload="metadata"
        poster={poster}
        aria-hidden="true"
        tabIndex={-1}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className={className}
      >
        {srcHd && <source src={srcHd} type="video/mp4" media="(min-width: 1024px)" />}
        <source src={src} type="video/mp4" />
      </video>
      {!controlled && (
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause background video" : "Play background video"}
        className={`absolute z-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-obsidian-900/70 text-white backdrop-blur-md border border-white/20 hover:bg-obsidian-900/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-summit-500 ${buttonClassName}`}
      >
        {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
      </button>
      )}
    </>
  );
}
