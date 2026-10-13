// Tripadvisor award as a text seal: the real Tripadvisor wordmark (backend/media/badges) with the
// award spelled out: Travelers' Choice Best of the Best 2026, the year on the live site's badge.
// Swap in the official badge file here when Vista Chase has it in high resolution.

import Image from "next/image";
import { Star } from "lucide-react";

export const AWARD = { name: "Travelers' Choice Best of the Best", year: "2026" };

/** Large seal (award section, About page). */
export function AwardSeal({ className = "", size = "lg" }: { className?: string; size?: "md" | "lg" }) {
  const md = size === "md";
  return (
    <div
      role="img"
      aria-label={`Tripadvisor ${AWARD.name} ${AWARD.year}`}
      className={`flex flex-col items-center justify-center text-center ${className}`}
    >
      <Image
        src="/media/badges/tripadvisor-logo.png"
        alt="Tripadvisor"
        width={800}
        height={122}
        className={`h-auto ${md ? "w-[56%]" : "w-[62%]"}`}
      />
      
      {/* 5 gleaming gold stars */}
      <div className={`flex items-center gap-1 ${md ? "mt-1.5" : "mt-3"} text-summit-500`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`${md ? "h-3 w-3" : "h-3.5 w-3.5"} fill-summit-500 text-summit-500`} />
        ))}
      </div>

      <span className={`${md ? "mt-1 text-[10px]" : "mt-2 text-xs"} uppercase tracking-[0.22em] text-[#85641b] font-medium`}>
        Travelers&apos; Choice
      </span>
      <span className={`font-serif tracking-wide text-obsidian-900 font-medium ${md ? "text-xs" : "text-xl sm:text-2xl mt-0.5"}`}>
        Best of the Best
      </span>
      <span className={`font-light tabular-nums tracking-tight text-obsidian-900 ${md ? "mt-0.5 text-2xl" : "mt-1 text-5xl sm:text-6xl"}`}>
        {AWARD.year}
      </span>
    </div>
  );
}

/** Compact tile (footer trust card). */
export function AwardMark() {
  return (
    <span aria-hidden="true" className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-white text-center text-obsidian-900">
      <span className="text-lg font-light leading-none tabular-nums">{AWARD.year}</span>
      <span className="mt-1 text-xs leading-tight text-slate-600">
        Best of
        <br />
        the Best
      </span>
    </span>
  );
}
