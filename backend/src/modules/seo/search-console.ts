// Google Search Console / analytics: integration point only. No provider is built yet, so the
// dashboard always reports "not connected" and SeoSearchMetric stays empty. A provider added later
// implements SearchMetricsProvider, writes rows with source = its id, and nothing else changes.
// Never put estimated keyword figures in SeoSearchMetric: it is for data a provider returned.

import prisma from "@/lib/db/prisma";

export interface SearchMetricRow {
  path: string;
  date: Date;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  query?: string | null;
}

export interface SearchMetricsProvider {
  readonly id: string; // stored as SeoSearchMetric.source
  /** Rows for a date range, from the provider's own API with credentials it holds server-side. */
  fetchRange(from: Date, to: Date): Promise<SearchMetricRow[]>;
}

export interface IntegrationStatus {
  id: string;
  name: string;
  connected: boolean;
  configured: boolean;
  message: string;
  lastDataAt: string | null;
}

/** What the dashboard shows. Configured credentials alone don't count as connected. */
export async function integrationStatus(): Promise<IntegrationStatus[]> {
  const latest = await prisma.seoSearchMetric.findFirst({ where: { source: "google-search-console" }, orderBy: { date: "desc" }, select: { date: true } });
  const gscConfigured = !!(process.env.GSC_SITE_URL && process.env.GSC_SERVICE_ACCOUNT_JSON);
  const gaConfigured = !!process.env.GA4_PROPERTY_ID;
  return [
    {
      id: "google-search-console",
      name: "Google Search Console",
      connected: false,
      configured: gscConfigured,
      message: gscConfigured
        ? "Credentials are set, but the sync isn't built yet, so no search data is shown."
        : "Not connected. Rankings, clicks and impressions appear here only after Search Console is connected (docs/SEO.md).",
      lastDataAt: latest?.date.toISOString().slice(0, 10) ?? null,
    },
    {
      id: "google-analytics",
      name: "Google Analytics 4",
      connected: false,
      configured: gaConfigured,
      message: gaConfigured ? "Property ID is set, but the reporting sync isn't built yet." : "Not connected.",
      lastDataAt: null,
    },
  ];
}
