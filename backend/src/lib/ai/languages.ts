// Languages the concierge's language selector offers. The Claude agent writes all of these
// fluently; the list is kept to languages our guests actually use rather than everything the
// model can do. The frontend keeps the same list in frontend/src/lib/conciergeLanguages.ts.

export const CONCIERGE_LANGUAGES = [
  { code: "en", label: "English", english: "English" },
  { code: "fr", label: "Français", english: "French" },
  { code: "es", label: "Español", english: "Spanish" },
  { code: "de", label: "Deutsch", english: "German" },
  { code: "it", label: "Italiano", english: "Italian" },
  { code: "pt", label: "Português", english: "Portuguese" },
  { code: "nl", label: "Nederlands", english: "Dutch" },
  { code: "sv", label: "Svenska", english: "Swedish" },
  { code: "pl", label: "Polski", english: "Polish" },
  { code: "ru", label: "Русский", english: "Russian" },
  { code: "uk", label: "Українська", english: "Ukrainian" },
  { code: "tr", label: "Türkçe", english: "Turkish" },
  { code: "ar", label: "العربية", english: "Arabic" },
  { code: "he", label: "עברית", english: "Hebrew" },
  { code: "hi", label: "हिन्दी", english: "Hindi" },
  { code: "pa", label: "ਪੰਜਾਬੀ", english: "Punjabi" },
  { code: "zh", label: "简体中文", english: "Simplified Chinese" },
  { code: "zh-Hant", label: "繁體中文", english: "Traditional Chinese" },
  { code: "ja", label: "日本語", english: "Japanese" },
  { code: "ko", label: "한국어", english: "Korean" },
  { code: "vi", label: "Tiếng Việt", english: "Vietnamese" },
  { code: "th", label: "ไทย", english: "Thai" },
  { code: "id", label: "Bahasa Indonesia", english: "Indonesian" },
  { code: "tl", label: "Tagalog", english: "Tagalog" },
] as const;

export type ConciergeLanguage = (typeof CONCIERGE_LANGUAGES)[number]["code"];

/** The language for a code the browser sent, or null for "auto" / anything unknown. */
export function conciergeLanguage(code: unknown) {
  return CONCIERGE_LANGUAGES.find((l) => l.code === code) ?? null;
}
