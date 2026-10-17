// Input schemas for the SEO admin API, and the advisory checks the editor shows (lengths, focus
// keyword placement, snippet size). Advice only: nothing here promises a ranking.

import { z } from "zod";
import { checkCanonical, checkImageRef, checkLink, normalizeKeyword, normalizePath, SLUG_PATTERN } from "@/modules/seo/paths";

// "" clears a field (stored as null); undefined leaves it unchanged.
const text = (max: number) =>
  z
    .string()
    .max(max, `Keep it under ${max} characters.`)
    .transform((v) => {
      // Control characters never belong in metadata.
      const cleaned = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
      return cleaned === "" ? null : cleaned;
    })
    .nullable();

const refined = (check: (v: string) => { ok: true; value: string } | { ok: false; error: string }) =>
  z
    .string()
    .max(500)
    .nullable()
    .transform((v, ctx) => {
      if (v === null || v.trim() === "") return null;
      const result = check(v);
      if (!result.ok) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
        return z.NEVER;
      }
      return result.value;
    });

const sitePath = z
  .string()
  .max(300)
  .transform((v, ctx) => {
    const path = normalizePath(v);
    if (!path) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Use a site path like /private-tours." });
      return z.NEVER;
    }
    return path;
  });

const tagList = (maxItems: number, maxLen: number) =>
  z
    .array(z.string().max(maxLen))
    .max(maxItems)
    .transform((list) => [...new Set(list.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean))]);

const utm = z
  .string()
  .max(80)
  .regex(/^[A-Za-z0-9_\-.]*$/, "Letters, digits, - _ and . only.")
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const faqSchema = z.object({
  question: z.string().trim().min(5, "Write the question.").max(300),
  answer: z.string().trim().min(5, "Write the answer.").max(2000),
});

export const CONVERSION_GOALS = ["BOOKING", "ENQUIRY", "CALL", "NEWSLETTER", "NONE"] as const;

export const pageUpdateSchema = z
  .object({
    label: z.string().trim().min(2).max(120),
    slug: z.string().trim().toLowerCase().max(80).regex(SLUG_PATTERN, "Lower-case words joined by hyphens, like lake-louise-guide."),
    important: z.boolean(),
    seoTitle: text(120),
    metaDescription: text(320),
    h1: text(150),
    focusKeyword: text(120),
    secondaryKeywords: tagList(15, 120),
    canonicalUrl: refined(checkCanonical),
    robotsIndex: z.boolean(),
    robotsFollow: z.boolean(),
    ogTitle: text(120),
    ogDescription: text(320),
    ogImage: refined(checkImageRef),
    twitterTitle: text(120),
    twitterDescription: text(320),
    twitterImage: refined(checkImageRef),
    breadcrumbLabel: text(60),
    excerpt: text(500),
    body: text(50_000),
    answerSnippet: text(600),
    citationFact: text(300),
    faqs: z.array(faqSchema).max(30),
    authorName: text(120),
    authorBio: text(600),
    reviewedAt: z.coerce.date().nullable(),
    featuredImage: refined(checkImageRef),
    featuredImageAlt: text(200),
    imageTitle: text(200),
    imageCaption: text(300),
    imageFileName: z
      .string()
      .max(120)
      .regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*\.(jpg|jpeg|png|webp|avif)$/, "Lower-case words joined by hyphens, ending .jpg, .png, .webp or .avif.")
      .transform((v) => (v === "" ? null : v))
      .nullable(),
    ctaText: text(60),
    ctaUrl: refined(checkLink),
    conversionGoal: z.enum(CONVERSION_GOALS),
    utmSource: utm,
    utmMedium: utm,
    utmCampaign: utm,
    pillar: text(80),
    tags: tagList(20, 40),
    relatedPaths: z.array(sitePath).max(20).transform((l) => [...new Set(l)]),
    sitemapPriority: z.number().min(0).max(1).nullable(),
    sitemapInclude: z.boolean(),
    datePublished: z.coerce.date().nullable(),
    dateModified: z.coerce.date().nullable(),
    featured: z.boolean(),
    thumbnailImage: refined(checkImageRef),
    thumbnailAlt: text(200),
    searchTitle: text(120),
    searchDescription: text(320),
    searchImage: refined(checkImageRef),
    searchExclude: z.boolean(),
    /** Required to switch an important page to noindex. */
    confirmNoindex: z.boolean(),
  })
  .partial()
  .strict();

export type PageUpdateInput = z.infer<typeof pageUpdateSchema>;

export const createGuideSchema = z
  .object({
    label: z.string().trim().min(2).max(120),
    slug: z.string().trim().toLowerCase().max(80).regex(SLUG_PATTERN, "Lower-case words joined by hyphens, like lake-louise-guide."),
    focusKeyword: text(120).optional(),
  })
  .strict();

export const publishSchema = z
  .object({
    action: z.enum(["publish", "unpublish", "schedule", "archive"]),
    publishAt: z.coerce.date().optional(),
    confirmNoindex: z.boolean().optional(),
  })
  .strict();

// ---------------------------------------------------------------------------------------------
// Keywords

export const INTENTS = ["INFORMATIONAL", "COMMERCIAL", "TRANSACTIONAL", "NAVIGATIONAL"] as const;
export const FUNNEL_STAGES = ["TOFU", "MOFU", "BOFU"] as const;
export const TRACKS = ["TRAFFIC_ACQUISITION", "BOOKING_CONVERSION"] as const;
export const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export const KEYWORD_STATUSES = ["IDEA", "PLANNED", "IN_PROGRESS", "IMPLEMENTED", "ARCHIVED"] as const;
export const VALIDATION_STATUSES = ["UNVERIFIED", "VERIFIED", "REJECTED"] as const;
export const RESEARCH_STATUSES = ["UNVERIFIED", "RESEARCHED", "VALIDATED", "MAPPED", "IMPLEMENTED", "MONITORED"] as const;
export const METRIC_BASES = ["UNKNOWN", "ESTIMATE", "RESEARCHED"] as const;
export const ROLES = ["PRIMARY", "SECONDARY"] as const;
export const PAGE_TYPES = ["HOME", "TOUR", "DESTINATION", "LANDING", "GUIDE", "STATIC", "LEGAL"] as const;

const keywordFields = z.object({
  keyword: z.string().trim().min(2, "Enter the keyword.").max(150),
  designation: z.enum(ROLES),
  searchVolume: z.number().int().min(0).max(100_000_000).nullable(),
  volumeBasis: z.enum(METRIC_BASES),
  volumeSource: text(120),
  difficulty: z.number().int().min(0).max(100).nullable(),
  difficultyBasis: z.enum(METRIC_BASES),
  difficultySource: text(120),
  intent: z.enum(INTENTS),
  funnelStage: z.enum(FUNNEL_STAGES),
  track: z.enum(TRACKS),
  clusterId: z.string().max(40).nullable(),
  targetPath: z
    .string()
    .max(300)
    .nullable()
    .transform((v, ctx) => {
      if (v === null || v.trim() === "") return null;
      const path = normalizePath(v);
      if (!path) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Use a site path like /private-tours." });
        return z.NEVER;
      }
      return path;
    }),
  targetPageType: z.enum(PAGE_TYPES).nullable(),
  priority: z.enum(PRIORITIES),
  businessRelevance: z.number().int().min(1).max(5).nullable(),
  competitionNotes: text(1000),
  competitors: tagList(10, 120),
  status: z.enum(KEYWORD_STATUSES),
  dataSource: text(200),
  lastVerifiedAt: z.coerce.date().nullable(),
  validationStatus: z.enum(VALIDATION_STATUSES),
  researchStatus: z.enum(RESEARCH_STATUSES),
  parentTopic: text(120),
  market: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use a two-letter country code, such as CA."),
  language: z.string().trim().regex(/^[a-z]{2}(-[A-Za-z]{2})?$/, "Use a language code, such as en or fr-CA."),
  bookingIntent: z.number().int().min(1).max(5).nullable(),
  competitorEvidence: text(1000),
  contentGap: text(1000),
  recommendedAction: text(1000),
  notes: text(2000),
});

/** A metric is RESEARCHED only with a value and a named source; a value can't be UNKNOWN. */
const metricsConsistent = (creating: boolean) => (k: Partial<z.infer<typeof keywordFields>>, ctx: z.RefinementCtx) => {
  for (const [value, sentBasis, source, name] of [
    [k.searchVolume, k.volumeBasis, k.volumeSource, "volume"],
    [k.difficulty, k.difficultyBasis, k.difficultySource, "difficulty"],
  ] as const) {
    if (sentBasis === undefined && value === undefined) continue;
    // A new keyword without a stated basis is UNKNOWN; an edit is checked against the stored record.
    const basis = sentBasis ?? (creating ? "UNKNOWN" : undefined);
    if (value === null && basis && basis !== "UNKNOWN") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name === "volume" ? "volumeBasis" : "difficultyBasis"], message: `No ${name} value, so its basis must be Unknown.` });
    }
    if (typeof value === "number" && basis === "UNKNOWN") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name === "volume" ? "volumeBasis" : "difficultyBasis"], message: `Say whether this ${name} is researched or an estimate.` });
    }
    if (basis === "RESEARCHED" && !source) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name === "volume" ? "volumeSource" : "difficultySource"], message: `Name the tool the ${name} came from (for example Google Keyword Planner).` });
    }
  }
  if (k.validationStatus === "VERIFIED" && k.lastVerifiedAt === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lastVerifiedAt"], message: "A verified keyword needs the date it was checked." });
  }
};

export const keywordCreateSchema = keywordFields
  .partial({
    designation: true,
    searchVolume: true,
    volumeBasis: true,
    volumeSource: true,
    difficulty: true,
    difficultyBasis: true,
    difficultySource: true,
    clusterId: true,
    targetPath: true,
    targetPageType: true,
    priority: true,
    businessRelevance: true,
    competitionNotes: true,
    competitors: true,
    status: true,
    dataSource: true,
    lastVerifiedAt: true,
    validationStatus: true,
    researchStatus: true,
    parentTopic: true,
    market: true,
    language: true,
    bookingIntent: true,
    competitorEvidence: true,
    contentGap: true,
    recommendedAction: true,
    notes: true,
  })
  .strict()
  .superRefine(metricsConsistent(true));

export const keywordUpdateSchema = keywordFields.partial().strict().superRefine(metricsConsistent(false));

/** Bulk edit: the same values on up to 500 keywords. Metrics and the keyword text are per keyword. */
export const keywordBulkSchema = z
  .object({
    ids: z.array(z.string().min(10).max(40)).min(1, "Select at least one keyword.").max(500),
    set: z
      .object({
        priority: z.enum(PRIORITIES),
        status: z.enum(KEYWORD_STATUSES),
        researchStatus: z.enum(RESEARCH_STATUSES),
        track: z.enum(TRACKS),
        intent: z.enum(INTENTS),
        funnelStage: z.enum(FUNNEL_STAGES),
        clusterId: z.string().max(40).nullable(),
        parentTopic: text(120),
        targetPageType: z.enum(PAGE_TYPES).nullable(),
      })
      .partial()
      .strict()
      .refine((v) => Object.keys(v).length > 0, "Choose at least one field to change."),
  })
  .strict();

export const mappingSchema = z.object({ pageId: z.string().min(1).max(40), role: z.enum(ROLES) }).strict();

export const clusterSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    pillar: text(80),
    track: z.enum(TRACKS),
    description: text(1000),
    hubPath: z
      .string()
      .max(300)
      .nullable()
      .transform((v, ctx) => {
        if (v === null || v.trim() === "") return null;
        const path = normalizePath(v);
        if (!path) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Use a site path like /private-tours." });
          return z.NEVER;
        }
        return path;
      }),
  })
  .partial({ pillar: true, description: true, hubPath: true })
  .strict();

export const keywordListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  track: z.enum(TRACKS).optional(),
  intent: z.enum(INTENTS).optional(),
  funnelStage: z.enum(FUNNEL_STAGES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(KEYWORD_STATUSES).optional(),
  validationStatus: z.enum(VALIDATION_STATUSES).optional(),
  researchStatus: z.enum(RESEARCH_STATUSES).optional(),
  targetPageType: z.enum(PAGE_TYPES).optional(),
  clusterId: z.string().max(40).optional(),
  mapped: z.enum(["yes", "no"]).optional(),
  flag: z.enum(["cannibalised", "intentMismatch", "unmapped", "planned"]).optional(),
  sort: z.enum(["priority", "keyword", "ref", "searchVolume", "difficulty", "updatedAt"]).default("priority"),
  dir: z.enum(["asc", "desc"]).default("asc"),
  includeArchived: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

// ---------------------------------------------------------------------------------------------
// Redirects, llms.txt, site settings

export const redirectSchema = z
  .object({
    fromPath: sitePath,
    toPath: sitePath,
    statusCode: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).default(301),
    active: z.boolean().default(true),
    note: text(300).optional(),
  })
  .strict();

export const redirectUpdateSchema = z
  .object({
    toPath: sitePath,
    statusCode: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]),
    active: z.boolean(),
    note: text(300),
  })
  .partial()
  .strict();

export const llmsEntrySchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    path: z
      .string()
      .max(500)
      .transform((v, ctx) => {
        const r = checkLink(v);
        if (!r.ok || r.value.startsWith("mailto:") || r.value.startsWith("tel:")) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Use a site path like /private-tours or an https:// address." });
          return z.NEVER;
        }
        return r.value;
      }),
    description: text(300).optional(),
    section: z.enum(["PRIMARY", "SECONDARY"]).default("PRIMARY"),
  })
  .strict();

export const siteSettingsSchema = z
  .object({
    siteName: z.string().trim().min(2).max(80),
    summary: text(500),
    aboutText: text(2000),
    contactEmail: z.string().trim().email().max(200).or(z.literal("")).transform((v) => v || null).nullable(),
    contactPhone: z.string().trim().max(40).regex(/^[0-9+().\-\s]*$/, "Digits, spaces and + ( ) - only").transform((v) => v || null).nullable(),
    address: text(300),
    serviceArea: tagList(20, 80),
    businessHours: text(300),
    googleBusinessUrl: refined((v) => {
      const r = checkLink(v);
      return r.ok && r.value.startsWith("https://") ? r : { ok: false as const, error: "Use the https:// link to the Google Business Profile." };
    }),
    sameAs: z
      .array(z.string().max(300))
      .max(15)
      .transform((list, ctx) => {
        const out: string[] = [];
        for (const v of list.map((s) => s.trim()).filter(Boolean)) {
          const r = checkLink(v);
          if (!r.ok || !r.value.startsWith("https://")) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${v.slice(0, 60)}" isn't an https:// profile link.` });
            return z.NEVER;
          }
          out.push(r.value);
        }
        return [...new Set(out)];
      }),
    llmsEnabled: z.boolean(),
    entries: z.array(llmsEntrySchema).max(60),
  })
  .partial()
  .strict();

// ---------------------------------------------------------------------------------------------
// Advisory checks for the editor and the publish gate

export interface FieldCheck {
  field: string;
  level: "error" | "warning" | "info";
  message: string;
}

export const LIMITS = {
  title: { min: 50, max: 60 },
  description: { min: 150, max: 160 },
  snippetWords: { min: 40, max: 60 },
};

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const contains = (haystack: string | null | undefined, needle: string) => !!haystack && normalizeKeyword(haystack).includes(needle);

export interface CheckablePage {
  source: string;
  pageType: string;
  important: boolean;
  seoTitle: string | null;
  metaDescription: string | null;
  h1: string | null;
  focusKeyword: string | null;
  canonicalUrl: string | null;
  robotsIndex: boolean;
  ogImage: string | null;
  featuredImage: string | null;
  featuredImageAlt: string | null;
  answerSnippet: string | null;
  body: string | null;
  faqs: unknown;
  /** What the live page shows today (last audit), used when a field has no override. */
  live?: { title?: string | null; description?: string | null; h1?: string[] | null; canonical?: string | null } | null;
}

/**
 * Field checks for one page. "error" blocks publishing; "warning" and "info" are advice. Effective
 * values fall back to what the live page showed at the last audit.
 */
export function checkPage(page: CheckablePage): FieldCheck[] {
  const out: FieldCheck[] = [];
  const isCms = page.source === "CMS";
  const title = page.seoTitle ?? page.live?.title ?? null;
  const description = page.metaDescription ?? page.live?.description ?? null;
  const h1 = page.h1 ?? page.live?.h1?.[0] ?? null;

  if (isCms) {
    if (!page.seoTitle) out.push({ field: "seoTitle", level: "error", message: "A guide needs an SEO title." });
    if (!page.metaDescription) out.push({ field: "metaDescription", level: "error", message: "A guide needs a meta description." });
    if (!page.h1) out.push({ field: "h1", level: "error", message: "A guide needs an H1." });
    if (!page.body || words(page.body) < 150) out.push({ field: "body", level: "error", message: "A guide needs at least 150 words of content, so it isn't a thin page." });
  }

  if (!title) out.push({ field: "seoTitle", level: "warning", message: "No title known yet. Set one, or run an audit to read the live page." });
  else if (title.length < LIMITS.title.min || title.length > LIMITS.title.max)
    out.push({ field: "seoTitle", level: "warning", message: `Title is ${title.length} characters; ${LIMITS.title.min}–${LIMITS.title.max} usually shows in full.` });

  if (!description) out.push({ field: "metaDescription", level: "warning", message: "No meta description known yet." });
  else if (description.length < LIMITS.description.min || description.length > LIMITS.description.max)
    out.push({ field: "metaDescription", level: "warning", message: `Description is ${description.length} characters; aim for ${LIMITS.description.min}–${LIMITS.description.max}.` });

  if (title && h1 && title.trim().toLowerCase() === h1.trim().toLowerCase())
    out.push({ field: "h1", level: "info", message: "The H1 matches the SEO title. They can differ: the title is for search results, the H1 for the page." });

  if (!page.focusKeyword) out.push({ field: "focusKeyword", level: "warning", message: "No focus keyword." });
  else {
    const kw = normalizeKeyword(page.focusKeyword);
    if (title && !contains(title, kw)) out.push({ field: "seoTitle", level: "info", message: "The focus keyword isn't in the title." });
    if (description && !contains(description, kw)) out.push({ field: "metaDescription", level: "info", message: "The focus keyword isn't in the description." });
    if (h1 && !contains(h1, kw)) out.push({ field: "h1", level: "info", message: "The focus keyword isn't in the H1." });
  }

  if (!page.robotsIndex && (page.important || page.pageType === "TOUR" || page.pageType === "HOME"))
    out.push({ field: "robotsIndex", level: "warning", message: "This is a key page and it is set to noindex: it would drop out of search results." });

  if (page.answerSnippet) {
    const n = words(page.answerSnippet);
    if (n < LIMITS.snippetWords.min || n > LIMITS.snippetWords.max)
      out.push({ field: "answerSnippet", level: "info", message: `Direct answer is ${n} words; ${LIMITS.snippetWords.min}–${LIMITS.snippetWords.max} is easiest to quote.` });
  }

  if (page.featuredImage && !page.featuredImageAlt) out.push({ field: "featuredImageAlt", level: "warning", message: "The featured image needs alt text." });
  if (!page.ogImage && !page.featuredImage && isCms) out.push({ field: "ogImage", level: "info", message: "No social image; shares will use the site default." });

  if (Array.isArray(page.faqs) && page.faqs.length > 0 && !isCms)
    out.push({ field: "faqs", level: "info", message: "FAQs saved here are shown (and marked up) on guide pages only; this page's own FAQs come from its code or tour record." });

  return out;
}

/** 0-100: share of the core fields that have a value (override or live). */
export function completeness(page: CheckablePage): number {
  const fields = [
    page.seoTitle ?? page.live?.title,
    page.metaDescription ?? page.live?.description,
    page.h1 ?? page.live?.h1?.[0],
    page.canonicalUrl ?? page.live?.canonical,
    page.focusKeyword,
    page.ogImage ?? page.featuredImage,
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}
