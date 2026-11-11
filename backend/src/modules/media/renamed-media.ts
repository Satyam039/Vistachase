// Site images that were renamed (old /media path -> new /media path). The old addresses answer a
// 301 to the new file, so links already shared or indexed by image search keep working.
// Blog images named after their post instead of "ChatGPT Image <date>": fix recheck, 10 Nov 2026, N10.
// apply-seo-fixes.ts rewrites the old paths saved in blog posts on every deploy.

import type { NextFunction, Request, Response } from "express";
import blogImageRenames from "../../../prisma/catalog/blog-image-renames-2026-11.json";

export const RENAMED_MEDIA: Record<string, string> = { ...blogImageRenames };

/** Mounted on /media before the static files: 301 from a renamed file's old address. */
export function renamedMediaRedirect(req: Request, res: Response, next: NextFunction) {
  const to = RENAMED_MEDIA[`/media${req.path}`];
  if (!to || (req.method !== "GET" && req.method !== "HEAD")) return next();
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.redirect(301, to);
}
