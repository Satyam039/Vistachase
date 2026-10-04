import { Router } from "express";
import { findMedia } from "@/modules/media/media.repository";

const router = Router();

// Media library: /api/media?collection=photos&place=moraine-lake&tag=winter&kind=landscape
router.get("/", (req, res) => {
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const assets = findMedia({
    collection: str(req.query.collection),
    place: str(req.query.place),
    tag: str(req.query.tag),
    kind: str(req.query.kind),
  });
  return res.json({ success: true, count: assets.length, assets });
});

export default router;
