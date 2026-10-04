"use client";

import React, { useState } from "react";
import Image from "next/image";

interface VideoBackgroundProps {
  videoSrc?: string;
  posterSrc: string;
  alt?: string;
  overlayOpacity?: number;
  className?: string;
  children?: React.ReactNode;
}

export function VideoBackground({
  videoSrc,
  posterSrc,
  alt = "Canadian Rockies scenic view",
  overlayOpacity = 0.55,
  className = "",
  children,
}: VideoBackgroundProps) {
  const [videoLoaded, setVideoLoaded] = useState(false);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Poster image fallback / initial render */}
      <Image
        src={posterSrc}
        alt={alt}
        fill
        priority
        sizes="100vw"
        className={`object-cover transition-opacity duration-1000 ${
          videoLoaded && videoSrc ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* Video layer if provided */}
      {videoSrc && (
        <video
          autoPlay
          muted
          loop
          playsInline
          poster={posterSrc}
          onCanPlayThrough={() => setVideoLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            videoLoaded ? "opacity-100" : "opacity-0"
          }`}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
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
