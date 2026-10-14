// The one card layout for image cards (service categories, destinations, highlights, guides,
// fleet...): the photo as its own rectangular full-width block on top, an optional badge over the
// photo, then a separate dark content panel below it with the eyebrow, title, description, any
// metadata and the call to action at the bottom. It mirrors TourCard (square corners, hairline
// border, uppercase title) so every card on the site reads the same. Cards with their own fields
// (TourCard, SignatureDays, pickup stops, story chapters) use the CardMedia / CARD_PANEL pieces below
// instead of copying the classes.

import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** The dark content panel under a card photo: square, hairline border, no top border. */
export const CARD_PANEL =
  "flex flex-1 flex-col border border-t-0 border-white/[0.12] bg-[#161a1d] px-5 pb-5 pt-5 text-white transition-colors duration-500 group-hover:border-summit-400/40 sm:px-6";
/** Small uppercase line above a card title (location or category). */
export const CARD_EYEBROW = "mb-2 flex min-w-0 items-center gap-1 text-[0.7rem] uppercase tracking-[0.16em] text-white/60";
/** Card title: uppercase, tracked, two lines at most. */
export const CARD_TITLE = "line-clamp-2 text-base font-normal uppercase leading-snug tracking-[0.14em] text-white";
/** Label over a card photo. */
export const CARD_BADGE = "bg-obsidian-950/70 px-2.5 py-1 text-[0.7rem] uppercase tracking-[0.12em] text-white backdrop-blur-md";

/** Rectangular photo block at the top of a card; zooms slightly on hover of the card (group). */
export function CardMedia({
  src,
  alt = "",
  sizes,
  aspect = "aspect-[5/4]",
  parallax = false,
  priority = false,
  children,
}: {
  src: string;
  alt?: string;
  sizes: string;
  aspect?: string;
  parallax?: boolean;
  priority?: boolean;
  /** Overlays: badges, labels. */
  children?: React.ReactNode;
}) {
  return (
    <span className={`relative block w-full shrink-0 overflow-hidden bg-obsidian-900 ${aspect}`}>
      <span className="absolute inset-0 block transition-transform duration-[1.4s] ease-out group-hover:scale-[1.04]">
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" data-parallax={parallax ? "6" : undefined} />
      </span>
      {children}
    </span>
  );
}

export interface MediaCardProps {
  /** Links the whole card; without it the card is a plain article (no call to action). */
  href?: string;
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
  cta?: string;
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
  const body = (
    <>
      <CardMedia src={image} alt={imageAlt} sizes={sizes} aspect={aspect} parallax={parallax}>
        {badge && <span className={`absolute left-3 top-3 ${CARD_BADGE}`}>{badge}</span>}
      </CardMedia>

      {/* Content panel: separate from the photo, square, hairline border */}
      <span className={CARD_PANEL}>
        {eyebrow && (
          <span className={CARD_EYEBROW}>
            {EyebrowIcon && <EyebrowIcon className="h-3 w-3 shrink-0 text-summit-300" aria-hidden="true" />}
            <span className="truncate">{eyebrow}</span>
          </span>
        )}
        <Title className={CARD_TITLE}>{title}</Title>
        {description && (
          <span className={`mt-2 block text-sm font-light leading-relaxed text-white/75 ${clampDescription ? "line-clamp-3" : ""}`}>{description}</span>
        )}
        {meta && <span className="mt-3 block text-xs text-white/70">{meta}</span>}

        {href && cta && (
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
        )}
      </span>
    </>
  );

  if (!href) return <article className="group flex h-full flex-col text-white">{body}</article>;
  return (
    <Link
      href={href}
      className="group flex h-full flex-col text-white transition-transform duration-500 ease-out hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ocean-600"
    >
      {body}
    </Link>
  );
}
