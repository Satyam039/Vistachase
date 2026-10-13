import type { FieldCheck } from "@/modules/seo/seo.validation";

/** A refusal the SEO API returns as-is: status code, plain-words message, optional field checks. */
export class SeoError extends Error {
  constructor(public status: number, message: string, public checks?: FieldCheck[]) {
    super(message);
  }
}
