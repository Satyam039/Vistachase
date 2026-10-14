// Content API (Admin → Content): tour and destination copy. Reads: ADMIN, SEO_MANAGER, EDITOR,
// VIEWER. Writes: ADMIN, SEO_MANAGER, EDITOR. Prices, capacity, booking mode and slugs are not
// editable here (modules/content/content.ts). Every write is validated and audited.

import { Router, type NextFunction, type Request, type Response } from "express";
import { getAuthenticatedStaff } from "@/lib/auth/admin-guard";
import { can, capabilities, CONTENT_READ, CONTENT_WRITE } from "@/lib/auth/permissions";
import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import { z } from "@/lib/security/validate";
import {
  ContentError,
  destinationContentSchema,
  getDestinationContent,
  getTourContent,
  listContent,
  saveDestinationContent,
  saveSchema,
  saveTourContent,
  tourContentSchema,
} from "@/modules/content/content";

const router = Router();

router.use(async (req, res, next) => {
  const staff = await getAuthenticatedStaff(req, CONTENT_READ).catch(() => null);
  if (!staff) return res.status(req.cookies?.vc_token || req.headers.authorization ? 403 : 401).json({ success: false, error: "Sign in with a content, SEO or admin account." });
  if (req.method !== "GET" && req.method !== "HEAD" && !can(staff.role, CONTENT_WRITE)) {
    return res.status(403).json({ success: false, error: "Your role can view this but not change it." });
  }
  res.locals.staff = staff;
  res.setHeader("Cache-Control", "no-store");
  next();
});

type Handler = (req: Request, res: Response) => Promise<unknown>;
const wrap = (fn: Handler) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof ContentError) return res.status(error.status).json({ success: false, error: error.message });
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return res.status(400).json({ success: false, error: issue ? `${issue.path.filter((p) => p !== "fields").join(".") || "request"}: ${issue.message}` : "Invalid request." });
    }
    next(error);
  }
};

const id = (req: Request) => {
  const value = String(req.params.id ?? "");
  if (!/^[a-z0-9]{10,40}$/i.test(value)) throw new ContentError(404, "Not found.");
  return value;
};

const writeLimit = rateLimitMiddleware("content_write", { maxRequests: 120, windowSeconds: 600 });

router.get("/me", (_req, res) => res.json({ success: true, name: res.locals.staff.name, ...capabilities(res.locals.staff.role) }));

router.get("/", wrap(async (_req, res) => res.json({ success: true, ...(await listContent()) })));

router.get("/tours/:id", wrap(async (req, res) => {
  const result = await getTourContent(id(req));
  if (!result) throw new ContentError(404, "Tour not found.");
  return res.json({ success: true, ...result });
}));

router.patch("/tours/:id", writeLimit, wrap(async (req, res) => {
  const input = saveSchema(tourContentSchema).parse(req.body ?? {});
  return res.json({ success: true, ...(await saveTourContent(id(req), input.fields, res.locals.staff.userId, input.expectedUpdatedAt)) });
}));

router.get("/destinations/:id", wrap(async (req, res) => {
  const result = await getDestinationContent(id(req));
  if (!result) throw new ContentError(404, "Destination not found.");
  return res.json({ success: true, ...result });
}));

router.patch("/destinations/:id", writeLimit, wrap(async (req, res) => {
  const input = saveSchema(destinationContentSchema).parse(req.body ?? {});
  return res.json({ success: true, ...(await saveDestinationContent(id(req), input.fields, res.locals.staff.userId, input.expectedUpdatedAt)) });
}));

export default router;
