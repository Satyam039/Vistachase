// Webflow Data API v2, read-only: blog posts (CMS items) and per-page SEO settings, for the
// migration import. The token lives only in the server environment (WEBFLOW_API_TOKEN, a site
// token with CMS:read and Pages:read); it is never stored in the database or sent to the browser.
//
// What the API can't give: Site settings → Custom code (head/footer scripts), 301 redirects,
// robots.txt, llms.txt and the site verification field. Those come in by CSV / paste instead.

import { SeoError } from "@/modules/seo/seo.errors";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
const API = "https://api.webflow.com/v2";

export function webflowStatus() {
  return {
    configured: Boolean(process.env.WEBFLOW_API_TOKEN),
    siteId: process.env.WEBFLOW_SITE_ID ?? null,
    blogCollectionId: process.env.WEBFLOW_BLOG_COLLECTION_ID ?? null,
    note: "Reads blog posts and page SEO settings. Custom code, 301 redirects, robots.txt and llms.txt aren't available through the Webflow API: export or copy them from Webflow and use the upload options.",
  };
}

export class WebflowClient {
  constructor(
    private token: string,
    private fetchImpl: FetchLike = (url, init) => fetch(url, init),
  ) {}

  static fromEnv(fetchImpl?: FetchLike) {
    const token = process.env.WEBFLOW_API_TOKEN;
    if (!token) throw new SeoError(400, "Webflow isn't connected: set WEBFLOW_API_TOKEN in the server environment, or upload the CSV export instead.");
    return new WebflowClient(token, fetchImpl);
  }

  private async get<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${API}${path}`, { headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    } catch (error) {
      throw new SeoError(502, `Couldn't reach the Webflow API (${(error as Error).message}).`);
    }
    if (res.status === 401 || res.status === 403) throw new SeoError(502, "Webflow refused the token. Check that WEBFLOW_API_TOKEN is a site token with CMS and Pages read access.");
    if (res.status === 429) throw new SeoError(503, "Webflow's rate limit was reached. Try again in a minute.");
    if (!res.ok) throw new SeoError(502, `The Webflow API answered ${res.status}.`);
    return (await res.json()) as T;
  }

  async siteId(): Promise<string> {
    if (process.env.WEBFLOW_SITE_ID) return process.env.WEBFLOW_SITE_ID;
    const { sites } = await this.get<{ sites: { id: string; displayName?: string; customDomains?: { url?: string }[] }[] }>("/sites");
    const site = sites.find((s) => s.customDomains?.some((d) => /vistachase\.com$/i.test(d.url ?? ""))) ?? (sites.length === 1 ? sites[0] : null);
    if (!site) throw new SeoError(400, `The token sees ${sites.length} sites; set WEBFLOW_SITE_ID to the Vista Chase site.`);
    return site.id;
  }

  async blogCollection(siteId: string) {
    const { collections } = await this.get<{ collections: { id: string; displayName: string; slug: string }[] }>(`/sites/${siteId}/collections`);
    const wanted = process.env.WEBFLOW_BLOG_COLLECTION_ID;
    const collection = wanted ? collections.find((c) => c.id === wanted) : collections.find((c) => /blog/i.test(c.slug) || /blog/i.test(c.displayName));
    if (!collection) throw new SeoError(404, `No blog collection found (${collections.map((c) => c.displayName).join(", ") || "none"}). Set WEBFLOW_BLOG_COLLECTION_ID.`);
    return collection;
  }

  /** Every item, live (published) versions and staged (to find drafts), 100 at a time. */
  async items(collectionId: string, which: "live" | "staged") {
    const out: WebflowItem[] = [];
    for (let offset = 0; offset < 2000; offset += 100) {
      const page = await this.get<{ items: WebflowItem[]; pagination?: { total: number } }>(`/collections/${collectionId}/items${which === "live" ? "/live" : ""}?offset=${offset}&limit=100`);
      out.push(...page.items);
      if (page.items.length < 100 || out.length >= (page.pagination?.total ?? Infinity)) break;
      await new Promise((r) => setTimeout(r, 300)); // well under Webflow's 60 requests a minute
    }
    return out;
  }

  async pages(siteId: string) {
    const out: WebflowPage[] = [];
    for (let offset = 0; offset < 1000; offset += 100) {
      const page = await this.get<{ pages: WebflowPage[]; pagination?: { total: number } }>(`/sites/${siteId}/pages?offset=${offset}&limit=100`);
      out.push(...page.pages);
      if (page.pages.length < 100 || out.length >= (page.pagination?.total ?? Infinity)) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    return out;
  }
}

export interface WebflowItem {
  id: string;
  isDraft?: boolean;
  isArchived?: boolean;
  createdOn?: string;
  lastUpdated?: string;
  lastPublished?: string | null;
  fieldData: Record<string, unknown>;
}

export interface WebflowPage {
  id: string;
  title?: string;
  slug?: string;
  publishedPath?: string;
  collectionId?: string | null;
  draft?: boolean;
  archived?: boolean;
  seo?: { title?: string | null; description?: string | null };
  openGraph?: { title?: string | null; titleCopied?: boolean; description?: string | null; descriptionCopied?: boolean };
}

/** Fetches the blog collection: published versions, plus which items are drafts or have unpublished changes. */
export async function fetchWebflowBlog(fetchImpl?: FetchLike) {
  const client = WebflowClient.fromEnv(fetchImpl);
  const siteId = await client.siteId();
  const collection = await client.blogCollection(siteId);
  const [live, staged] = await Promise.all([client.items(collection.id, "live"), client.items(collection.id, "staged")]);
  const liveIds = new Set(live.map((i) => i.id));
  const changesInDraft = new Set(staged.filter((s) => liveIds.has(s.id) && s.lastUpdated && s.lastPublished && s.lastUpdated > s.lastPublished).map((s) => s.id));
  const unpublished = staged.filter((s) => !liveIds.has(s.id));
  return { siteId, collection, live, unpublished, changesInDraft };
}

export async function fetchWebflowPages(fetchImpl?: FetchLike) {
  const client = WebflowClient.fromEnv(fetchImpl);
  const siteId = await client.siteId();
  return { siteId, pages: await client.pages(siteId) };
}
