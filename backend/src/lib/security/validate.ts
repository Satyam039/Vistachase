// Request validation with zod. Routes parse their body or query through a schema and reply 400
// with the first problem in plain words; handlers only ever see validated, typed input.

import type { Response } from "express";
import { z } from "zod";

export { z };

/** Parses `input`; on failure sends 400 and returns null. */
export function parseOr400<T extends z.ZodTypeAny>(schema: T, input: unknown, res: Response): z.infer<T> | null {
  const result = schema.safeParse(input ?? {});
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue?.path.join(".");
  res.status(400).json({ success: false, error: field ? `${field}: ${issue.message}` : issue?.message ?? "Invalid request" });
  return null;
}

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const referenceSchema = z.string().trim().regex(/^VC-[A-Z0-9-]{4,24}$/i, "Not a booking reference").max(32);
