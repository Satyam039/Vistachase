import fs from "fs";
import path from "path";
import { BACKEND_URL } from "@/lib/api/server";
import { siteOrigin } from "@/lib/seo/server";

// /llms.txt: a plain summary of the site for AI assistants, edited under Admin → SEO → llms.txt.
// When enabled in the admin/SEO portal, serves the dynamic content.
// Otherwise falls back to the static public/llms.txt specification.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/seo/public/llms.txt?origin=${encodeURIComponent(siteOrigin())}`, {
      next: { revalidate: 60, tags: ["seo"] },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      return new Response(await res.text(), {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
      });
    }
  } catch {
    // Backend offline or slow: fall through to static public/llms.txt
  }

  // Fallback to static public/llms.txt
  try {
    const fallbackPath = path.join(process.cwd(), "public", "llms.txt");
    if (fs.existsSync(fallbackPath)) {
      const content = fs.readFileSync(fallbackPath, "utf-8");
      return new Response(content, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
      });
    }
  } catch {
    // Ignore static read failure
  }

  return new Response("Temporarily unavailable\n", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "60" } });
}
