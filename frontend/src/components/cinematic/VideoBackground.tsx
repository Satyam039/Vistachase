"use client";

import React from "react";
import Image from "next/image";
import { AmbientVideo } from "@/components/cinematic/AmbientVideo";

interface VideoBackgroundProps {
  videoSrc?: string;
  videoSrcHd?: string;
  posterSrc: string;
  alt?: string;
  overlayOpacity?: number;
  className?: string;
  children?: React.ReactNode;
}

export function VideoBackground({
  videoSrc,
  videoSrcHd,
  posterSrc,
  alt = "Canadian Rockies scenic view",
  overlayOpacity = 0.55,
  className = "",
  children,
}: VideoBackgroundProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Poster image fallback / initial render */}
      <Image
        src={posterSrc}
        alt={alt}
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-100"
      />

      {/* Video layer if provided */}
      {videoSrc && (
        <AmbientVideo src={videoSrc} srcHd={videoSrcHd} poster={posterSrc} className="absolute inset-0 w-full h-full object-cover" />
      )}

      {/* Cinematic dark scrim overlay */}
      <div
        className="absolute inset-0 cinematic-scrim pointer-events-none"
        style={{ opacity: overlayOpacity }}
      />
      <div className="absolute inset-0 cinematic-vignette pointer-events-none opacity-60" />

      {/* Optional foreground content */}
      {children && <div className="relative z-10 w-full h-full">{children}</div>}
    </div>
  );
}
