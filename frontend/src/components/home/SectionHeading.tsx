// Section heading used across the redesigned pages: small eyebrow, large light headline, an
// optional intro and an optional "See all" link. Centred on the page axis by default (site-wide
// rule: section headings are centred, the content below stays left-aligned); align="left" puts
// the link on the right instead (GetYourGuide / Viator rails).

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeading({
  id,
  eyebrow,
  title,
  intro,
  link,
  tone = "light",
  align = "center",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  intro?: string;
  link?: { label: string; href: string };
  tone?: "light" | "dark";
  align?: "left" | "center";
}) {
  const dark = tone === "dark";
  return (
    <div
      className={`mb-10 flex flex-col gap-5 sm:mb-14 ${
        align === "center" ? "items-center text-center" : "md:flex-row md:items-end md:justify-between"
      }`}
    >
      <div className="max-w-3xl" data-reveal>
        {eyebrow && (
          <p className={`mb-3 text-sm uppercase tracking-[0.22em] ${dark ? "text-summit-300" : "text-ocean-600"}`}>{eyebrow}</p>
        )}
        <h2
          id={id}
          className={`text-balance text-3xl font-light leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl ${
            dark ? "text-white" : "text-obsidian-900"
          }`}
        >
          {title}
        </h2>
        {intro && (
          <p className={`mt-4 max-w-2xl text-lg font-light leading-relaxed ${dark ? "text-slate-300" : "text-slate-600"} ${align === "center" ? "mx-auto" : ""}`}>
            {intro}
          </p>
        )}
      </div>
      {link && (
        <Link
          href={link.href}
          data-reveal="fade"
          className={`group inline-flex shrink-0 items-center gap-2 border-b pb-1 text-base ${
            dark ? "border-summit-500 text-white" : "border-ocean-600 text-obsidian-900"
          }`}
        >
          {link.label}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
