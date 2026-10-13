import { BACKEND_URL } from "@/lib/api/server";
import { siteOrigin } from "@/lib/seo/server";

// /llms.txt: a plain summary of the site for AI assistants, edited under Admin → SEO → llms.txt.
// 404 while it is switched off there.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/seo/public/llms.txt?origin=${encodeURIComponent(siteOrigin())}`, {
      next: { revalidate: 60, tags: ["seo"] },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) return new Response("Not found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    if (!res.ok) throw new Error(String(res.status));
    return new Response(await res.text(), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return new Response("Temporarily unavailable\n", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "60" } });
  }
}
