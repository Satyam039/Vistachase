// Voice input for the AI concierge (owner's "VistaChase Website" PDF, 2026-11-14, item 1: spoken
// questions were misheard, words went missing, and what was heard wasn't always sent to the AI).
// Pure helpers used by components/voice/ConciergeChat.tsx:
//   - recognitionLang: the browser's own English (en-IN, en-GB, en-US…) when the concierge is on
//     Auto, so accents are recognised with the right model; the chosen language otherwise.
//   - bestAlternative: the most confident of the recogniser's alternatives.
//   - joinTranscript: final and in-progress words, nothing dropped and nothing doubled.
//   - fixPlaceNames: local names speech engines get wrong ("bamf", "lake louis", "can more").
//   - SPEECH_HINTS: the same names, offered to browsers that accept phrase hints.

import { speechTag } from "@/lib/conciergeLanguages";

/** BCP-47 tag for speech recognition. Auto (null) follows the browser when it is English. */
export function recognitionLang(language: string | null, browserLanguage?: string): string {
  if (language) return speechTag(language);
  const nav = (browserLanguage ?? "").trim();
  return /^en(-|$)/i.test(nav) ? nav : "en-CA";
}

type Alternative = { transcript: string; confidence?: number };

/** The alternative with the highest confidence (browsers that report 0 for all keep the first). */
export function bestAlternative(result: ArrayLike<Alternative>): string {
  let best: Alternative | undefined;
  for (let i = 0; i < result.length; i++) {
    const alt = result[i];
    if (!alt?.transcript) continue;
    if (!best || (alt.confidence ?? 0) > (best.confidence ?? 0)) best = alt;
  }
  return (best?.transcript ?? "").trim();
}

/** Joins pieces of text with single spaces, skipping empty ones. */
export function joinTranscript(...parts: (string | null | undefined)[]): string {
  return parts
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
}

/** Place and tour names, spelled the way the website spells them. */
export const SPEECH_HINTS = [
  "Banff",
  "Canmore",
  "Lake Louise",
  "Moraine Lake",
  "Yoho",
  "Emerald Lake",
  "Johnston Canyon",
  "Lake Minnewanka",
  "Two Jack Lake",
  "Peyto Lake",
  "Bow Lake",
  "Columbia Icefield",
  "Icefields Parkway",
  "Athabasca Glacier",
  "Jasper",
  "Maligne Lake",
  "Calgary",
  "Dead Man's Flat",
  "Harvie Heights",
  "Samson Mall",
  "Vista Chase",
  "Banff Gondola",
  "Skywalk",
  "Ice Explorer",
  "shuttle",
  "private tour",
  "shared tour",
];

// Common mishearings of those names (whole words, any case). Applied to English only.
const FIXES: [RegExp, string][] = [
  [/\b(?:bamf|bampf|banf|bamph|ban ff)\b/gi, "Banff"],
  [/\bcan more\b/gi, "Canmore"],
  [/\blake lou(?:is|ise|ease|ie|y)\b/gi, "Lake Louise"],
  [/\b(?:moraine|morain|moran|morraine|marine|maureen) lake\b/gi, "Moraine Lake"],
  [/\byo ?ho\b/gi, "Yoho"],
  [/\bice ?fields? parkway\b/gi, "Icefields Parkway"],
  [/\b(?:columbia|colombia) ice ?field\b/gi, "Columbia Icefield"],
  [/\bjohnson canyon\b/gi, "Johnston Canyon"],
  [/\b(?:minnie|mini|minne) ?w[ao]nk?a\b/gi, "Minnewanka"],
  [/\b(?:payto|peto|peyto|pay toe) lake\b/gi, "Peyto Lake"],
  [/\b(?:malign|maligned|malin) lake\b/gi, "Maligne Lake"],
  [/\bathabaska\b/gi, "Athabasca"],
  [/\bsampson mall\b/gi, "Samson Mall"],
  [/\bdead ?mans? flats?\b/gi, "Dead Man's Flat"],
  [/\bharvey heights\b/gi, "Harvie Heights"],
  [/\bvista chas(?:e|ed)?\b/gi, "Vista Chase"],
];

/** Fixes misheard place names in an English transcript; other languages are left as heard. */
export function fixPlaceNames(text: string, lang: string): string {
  if (!/^en/i.test(lang)) return text;
  return FIXES.reduce((t, [re, to]) => t.replace(re, to), text);
}
