// Keyword research: keywords, clusters, keyword -> page mappings, CSV import (preview first, then
// commit) and export. A metric is stored only when someone supplies it; otherwise it stays null and
// shows as "unknown". Imported figures without a stated basis are kept as unverified estimates.

import type { Prisma, SeoKeyword, SeoPageType } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { normalizeKeyword } from "@/modules/seo/paths";
import { parseCsv, toCsv } from "@/modules/seo/seo.csv";
import { SeoError } from "@/modules/seo/seo.errors";
import { keywordCreateSchema, type keywordListQuery } from "@/modules/seo/seo.validation";

type KeywordInput = z.infer<typeof keywordCreateSchema>;

const KEYWORD_INCLUDE = {
  cluster: { select: { id: true, name: true } },
  mappings: { include: { page: { select: { id: true, path: true, label: true, pageType: true } } } },
} satisfies Prisma.SeoKeywordInclude;

type KeywordRow = Prisma.SeoKeywordGetPayload<{ include: typeof KEYWORD_INCLUDE }>;

/** A keyword's intent doesn't suit the page it is the primary keyword for. */
export function intentMismatch(k: Pick<SeoKeyword, "intent" | "funnelStage" | "track">, pageType: SeoPageType): string | null {
  const editorial = pageType === "GUIDE" || pageType === "STATIC" || pageType === "LEGAL";
  if ((k.intent === "TRANSACTIONAL" || k.funnelStage === "BOFU" || k.track === "BOOKING_CONVERSION") && editorial)
    return "A booking keyword is mapped to an information page; map it to the tour or landing page that sells it.";
  if (k.intent === "INFORMATIONAL" && k.funnelStage === "TOFU" && pageType === "TOUR")
    return "An information keyword is the primary keyword of a tour page; a guide or destination page usually suits it better.";
  return null;
}

export function keywordDto(k: KeywordRow) {
  const primaryPages = k.mappings.filter((m) => m.role === "PRIMARY");
  return {
    id: k.id,
    keyword: k.keyword,
    designation: k.designation,
    searchVolume: k.searchVolume,
    volumeBasis: k.volumeBasis,
    volumeSource: k.volumeSource,
    difficulty: k.difficulty,
    difficultyBasis: k.difficultyBasis,
    difficultySource: k.difficultySource,
    intent: k.intent,
    funnelStage: k.funnelStage,
    track: k.track,
    cluster: k.cluster,
    targetPath: k.targetPath,
    targetPageType: k.targetPageType,
    priority: k.priority,
    businessRelevance: k.businessRelevance,
    competitionNotes: k.competitionNotes,
    competitors: k.competitors,
    status: k.status,
    dataSource: k.dataSource,
    lastVerifiedAt: k.lastVerifiedAt,
    validationStatus: k.validationStatus,
    notes: k.notes,
    archivedAt: k.archivedAt,
    mappings: k.mappings.map((m) => ({ id: m.id, role: m.role, page: m.page })),
    flags: {
      unmapped: k.mappings.length === 0 && !k.targetPath,
      plannedOnly: k.mappings.length === 0 && !!k.targetPath,
      cannibalised: primaryPages.length > 1,
      intentMismatch: primaryPages.map((m) => intentMismatch(k, m.page.pageType)).find(Boolean) ?? null,
    },
    updatedAt: k.updatedAt,
  };
}

export async function listKeywords(query: z.infer<typeof keywordListQuery>) {
  const where: Prisma.SeoKeywordWhereInput = {};
  if (query.includeArchived !== "true") where.archivedAt = null;
  if (query.q) where.keyword = { contains: query.q, mode: "insensitive" };
  for (const key of ["track", "intent", "funnelStage", "priority", "status", "validationStatus", "clusterId"] as const) {
    if (query[key]) (where as Record<string, unknown>)[key] = query[key];
  }
  if (query.mapped === "yes") where.mappings = { some: {} };
  if (query.mapped === "no") where.mappings = { none: {} };
  const [total, rows] = await Promise.all([
    prisma.seoKeyword.count({ where }),
    prisma.seoKeyword.findMany({
      where,
      include: KEYWORD_INCLUDE,
      orderBy: [{ priority: "asc" }, { keyword: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { total, page: query.page, pageSize: query.pageSize, keywords: rows.map(keywordDto) };
}

async function audit(tx: Prisma.TransactionClient, userId: string, action: string, entityType: string, entityId: string, details: object) {
  await tx.auditLog.create({ data: { userId, action, entityType, entityId, details: details as Prisma.InputJsonValue } });
}

function keywordData(input: Partial<KeywordInput>) {
  const { keyword, ...rest } = input;
  return { ...(keyword !== undefined ? { keyword, normalized: normalizeKeyword(keyword) } : {}), ...rest };
}

export async function createKeyword(input: KeywordInput, userId: string) {
  const normalized = normalizeKeyword(input.keyword);
  const existing = await prisma.seoKeyword.findUnique({ where: { normalized } });
  if (existing) throw new SeoError(409, `"${existing.keyword}" is already in the list${existing.archivedAt ? " (archived)" : ""}.`);
  if (input.clusterId && !(await prisma.seoKeywordCluster.findUnique({ where: { id: input.clusterId } }))) throw new SeoError(400, "That cluster doesn't exist.");
  const created = await prisma.$transaction(async (tx) => {
    const k = await tx.seoKeyword.create({ data: { ...(keywordData(input) as Prisma.SeoKeywordUncheckedCreateInput), createdById: userId }, include: KEYWORD_INCLUDE });
    await audit(tx, userId, "SEO_KEYWORD_CREATED", "SeoKeyword", k.id, { keyword: k.keyword });
    return k;
  });
  return keywordDto(created);
}

export async function updateKeyword(id: string, input: Partial<KeywordInput>, userId: string) {
  const current = await prisma.seoKeyword.findUnique({ where: { id } });
  if (!current) throw new SeoError(404, "Keyword not found.");
  if (input.keyword !== undefined) {
    const other = await prisma.seoKeyword.findUnique({ where: { normalized: normalizeKeyword(input.keyword) } });
    if (other && other.id !== id) throw new SeoError(409, `"${other.keyword}" is already in the list.`);
  }
  if (input.clusterId && !(await prisma.seoKeywordCluster.findUnique({ where: { id: input.clusterId } }))) throw new SeoError(400, "That cluster doesn't exist.");
  // Re-check the metric rules against the merged record, not just the fields sent.
  const merged = keywordCreateSchema.safeParse({
    keyword: input.keyword ?? current.keyword,
    intent: input.intent ?? current.intent,
    funnelStage: input.funnelStage ?? current.funnelStage,
    track: input.track ?? current.track,
    searchVolume: input.searchVolume !== undefined ? input.searchVolume : current.searchVolume,
    volumeBasis: input.volumeBasis ?? current.volumeBasis,
    volumeSource: input.volumeSource !== undefined ? input.volumeSource : current.volumeSource,
    difficulty: input.difficulty !== undefined ? input.difficulty : current.difficulty,
    difficultyBasis: input.difficultyBasis ?? current.difficultyBasis,
    difficultySource: input.difficultySource !== undefined ? input.difficultySource : current.difficultySource,
    validationStatus: input.validationStatus ?? current.validationStatus,
    lastVerifiedAt: input.lastVerifiedAt !== undefined ? input.lastVerifiedAt : current.lastVerifiedAt,
  });
  if (!merged.success) throw new SeoError(400, merged.error.issues[0]?.message ?? "Check the metrics.");

  const status = input.status;
  const updated = await prisma.$transaction(async (tx) => {
    const k = await tx.seoKeyword.update({
      where: { id },
      data: { ...(keywordData(input) as Prisma.SeoKeywordUncheckedUpdateInput), ...(status === "ARCHIVED" ? { archivedAt: new Date() } : status ? { archivedAt: null } : {}) },
      include: KEYWORD_INCLUDE,
    });
    await audit(tx, userId, "SEO_KEYWORD_UPDATED", "SeoKeyword", id, { fields: Object.keys(input) });
    return k;
  });
  return keywordDto(updated);
}

export async function setArchived(id: string, archived: boolean, userId: string) {
  const current = await prisma.seoKeyword.findUnique({ where: { id } });
  if (!current) throw new SeoError(404, "Keyword not found.");
  const k = await prisma.$transaction(async (tx) => {
    const k = await tx.seoKeyword.update({ where: { id }, data: archived ? { status: "ARCHIVED", archivedAt: new Date() } : { status: "IDEA", archivedAt: null }, include: KEYWORD_INCLUDE });
    await audit(tx, userId, archived ? "SEO_KEYWORD_ARCHIVED" : "SEO_KEYWORD_RESTORED", "SeoKeyword", id, { keyword: k.keyword });
    return k;
  });
  return keywordDto(k);
}

/** Maps a keyword to a page. Returns warnings (cannibalisation, intent) instead of refusing. */
export async function mapKeyword(keywordId: string, pageId: string, role: "PRIMARY" | "SECONDARY", userId: string) {
  const [keyword, page] = await Promise.all([prisma.seoKeyword.findUnique({ where: { id: keywordId } }), prisma.seoPage.findUnique({ where: { id: pageId } })]);
  if (!keyword) throw new SeoError(404, "Keyword not found.");
  if (!page) throw new SeoError(404, "Page not found.");
  if (keyword.archivedAt) throw new SeoError(400, "Restore the keyword before mapping it.");
  const warnings: string[] = [];
  if (role === "PRIMARY") {
    const others = await prisma.seoKeywordMapping.findMany({ where: { keywordId, role: "PRIMARY", NOT: { pageId } }, include: { page: { select: { path: true } } } });
    if (others.length > 0) warnings.push(`Also the primary keyword of ${others.map((o) => o.page.path).join(", ")}: the pages may compete (cannibalisation).`);
    const mismatch = intentMismatch(keyword, page.pageType);
    if (mismatch) warnings.push(mismatch);
  }
  await prisma.$transaction(async (tx) => {
    await tx.seoKeywordMapping.upsert({ where: { keywordId_pageId: { keywordId, pageId } }, create: { keywordId, pageId, role }, update: { role } });
    if (keyword.status === "IDEA") await tx.seoKeyword.update({ where: { id: keywordId }, data: { status: "PLANNED" } });
    await audit(tx, userId, "SEO_KEYWORD_MAPPED", "SeoKeyword", keywordId, { path: page.path, role });
  });
  const k = await prisma.seoKeyword.findUniqueOrThrow({ where: { id: keywordId }, include: KEYWORD_INCLUDE });
  return { keyword: keywordDto(k), warnings };
}

export async function unmapKeyword(mappingId: string, userId: string) {
  const mapping = await prisma.seoKeywordMapping.findUnique({ where: { id: mappingId }, include: { page: { select: { path: true } } } });
  if (!mapping) throw new SeoError(404, "Mapping not found.");
  await prisma.$transaction(async (tx) => {
    await tx.seoKeywordMapping.delete({ where: { id: mappingId } });
    await audit(tx, userId, "SEO_KEYWORD_UNMAPPED", "SeoKeyword", mapping.keywordId, { path: mapping.page.path });
  });
}

// ---------------------------------------------------------------------------------------------
// Clusters

export async function listClusters() {
  const clusters = await prisma.seoKeywordCluster.findMany({
    orderBy: [{ track: "asc" }, { name: "asc" }],
    include: { keywords: { where: { archivedAt: null }, select: { id: true, priority: true, _count: { select: { mappings: true } } } } },
  });
  return clusters.map((c) => ({
    id: c.id,
    name: c.name,
    pillar: c.pillar,
    track: c.track,
    description: c.description,
    hubPath: c.hubPath,
    keywords: c.keywords.length,
    mapped: c.keywords.filter((k) => k._count.mappings > 0).length,
    highPriority: c.keywords.filter((k) => k.priority === "HIGH").length,
  }));
}

export async function saveCluster(id: string | null, input: { name: string; track: "TRAFFIC_ACQUISITION" | "BOOKING_CONVERSION"; pillar?: string | null; description?: string | null; hubPath?: string | null }, userId: string) {
  const clash = await prisma.seoKeywordCluster.findUnique({ where: { name: input.name } });
  if (clash && clash.id !== id) throw new SeoError(409, `A cluster called "${input.name}" already exists.`);
  return prisma.$transaction(async (tx) => {
    const c = id ? await tx.seoKeywordCluster.update({ where: { id }, data: input }) : await tx.seoKeywordCluster.create({ data: input });
    await audit(tx, userId, id ? "SEO_CLUSTER_UPDATED" : "SEO_CLUSTER_CREATED", "SeoKeywordCluster", c.id, { name: c.name });
    return c;
  });
}

// ---------------------------------------------------------------------------------------------
// CSV export

export const CSV_COLUMNS = [
  "keyword", "designation", "searchVolume", "volumeBasis", "volumeSource", "difficulty", "difficultyBasis", "difficultySource",
  "intent", "funnelStage", "track", "cluster", "targetPath", "targetPageType", "mappedPages", "priority", "businessRelevance",
  "competitors", "competitionNotes", "status", "dataSource", "lastVerifiedAt", "validationStatus", "notes",
] as const;

export async function exportKeywordsCsv(includeArchived: boolean) {
  const rows = await prisma.seoKeyword.findMany({ where: includeArchived ? {} : { archivedAt: null }, include: KEYWORD_INCLUDE, orderBy: { keyword: "asc" } });
  return toCsv(
    [...CSV_COLUMNS],
    rows.map((k) => [
      k.keyword, k.designation, k.searchVolume, k.volumeBasis, k.volumeSource, k.difficulty, k.difficultyBasis, k.difficultySource,
      k.intent, k.funnelStage, k.track, k.cluster?.name ?? "", k.targetPath, k.targetPageType,
      k.mappings.map((m) => `${m.page.path} (${m.role.toLowerCase()})`).join("; "), k.priority, k.businessRelevance,
      k.competitors.join("; "), k.competitionNotes, k.status, k.dataSource, k.lastVerifiedAt, k.validationStatus, k.notes,
    ]),
  );
}

// ---------------------------------------------------------------------------------------------
// CSV import: preview (nothing saved) then commit (same parsing, valid rows only)

const MAX_IMPORT_ROWS = 2000;

const HEADER_ALIASES: Record<string, string> = {
  keyword: "keyword", keywords: "keyword", "search term": "keyword", query: "keyword",
  designation: "designation", role: "designation",
  searchvolume: "searchVolume", "search volume": "searchVolume", volume: "searchVolume", "monthly search volume": "searchVolume", msv: "searchVolume",
  volumebasis: "volumeBasis", "volume basis": "volumeBasis",
  volumesource: "volumeSource", "volume source": "volumeSource",
  difficulty: "difficulty", "keyword difficulty": "difficulty", kd: "difficulty", "keyword difficulty (0–100)": "difficulty", "keyword difficulty (0-100)": "difficulty",
  difficultybasis: "difficultyBasis", "difficulty basis": "difficultyBasis",
  difficultysource: "difficultySource", "difficulty source": "difficultySource",
  intent: "intent", "search intent": "intent",
  funnelstage: "funnelStage", "funnel stage": "funnelStage", funnel: "funnelStage",
  track: "track", strategy: "track",
  cluster: "cluster", "keyword cluster": "cluster",
  targetpath: "targetPath", "target path": "targetPath", "target url": "targetPath", "primary url": "targetPath", url: "targetPath",
  targetpagetype: "targetPageType", "target page type": "targetPageType", "page type": "targetPageType",
  priority: "priority",
  businessrelevance: "businessRelevance", "business relevance": "businessRelevance",
  competitors: "competitors", "competitor ranking": "competitors", competitor: "competitors",
  competitionnotes: "competitionNotes", "competition notes": "competitionNotes",
  status: "status",
  datasource: "dataSource", "data source": "dataSource", source: "dataSource",
  lastverifiedat: "lastVerifiedAt", "last verified": "lastVerifiedAt", "last verified at": "lastVerifiedAt",
  validationstatus: "validationStatus", "validation status": "validationStatus", validation: "validationStatus",
  notes: "notes",
};

const ENUM_WORDS: Record<string, Record<string, string>> = {
  intent: { informational: "INFORMATIONAL", info: "INFORMATIONAL", commercial: "COMMERCIAL", "commercial investigation": "COMMERCIAL", transactional: "TRANSACTIONAL", navigational: "NAVIGATIONAL" },
  funnelStage: { tofu: "TOFU", mofu: "MOFU", bofu: "BOFU", "top of funnel": "TOFU", "middle of funnel": "MOFU", "bottom of funnel": "BOFU" },
  track: { traffic_acquisition: "TRAFFIC_ACQUISITION", "traffic acquisition": "TRAFFIC_ACQUISITION", traffic: "TRAFFIC_ACQUISITION", booking_conversion: "BOOKING_CONVERSION", "booking conversion": "BOOKING_CONVERSION", booking: "BOOKING_CONVERSION", conversion: "BOOKING_CONVERSION" },
  targetPageType: { home: "HOME", tour: "TOUR", "tour page": "TOUR", destination: "DESTINATION", "location page": "DESTINATION", location: "DESTINATION", landing: "LANDING", "landing page": "LANDING", guide: "GUIDE", blog: "GUIDE", "blog post": "GUIDE", "blog page": "GUIDE", static: "STATIC", legal: "LEGAL" },
  priority: { high: "HIGH", medium: "MEDIUM", low: "LOW" },
  designation: { primary: "PRIMARY", secondary: "SECONDARY" },
  status: { idea: "IDEA", planned: "PLANNED", in_progress: "IN_PROGRESS", "in progress": "IN_PROGRESS", implemented: "IMPLEMENTED", done: "IMPLEMENTED", archived: "ARCHIVED" },
  validationStatus: { unverified: "UNVERIFIED", verified: "VERIFIED", rejected: "REJECTED" },
  volumeBasis: { unknown: "UNKNOWN", estimate: "ESTIMATE", estimated: "ESTIMATE", researched: "RESEARCHED" },
  difficultyBasis: { unknown: "UNKNOWN", estimate: "ESTIMATE", estimated: "ESTIMATE", researched: "RESEARCHED" },
};

const INTENT_FUNNEL: Record<string, string> = { INFORMATIONAL: "TOFU", COMMERCIAL: "MOFU", TRANSACTIONAL: "BOFU", NAVIGATIONAL: "BOFU" };

export interface ImportRowResult {
  line: number;
  keyword: string;
  action: "create" | "update" | "skip" | "error";
  errors: string[];
  notes: string[];
  cluster?: string | null;
}

interface ParsedRow {
  line: number;
  input?: KeywordInput & { clusterName?: string | null };
  result: ImportRowResult;
}

/** Strips the ' a spreadsheet export adds before = + - @. */
const unguard = (v: string) => (/^'[=+\-@]/.test(v) ? v.slice(1) : v).trim();

function parseRows(csv: string, defaults: { track?: string; dataSource?: string }): { header: string[]; rows: ParsedRow[]; unknownColumns: string[] } {
  if (csv.length > 1_000_000) throw new SeoError(413, "The file is larger than 1 MB.");
  let table: string[][];
  try {
    table = parseCsv(csv);
  } catch (e) {
    throw new SeoError(400, (e as Error).message);
  }
  if (table.length < 2) throw new SeoError(400, "The file needs a header row and at least one keyword row.");
  if (table.length - 1 > MAX_IMPORT_ROWS) throw new SeoError(413, `Import up to ${MAX_IMPORT_ROWS} keywords at a time.`);
  const header = table[0].map((h) => h.trim());
  const columns = header.map((h) => HEADER_ALIASES[h.toLowerCase().replace(/\s+/g, " ")] ?? null);
  if (!columns.includes("keyword")) throw new SeoError(400, 'The header row needs a "keyword" column.');
  const unknownColumns = header.filter((_, i) => !columns[i]);

  const rows: ParsedRow[] = table.slice(1).map((cells, idx) => {
    const line = idx + 2;
    const raw: Record<string, string> = {};
    columns.forEach((c, i) => {
      if (c && cells[i] !== undefined) raw[c] = unguard(cells[i]);
    });
    const errors: string[] = [];
    const notes: string[] = [];
    const keyword = (raw.keyword ?? "").replace(/\s+/g, " ").trim();

    const enumValue = (field: string, required: boolean): string | undefined => {
      const v = raw[field];
      if (!v) {
        if (required) errors.push(`${field} is missing.`);
        return undefined;
      }
      if (/[,/+]|\band\b/i.test(v) && field !== "status") {
        errors.push(`${field} "${v}" has more than one value; pick one.`);
        return undefined;
      }
      const mapped = ENUM_WORDS[field]?.[v.toLowerCase().trim()] ?? (Object.values(ENUM_WORDS[field] ?? {}).includes(v.toUpperCase()) ? v.toUpperCase() : undefined);
      if (!mapped) errors.push(`${field} "${v}" isn't recognised.`);
      return mapped;
    };
    const intValue = (field: string, max: number): number | null | undefined => {
      const v = raw[field];
      if (v === undefined || v === "" || /^(n\/?a|unknown|-|—)$/i.test(v)) return null;
      const n = Number(v.replace(/[, ]/g, ""));
      if (!Number.isInteger(n) || n < 0 || n > max) {
        errors.push(`${field} "${v}" isn't a whole number between 0 and ${max}.`);
        return undefined;
      }
      return n;
    };

    const intent = enumValue("intent", true);
    let funnelStage = enumValue("funnelStage", false);
    if (!funnelStage && intent && !raw.funnelStage) {
      funnelStage = INTENT_FUNNEL[intent];
      notes.push(`Funnel stage set to ${funnelStage} from the intent.`);
    }
    let track = enumValue("track", false) ?? defaults.track;
    if (!track) {
      track = intent === "INFORMATIONAL" ? "TRAFFIC_ACQUISITION" : "BOOKING_CONVERSION";
      notes.push(`Track set to ${track === "TRAFFIC_ACQUISITION" ? "traffic acquisition" : "booking conversion"} from the intent.`);
    }
    const searchVolume = intValue("searchVolume", 100_000_000);
    const difficulty = intValue("difficulty", 100);
    let volumeBasis = enumValue("volumeBasis", false);
    let difficultyBasis = enumValue("difficultyBasis", false);
    // Never upgrade an unlabelled figure to "researched": it stays an unverified estimate.
    if (typeof searchVolume === "number" && !volumeBasis) {
      volumeBasis = "ESTIMATE";
      notes.push("Volume has no stated basis, so it is kept as an unverified estimate.");
    }
    if (typeof difficulty === "number" && !difficultyBasis) {
      difficultyBasis = "ESTIMATE";
      notes.push("Difficulty has no stated basis, so it is kept as an unverified estimate.");
    }
    if (searchVolume === null) volumeBasis = "UNKNOWN";
    if (difficulty === null) difficultyBasis = "UNKNOWN";

    let lastVerifiedAt: Date | null = null;
    if (raw.lastVerifiedAt) {
      const d = new Date(raw.lastVerifiedAt);
      if (Number.isNaN(d.getTime())) errors.push(`lastVerifiedAt "${raw.lastVerifiedAt}" isn't a date.`);
      else lastVerifiedAt = d;
    }
    const relevance = intValue("businessRelevance", 5);

    const candidate = {
      keyword,
      designation: enumValue("designation", false),
      searchVolume: searchVolume ?? null,
      volumeBasis,
      volumeSource: raw.volumeSource || null,
      difficulty: difficulty ?? null,
      difficultyBasis,
      difficultySource: raw.difficultySource || null,
      intent,
      funnelStage,
      track,
      targetPath: raw.targetPath || null,
      targetPageType: enumValue("targetPageType", false) ?? null,
      priority: enumValue("priority", false),
      businessRelevance: relevance === 0 ? null : relevance ?? null,
      competitionNotes: raw.competitionNotes || null,
      competitors: raw.competitors ? raw.competitors.split(/[;|]/).map((s) => s.trim()).filter(Boolean) : [],
      status: enumValue("status", false),
      dataSource: raw.dataSource || defaults.dataSource || "CSV import",
      lastVerifiedAt,
      validationStatus: enumValue("validationStatus", false),
      notes: raw.notes || null,
    };
    const result: ImportRowResult = { line, keyword, action: "create", errors, notes, cluster: raw.cluster || null };
    if (errors.length > 0) return { line, result: { ...result, action: "error" } };
    const parsed = keywordCreateSchema.safeParse(Object.fromEntries(Object.entries(candidate).filter(([, v]) => v !== undefined)));
    if (!parsed.success) {
      result.errors.push(...parsed.error.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`));
      return { line, result: { ...result, action: "error" } };
    }
    return { line, input: { ...parsed.data, clusterName: raw.cluster || null }, result };
  });
  return { header, rows, unknownColumns };
}

/** Parses and checks a CSV without saving. mode "skip" leaves existing keywords alone; "update" overwrites them. */
export async function previewImport(csv: string, mode: "skip" | "update", defaults: { track?: string; dataSource?: string } = {}) {
  const { rows, unknownColumns } = parseRows(csv, defaults);
  const normals = rows.map((r) => (r.input ? normalizeKeyword(r.input.keyword) : null));
  const existing = new Map(
    (await prisma.seoKeyword.findMany({ where: { normalized: { in: normals.filter((n): n is string => !!n) } }, select: { normalized: true, keyword: true } })).map((k) => [k.normalized, k]),
  );
  const clusterNames = new Set((await prisma.seoKeywordCluster.findMany({ select: { name: true } })).map((c) => c.name.toLowerCase()));
  const seen = new Map<string, number>();
  const newClusters = new Set<string>();
  rows.forEach((r, i) => {
    const n = normals[i];
    if (!r.input || !n) return;
    if (seen.has(n)) {
      r.result.action = "skip";
      r.result.notes.push(`Duplicate of line ${seen.get(n)} in this file.`);
      return;
    }
    seen.set(n, r.line);
    if (existing.has(n)) {
      r.result.action = mode === "update" ? "update" : "skip";
      r.result.notes.push(mode === "update" ? "Already in the list; will be updated." : "Already in the list; skipped.");
    }
    if (r.input.clusterName && !clusterNames.has(r.input.clusterName.toLowerCase())) newClusters.add(r.input.clusterName);
  });
  const results = rows.map((r) => r.result);
  return {
    rows: results,
    unknownColumns,
    newClusters: [...newClusters],
    counts: {
      create: results.filter((r) => r.action === "create").length,
      update: results.filter((r) => r.action === "update").length,
      skip: results.filter((r) => r.action === "skip").length,
      error: results.filter((r) => r.action === "error").length,
    },
    parsed: rows,
  };
}

/** Saves the valid rows of a previewed CSV in one transaction. Rows with errors are never saved. */
export async function commitImport(csv: string, mode: "skip" | "update", userId: string, defaults: { track?: string; dataSource?: string } = {}) {
  const preview = await previewImport(csv, mode, defaults);
  const toSave = preview.parsed.filter((r) => r.input && (r.result.action === "create" || r.result.action === "update"));
  await prisma.$transaction(
    async (tx) => {
      const clusterIds = new Map((await tx.seoKeywordCluster.findMany({ select: { id: true, name: true } })).map((c) => [c.name.toLowerCase(), c.id]));
      for (const name of preview.newClusters) {
        const first = toSave.find((r) => r.input?.clusterName?.toLowerCase() === name.toLowerCase());
        const c = await tx.seoKeywordCluster.create({ data: { name, track: first?.input?.track ?? "TRAFFIC_ACQUISITION" } });
        clusterIds.set(name.toLowerCase(), c.id);
      }
      for (const r of toSave) {
        const { clusterName, ...input } = r.input!;
        const data = { ...keywordData(input), clusterId: clusterName ? clusterIds.get(clusterName.toLowerCase()) ?? null : undefined };
        if (r.result.action === "update") {
          await tx.seoKeyword.update({ where: { normalized: normalizeKeyword(input.keyword) }, data: data as Prisma.SeoKeywordUncheckedUpdateInput });
        } else {
          await tx.seoKeyword.create({ data: { ...(data as Prisma.SeoKeywordUncheckedCreateInput), createdById: userId } });
        }
      }
      await tx.auditLog.create({
        data: { userId, action: "SEO_KEYWORDS_IMPORTED", entityType: "SeoKeyword", entityId: "import", details: { ...preview.counts, newClusters: preview.newClusters } },
      });
    },
    { timeout: 60_000 },
  );
  const { parsed: _parsed, ...summary } = preview;
  return summary;
}
