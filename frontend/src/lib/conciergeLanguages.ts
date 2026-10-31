// Languages in the concierge's language selector. Keep in step with
// backend/src/lib/ai/languages.ts, which tells the AI which language to answer in.

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

export type ConciergeLanguageCode = (typeof CONCIERGE_LANGUAGES)[number]["code"];

/** BCP-47 tag for the browser's speech recognition and read-aloud voices. */
export function speechTag(code: string | null): string {
  if (!code) return "en-CA";
  return ({ en: "en-CA", fr: "fr-CA", zh: "zh-CN", "zh-Hant": "zh-TW", pt: "pt-BR", es: "es-ES" } as Record<string, string>)[code] ?? code;
}
