// The one card layout for linked content tiles (service categories, destinations, "other ways to
// explore"): the photo as its own full-width block on top, an optional badge over the photo, then
// a separate dark content panel below it with the eyebrow, title, description, any metadata and
// the call to action at the bottom. It mirrors TourCard (square corners, hairline border, uppercase
// title) so every card on the site reads the same; TourCard keeps its tour-specific fields.

import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface MediaCardProps {
  href: string;
  image: string;
  /** Decorative by default: the title names the card. */
  imageAlt?: string;
  sizes: string;
  /** Tailwind aspect class for the photo block. */
  aspect?: string;
  /** Short label over the photo (only true, earned or factual labels). */
  badge?: string;
  /** Small uppercase line above the title (category or location). */
  eyebrow?: string;
  eyebrowIcon?: React.ElementType;
  title: string;
  headingLevel?: 2 | 3;
  description?: string;
  /** Extra rows that only some cards have (tour count, duration...). */
  meta?: React.ReactNode;
  cta: string;
  /** Photo drifts against the scroll, as on the cards this replaces. */
  parallax?: boolean;
  /** Clamp the description to keep cards in a row the same height. */
  clampDescription?: boolean;
}

export function MediaCard({
  href,
  image,
  imageAlt = "",
  sizes,
  aspect = "aspect-[5/4]",
  badge,
  eyebrow,
  eyebrowIcon: EyebrowIcon,
  title,
  headingLevel = 3,
  description,
  meta,
  cta,
  parallax = false,
  clampDescription = true,
}: MediaCardProps) {
  const Title = headingLevel === 2 ? "h2" : "h3";
  return (
    <Link
      href={href}
      className="group flex h-full flex-col text-white transition-transform duration-500 ease-out hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ocean-600"
    >
      {/* Photo block: square corners, nothing over the photo but the badge */}
      <span className={`relative block w-full shrink-0 overflow-hidden bg-obsidian-900 ${aspect}`}>
        <span className="absolute inset-0 block transition-transform duration-[1.4s] ease-out group-hover:scale-[1.04]">
          <Image src={image} alt={imageAlt} fill sizes={sizes} className="object-cover" data-parallax={parallax ? "6" : undefined} />
        </span>
        {badge && (
          <span className="absolute left-3 top-3 bg-obsidian-950/70 px-2.5 py-1 text-[0.7rem] uppercase tracking-[0.12em] text-white backdrop-blur-md">
            {badge}
          </span>
        )}
      </span>

      {/* Content panel: separate from the photo, square, hairline border */}
      <span className="flex flex-1 flex-col border border-t-0 border-white/[0.12] bg-[#161a1d] px-5 pb-5 pt-5 transition-colors duration-500 group-hover:border-summit-400/40 sm:px-6">
        {eyebrow && (
          <span className="mb-2 flex min-w-0 items-center gap-1 text-[0.7rem] uppercase tracking-[0.16em] text-white/60">
            {EyebrowIcon && <EyebrowIcon className="h-3 w-3 shrink-0 text-summit-300" aria-hidden="true" />}
            <span className="truncate">{eyebrow}</span>
          </span>
        )}
        <Title className="line-clamp-2 text-base font-normal uppercase leading-snug tracking-[0.14em] text-white">{title}</Title>
        {description && (
          <span className={`mt-2 block text-sm font-light leading-relaxed text-white/75 ${clampDescription ? "line-clamp-3" : ""}`}>{description}</span>
        )}
        {meta && <span className="mt-3 block text-xs text-white/70">{meta}</span>}

        <span className="mt-auto block pt-4">
          <span className="flex items-center justify-between gap-3 border-t border-white/[0.1] pt-3">
            <span className="text-xs uppercase tracking-[0.16em] text-white/85">{cta}</span>
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-summit-200 ring-1 ring-summit-200/40 transition-colors duration-300 group-hover:bg-summit-200 group-hover:text-obsidian-900"
              aria-hidden="true"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </span>
        </span>
      </span>
    </Link>
  );
}
