"use client";

// The Private Tours page card (owner's spec, pages 27–35): photo, name, description, a table of
// details, price with savings/season box, and a gold button. Also used for every journey on the
// Multi-Day page (owner, 2026-11-27), so rows without a value are left out.

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building, Calendar, Car, Clock, Compass, FileText, MapPin, Plane, Shield, Sparkles, Users } from "lucide-react";
import { CARD_BADGE } from "@/components/cards/MediaCard";
import { money } from "@/lib/pricing";
import { privateOptionName } from "@/lib/tourNames";
import type { PrivateTourOption } from "@/lib/privateTours";

/** Individual Private Tour Card according to the specifications on Page 29 */
export function PrivateTourCard({
  option,
  calculatedPrice,
  name,
  badge = "Private Tour",
}: {
  option: PrivateTourOption;
  calculatedPrice: number;
  /** Card name instead of privateOptionName(option) (the shared Two-Day on the Multi-Day page). */
  name?: string;
  /** Photo label (default "Private Tour"). */
  badge?: string;
}) {
  const isCustom = option.isCustomPartner;

  return (
    <article className="group flex w-full flex-col overflow-hidden rounded-none border border-white/[0.12] bg-[#12161a] transition-all duration-300 hover:-translate-y-1 hover:border-summit-500/40 hover:shadow-2xl">
      {/* Photograph */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-obsidian-900">
        <Image
          src={option.image}
          alt={option.imageAlt}
          fill
          sizes="(max-width: 768px) 94vw, (max-width: 1200px) 46vw, 380px"
          className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105"
        />
        {isCustom ? (
          <div className="absolute left-3 top-3">
            <span className="bg-summit-200 px-2.5 py-1 text-[0.7rem] uppercase tracking-[0.12em] text-obsidian-900 font-medium rounded-sm">
              PREMIUM CUSTOM JOURNEYS
            </span>
          </div>
        ) : (
          <div className="absolute left-3 top-3">
            <span className={CARD_BADGE}>{badge}</span>
          </div>
        )}
      </div>

      {/* Card Details Panel */}
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-xl font-normal tracking-wide text-white group-hover:text-summit-200 transition-colors">
          {name ?? privateOptionName(option)}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-white/75">{option.description}</p>

        {/* Structured Spec List */}
        {isCustom ? (
          <dl className="mt-5 space-y-2.5 border-t border-white/[0.08] pt-4 text-xs text-white/80">
            <div className="flex items-start justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-white/50">
                <Car className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
                <span>Transport</span>
              </dt>
              <dd className="font-medium text-right text-white">Luxury SUVs and luxury vans</dd>
            </div>

            <div className="flex items-start justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-white/50">
                <Compass className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
                <span>Itinerary</span>
              </dt>
              <dd className="font-medium text-right text-white">Personalised around your interests and preferred pace</dd>
            </div>

            <div className="flex items-start justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-white/50">
                <Sparkles className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
                <span>Pricing</span>
              </dt>
              <dd className="font-medium text-right text-white">Personalised quote after consultation</dd>
            </div>

            <div className="flex items-start justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-white/50">
                <Shield className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
                <span>Scope</span>
              </dt>
              <dd className="font-medium text-right text-white text-[11px] max-w-[65%]">
                Tours only; hotels and restaurants are not arranged
              </dd>
            </div>
          </dl>
        ) : (
          <dl className="mt-5 space-y-2.5 border-t border-white/[0.08] pt-4 text-xs text-white/80">
            <div className="flex items-start justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-white/50">
                <Clock className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
                <span>Duration</span>
              </dt>
              <dd className="font-medium text-right text-white">{option.duration}</dd>
            </div>

            {option.transport && (
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-white/50">
                  <Car className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
                  <span>Transport</span>
                </dt>
                <dd className="font-medium text-right text-white">{option.transport}</dd>
              </div>
            )}

            {option.suggestedStay && (
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-white/50">
                  <Building className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
                  <span>Suggested Stay</span>
                </dt>
                <dd className="font-medium text-right text-white">{option.suggestedStay}</dd>
              </div>
            )}

            {option.pickup && (
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-white/50">
                  <MapPin className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
                  <span>Pickup</span>
                </dt>
                <dd className="font-medium text-right text-white">{option.pickup}</dd>
              </div>
            )}

            {/* Four-Day extra rows (owner, 2026-11-24) & private group row. */}
            {(
              [
                { label: "Final drop-off", value: option.finalDropoff, icon: Plane },
                { label: "Group", value: option.group, icon: Users },
                { label: "Scheduling", value: option.scheduling, icon: Calendar },
                { label: "Dates", value: option.dates, icon: Calendar },
              ] as const
            ).map((row) =>
              row.value ? (
                <div key={row.label} className="flex items-start justify-between gap-3">
                  <dt className="flex shrink-0 items-center gap-1.5 text-white/50">
                    <row.icon className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
                    <span>{row.label}</span>
                  </dt>
                  <dd className="font-medium text-right text-white">{row.value}</dd>
                </div>
              ) : null,
            )}

            {option.activities && (
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-white/50">
                  <Sparkles className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
                  <span>Activities</span>
                </dt>
                <dd className="font-medium text-right text-white">{option.activities}</dd>
              </div>
            )}

            {option.airportTransfers && (
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-white/50">
                  <Plane className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
                  <span>Airport transfers</span>
                </dt>
                <dd className="font-medium text-right text-white">{option.airportTransfers}</dd>
              </div>
            )}

            {option.accommodation && (
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-white/50">
                  <FileText className="h-3.5 w-3.5 text-summit-300 shrink-0" aria-hidden="true" />
                  <span>Accommodation</span>
                </dt>
                <dd className="font-medium text-right text-white text-[11px] max-w-[55%]">
                  {option.accommodation}
                </dd>
              </div>
            )}
          </dl>
        )}

        {/* Price & CTA at bottom */}
        <div className="mt-auto border-t border-white/[0.08] pt-5">
          {isCustom ? (
            <div className="space-y-3">
              <div>
                <p className="text-lg font-light text-white">Personalised quote after consultation</p>
                <p className="text-xs text-white/55">Priced according to your vehicle and tour requirements</p>
              </div>
              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(
                        new CustomEvent("vc:open-concierge", {
                          detail: {
                            topic: "banff-elite",
                            starterMessage: "I would like to request a personalised tour enquiry with Banff Elite.",
                          },
                        }),
                      );
                    }
                  }}
                  className="golden-summit-btn inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm uppercase tracking-[0.14em] font-medium"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>Request Personalised Tours</span>
                </button>
                <a
                  href="https://banffelite.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 text-sm uppercase tracking-[0.14em] text-white transition-all hover:bg-white/10 hover:border-white/40 font-medium"
                >
                  <span>Explore Banff Elite</span>
                  <ArrowUpRight className="h-4 w-4 text-summit-300" aria-hidden="true" />
                  <span className="sr-only">(opens banffelite.com in a new tab)</span>
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4">
                {calculatedPrice <= 0 ? (
                  <div>
                    <p className="text-lg font-light text-white">Price on request</p>
                    <p className="text-xs text-white/55">Per vehicle, confirmed with your dates and group size</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs text-white/55">From</span>
                      <span className="text-2xl font-light tabular-nums text-white">{money(calculatedPrice > 0 ? calculatedPrice : option.priceFrom)}</span>
                      <span className="text-xs text-white/70">{option.priceUnit}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-white/55">
                      {option.id === "banff-yoho-private"
                        ? "Taxes and mandatory fees included. Optional Lake Minnewanka cruise costs extra."
                        : "Taxes and required fees included"}
                    </p>
                    {option.seasonLabel || option.savings ? (
                      <div className="mt-2.5 space-y-1 rounded-lg bg-white/[0.04] p-2.5 text-xs">
                        {option.savings && (
                          <div className="flex items-start justify-between gap-3 text-white/80">
                            <span className="shrink-0 text-white/55">Savings:</span>
                            <span className="text-right font-medium text-summit-200">{option.savings}</span>
                          </div>
                        )}
                        {option.seasonLabel && (
                          <div className="flex items-start justify-between gap-3 text-white/80">
                            <span className="shrink-0 text-white/55">Season:</span>
                            <span className="text-right font-medium text-white">{option.seasonLabel}</span>
                          </div>
                        )}
                        {/* Two-Day private (owner, 2026-11-25): savings note plus both seasonal prices. */}
                        {!option.seasonLabel && option.seasonalPricing && (
                          <>
                            <div className="flex items-center justify-between text-white/80">
                              <span className="text-white/55">Summer Price:</span>
                              <span className="font-medium text-summit-200">{option.seasonalPricing.summer}</span>
                            </div>
                            <div className="flex items-center justify-between text-white/80">
                              <span className="text-white/55">Winter Price:</span>
                              <span className="font-medium text-white">{option.seasonalPricing.winter}</span>
                            </div>
                          </>
                        )}
                      </div>
                    ) : option.seasonalPricing ? (
                      <div className="mt-2.5 space-y-1 rounded-lg bg-white/[0.04] p-2.5 text-xs">
                        <div className="flex items-center justify-between text-white/80">
                          <span className="text-white/55">Summer Price:</span>
                          <span className="font-medium text-summit-200">{option.seasonalPricing.summer}</span>
                        </div>
                        <div className="flex items-center justify-between text-white/80">
                          <span className="text-white/55">Winter Price:</span>
                          <span className="font-medium text-white">{option.seasonalPricing.winter}</span>
                        </div>
                      </div>
                    ) : option.priceNote ? (
                      <p className="mt-1 text-xs text-summit-300 font-medium">{option.priceNote}</p>
                    ) : null}
                  </div>
                )}
              </div>

              <Link
                href={option.buttonHref}
                className="golden-summit-btn inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm uppercase tracking-[0.14em] font-medium"
              >
                {option.buttonLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
