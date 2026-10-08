// Offer price with the struck-through original price and the saving, as on Viator / GetYourGuide.
// Screen readers hear "Original price $239, offer price $199 CAD per guest".

import { hasPrice, money, originalPrice, savingsPercent } from "@/lib/pricing";

export function PriceTag({
  price,
  currency = "CAD",
  unit,
  lead = "From",
  tone = "light",
  size = "md",
  layout = "stacked",
}: {
  price: number | null | undefined;
  currency?: string;
  /** e.g. "per guest", "per group" */
  unit?: string;
  lead?: string;
  /** light: on white/frost surfaces; dark: on dark surfaces */
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  /** inline: one line (struck price, offer price, unit), for compact bars. */
  layout?: "stacked" | "inline";
}) {
  const muted = tone === "dark" ? "text-slate-300" : "text-slate-600";
  const strong = tone === "dark" ? "text-white" : "text-obsidian-900";
  const priceSize = size === "lg" ? "text-4xl" : size === "sm" ? "text-xl" : "text-3xl";

  if (!hasPrice(price)) {
    return (
      <p className={`${strong} ${size === "lg" ? "text-2xl" : "text-lg"} font-light`}>
        Price on request
      </p>
    );
  }
  const original = originalPrice(price);
  if (layout === "inline") {
    return (
      <p className={`flex flex-wrap items-baseline gap-x-1.5 ${muted} text-sm`}>
        {original && (
          <del>
            <span className="sr-only">Original price </span>
            {money(original)}
          </del>
        )}
        <ins className={`no-underline text-xl font-light ${strong}`}>
          {original && <span className="sr-only">Offer price </span>}
          {money(price)}
        </ins>
        <span className="whitespace-nowrap">{unit ?? currency}</span>
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <p className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${muted} text-sm`}>
        <span>{lead}</span>
        {original && (
          <del className="decoration-1">
            <span className="sr-only">Original price </span>
            {money(original)}
          </del>
        )}
      </p>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <ins className={`no-underline ${priceSize} font-light ${strong}`}>
          {original && <span className="sr-only">Offer price </span>}
          {money(price)}
        </ins>
        <span className={`text-sm ${muted}`}>
          {currency}
          {unit ? ` ${unit}` : ""}
        </span>
        {original && (
          <span className={`ml-1 inline-flex self-center rounded-full px-2.5 py-0.5 text-xs ${tone === "dark" ? "bg-white/10 text-white/80" : "bg-emerald-50 text-emerald-800"}`}>
            Save {savingsPercent(price, original)}%
          </span>
        )}
      </p>
    </div>
  );
}
