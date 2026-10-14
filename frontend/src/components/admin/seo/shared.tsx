"use client";

// Shared pieces of the admin SEO dashboard (/admin/seo): the API helper, panel and table frames,
// form styles and labels. Every call goes through /api/seo/admin/*, which is admin-only and
// audited there. Figures shown are Vista Chase's own data; nothing here invents search metrics.

import type { ReactNode } from "react";

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type PublishStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
export type PageType = "HOME" | "TOUR" | "DESTINATION" | "LANDING" | "GUIDE" | "STATIC" | "LEGAL";
export type Track = "TRAFFIC_ACQUISITION" | "BOOKING_CONVERSION";
export type MetricBasis = "UNKNOWN" | "ESTIMATE" | "RESEARCHED";

export interface FieldCheck {
  field: string;
  level: "error" | "warning" | "info";
  message: string;
}

export interface PageRow {
  id: string;
  path: string;
  label: string;
  pageType: PageType;
  source: "STATIC_ROUTE" | "TOUR" | "DESTINATION" | "CMS";
  status: PublishStatus;
  publishAt: string | null;
  important: boolean;
  robotsIndex: boolean;
  focusKeyword: string | null;
  primaryKeywords: string[];
  title: string | null;
  titleFromOverride: boolean;
  description: string | null;
  descriptionFromOverride: boolean;
  liveStatus: number | null;
  lastCrawledAt: string | null;
  completeness: number;
  warnings: number;
  errors: number;
  keywordCount: number;
  openIssues: number;
  updatedAt: string;
}

export interface Cluster {
  id: string;
  name: string;
  pillar: string | null;
  track: Track;
  description: string | null;
  hubPath: string | null;
  keywords: number;
  mapped: number;
  highPriority: number;
}

export type ResearchStatus = "UNVERIFIED" | "RESEARCHED" | "VALIDATED" | "MAPPED" | "IMPLEMENTED" | "MONITORED";

export interface Keyword {
  id: string;
  ref: number;
  /** KW-0001 */
  code: string;
  keyword: string;
  designation: "PRIMARY" | "SECONDARY";
  searchVolume: number | null;
  volumeBasis: MetricBasis;
  volumeSource: string | null;
  difficulty: number | null;
  difficultyBasis: MetricBasis;
  difficultySource: string | null;
  intent: "INFORMATIONAL" | "COMMERCIAL" | "TRANSACTIONAL" | "NAVIGATIONAL";
  funnelStage: "TOFU" | "MOFU" | "BOFU";
  track: Track;
  cluster: { id: string; name: string } | null;
  targetPath: string | null;
  targetPageType: PageType | null;
  priority: "HIGH" | "MEDIUM" | "LOW";
  businessRelevance: number | null;
  competitionNotes: string | null;
  competitors: string[];
  status: "IDEA" | "PLANNED" | "IN_PROGRESS" | "IMPLEMENTED" | "ARCHIVED";
  dataSource: string | null;
  lastVerifiedAt: string | null;
  validationStatus: "UNVERIFIED" | "VERIFIED" | "REJECTED";
  researchStatus: ResearchStatus;
  parentTopic: string | null;
  market: string;
  language: string;
  bookingIntent: number | null;
  competitorEvidence: string | null;
  contentGap: string | null;
  recommendedAction: string | null;
  notes: string | null;
  archivedAt: string | null;
  mappings: { id: string; role: "PRIMARY" | "SECONDARY"; page: { id: string; path: string; label: string; pageType: PageType } }[];
  flags: { unmapped: boolean; plannedOnly: boolean; cannibalised: boolean; intentMismatch: string | null };
  updatedAt: string;
}

export interface Issue {
  id: string;
  type: string;
  severity: Severity;
  status: "OPEN" | "IGNORED" | "RESOLVED";
  path: string | null;
  pageId: string | null;
  message: string;
  detail: unknown;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  page: { label: string; important: boolean } | null;
}

export interface AuditRun {
  id: string;
  trigger: "MANUAL" | "SCHEDULED";
  status: "RUNNING" | "COMPLETED" | "FAILED";
  baseUrl: string | null;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  summary: Partial<{
    pagesChecked: number;
    pagesReachable: number;
    crawled: boolean;
    crawlNote: string | null;
    linksChecked: number;
    brokenLinks: number;
    issues: number;
    bySeverity: Record<Severity, number>;
    resolved: number;
  }>;
}

export async function seoApi<T = Record<string, unknown>>(path: string, method = "GET", body?: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string; fields?: Record<string, string[]>; checks?: FieldCheck[] } }> {
  try {
    const res = await fetch(`/api/seo/admin${path}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Network error. Please try again." } as never };
  }
}

/** First field error, else the server's message, else the fallback. */
export const errorOf = (data: { error?: string; fields?: Record<string, string[]> }, fallback: string) => {
  const first = data.fields ? Object.entries(data.fields).find(([, v]) => v?.length) : undefined;
  return first ? `${first[0]}: ${first[1][0]}` : typeof data.error === "string" ? data.error : fallback;
};

export const words = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
export const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "–");
export const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Edmonton" }) : "–";

export const field =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-obsidian-900 focus:border-ocean-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600";
export const primaryBtn = "inline-flex h-11 items-center gap-2 rounded-full bg-ocean-600 px-5 text-sm text-white hover:bg-ocean-700 disabled:opacity-60";
export const quietBtn = "inline-flex h-10 items-center gap-2 rounded-full border border-obsidian-900/10 bg-white px-4 text-sm text-obsidian-900 hover:bg-obsidian-50 disabled:opacity-60";
export const dangerBtn = "inline-flex h-10 items-center gap-2 rounded-full border border-red-200 bg-white px-4 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60";
export const labelCls = "mb-1.5 block text-sm text-slate-700";

export const SEVERITY_STYLE: Record<Severity, string> = {
  CRITICAL: "bg-red-50 text-red-800",
  HIGH: "bg-summit-100 text-obsidian-900",
  MEDIUM: "bg-ocean-50 text-ocean-800",
  LOW: "bg-obsidian-100 text-slate-700",
};

export const STATUS_STYLE: Record<PublishStatus, string> = {
  PUBLISHED: "bg-ocean-50 text-ocean-800",
  DRAFT: "bg-obsidian-100 text-slate-700",
  SCHEDULED: "bg-summit-100 text-obsidian-900",
  ARCHIVED: "bg-red-50 text-red-800",
};

export const TRACK_LABEL: Record<Track, string> = {
  TRAFFIC_ACQUISITION: "Traffic acquisition",
  BOOKING_CONVERSION: "Booking conversion",
};

export function Chip({ className = "", children }: { className?: string; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-sm ${className}`}>{children}</span>;
}

export function Panel({ id, title, description, actions, children }: { id: string; title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-obsidian-900/[0.07]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-obsidian-900/[0.06] px-6 py-5">
        <div>
          <h2 id={`${id}-heading`} className="text-xl text-obsidian-900">
            {title}
          </h2>
          {description && <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Grid({ label, head, minWidth = "min-w-[46rem]", children }: { label: string; head: [string, boolean?][]; minWidth?: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ocean-600" tabIndex={0} role="region" aria-label={label}>
      <table className={`w-full ${minWidth} text-left text-base`}>
        <thead className="bg-obsidian-50/70 text-sm text-slate-600">
          <tr>
            {head.map(([h, right], i) => (
              <th key={`${h}-${i}`} scope="col" className={`px-6 py-3 font-normal ${right ? "text-right" : ""}`}>
                {h || <span className="sr-only">Action</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-obsidian-900/[0.06]">{children}</tbody>
      </table>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-6 py-12 text-center text-base text-slate-600">{children}</p>;
}

export function Loading() {
  return (
    <ul className="divide-y divide-obsidian-900/[0.06]" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="px-6 py-5">
          <span className="block h-5 w-1/3 rounded bg-obsidian-100 motion-safe:animate-pulse" />
        </li>
      ))}
    </ul>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "warn" | "bad" | "good" }) {
  const toneCls = tone === "bad" ? "text-red-700" : tone === "warn" ? "text-obsidian-900" : tone === "good" ? "text-ocean-700" : "text-obsidian-900";
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-obsidian-900/[0.07]">
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-1 text-3xl font-light tabular-nums ${toneCls}`}>{value}</p>
      {hint && <p className="mt-1 text-sm text-slate-600">{hint}</p>}
    </div>
  );
}

/** Lists editor checks: errors block publishing, warnings and notes are advice. */
export function CheckList({ checks }: { checks: FieldCheck[] }) {
  if (checks.length === 0) return <p className="text-sm text-ocean-700">No problems found.</p>;
  const tone = { error: "bg-red-50 text-red-800", warning: "bg-summit-100 text-obsidian-900", info: "bg-obsidian-100 text-slate-700" } as const;
  return (
    <ul className="space-y-2">
      {checks.map((c, i) => (
        <li key={`${c.field}-${i}`} className="flex items-start gap-3 text-sm">
          <Chip className={tone[c.level]}>{c.level === "error" ? "Blocks publishing" : c.level === "warning" ? "Warning" : "Note"}</Chip>
          <span className="pt-1 text-slate-700">{c.message}</span>
        </li>
      ))}
    </ul>
  );
}

/** A metric with its basis: "–" when unknown, otherwise the value marked estimate or researched. */
export function Metric({ value, basis, source }: { value: number | null; basis: MetricBasis; source: string | null }) {
  if (value === null || basis === "UNKNOWN") return <span className="text-slate-500">–</span>;
  return (
    <span title={source ?? undefined}>
      {value.toLocaleString("en-CA")}
      <span className="ml-1 text-sm text-slate-600">{basis === "ESTIMATE" ? "est." : "researched"}</span>
    </span>
  );
}
