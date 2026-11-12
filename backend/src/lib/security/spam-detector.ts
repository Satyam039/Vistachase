import dns from "node:dns";

/**
 * Anti-Spam & Bot Detection Filter for Enquiries and Public Forms.
 * Protects staff inboxes from high-volume automated bot spam and delivery bounces.
 */

export interface EnquirySpamPayload {
  name: string;
  email: string;
  phone?: string;
  date?: string;
  toDate?: string;
  guests?: number;
  message: string;
  website?: string; // honeypot
}

export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "guerrillamail.com",
  "sharklasers.com",
  "throwawaymail.com",
  "getairmail.com",
  "dispostable.com",
  "trashmail.com",
  "inboxkitten.com",
  "burnermail.io",
]);

/**
 * Checks whether an individual token matches synthetic high-entropy bot patterns.
 */
function isSingleTokenSynthetic(token: string): boolean {
  const clean = token.replace(/[^A-Za-z]/g, "");
  if (clean.length < 5) return false;

  // 4 or more consecutive consonants (e.g. qmth, glZrg, QCfXTR, gsXjS, etc.)
  if (/[bcdfghjklmnpqrstvwxyz]{4,}/i.test(clean)) return true;

  // Two or more consecutive uppercase letters appearing after lowercase (e.g. NuLBPir, qmthDEIps, AXaFtFE)
  if (/[a-z][A-Z]{2,}/.test(clean)) return true;

  // Starts with lowercase followed by uppercase in tokens >= 6 chars (e.g. cHXw...)
  if (/^[a-z][A-Z]/.test(clean) && clean.length >= 6) return true;

  // 2 or more switches between lowercase and uppercase in tokens >= 6 chars
  const switches = clean.match(/[a-z][A-Z]/g)?.length ?? 0;
  if (switches >= 2 && clean.length >= 6) return true;

  // Multiple uppercase letters scattered in non-initial positions
  const upperCount = (clean.match(/[A-Z]/g) || []).length;
  const lowerCount = (clean.match(/[a-z]/g) || []).length;
  if (upperCount >= 2 && lowerCount >= 2 && clean.length >= 6) {
    let transitions = 0;
    for (let i = 1; i < clean.length; i++) {
      const prevLower = /[a-z]/.test(clean[i - 1]);
      const currUpper = /[A-Z]/.test(clean[i]);
      if (prevLower && currUpper) transitions++;
    }
    if (transitions >= 2) return true;
  }

  // Extreme consonant ratio in a token >= 6 chars (< 18% vowels, e.g. 5+ consonants and 0-1 vowel)
  const vowels = (clean.match(/[aeiouy]/gi) || []).length;
  if (clean.length >= 6 && vowels / clean.length < 0.18) return true;

  return false;
}

/**
 * Checks whether a name string matches synthetic high-entropy bot patterns.
 * Examples from attack log: glZrgkquEiQCfXTR, AXaFtFE, qmthDEI, OviLdqz, gsXjSYT, NuLBPir.
 */
export function isSyntheticBotName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;

  // Check the whole trimmed string if it has no spaces
  if (!trimmed.includes(" ")) {
    if (isSingleTokenSynthetic(trimmed)) return true;
  }

  // Check each whitespace/delimiter separated token
  const tokens = trimmed.split(/[\s_]+/);
  for (const token of tokens) {
    if (isSingleTokenSynthetic(token)) return true;
  }

  return false;
}

/**
 * Checks whether an email address exhibits bot generation patterns or disposable domains.
 */
export function isSuspiciousEmail(email?: string): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return true;

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;

  // Dot-spam pattern (e.g. s.i.lb.iase@gmail.com)
  const dotSegments = local.split(".");
  if (dotSegments.length >= 4 && dotSegments.filter((s) => s.length <= 2).length >= 3) {
    return true;
  }

  // Synthetic local-part matching bot patterns
  if (isSingleTokenSynthetic(local)) return true;

  return false;
}

/**
 * Verifies that the recipient domain has active MX records before sending verification emails.
 */
export async function hasValidMxRecords(domain: string): Promise<boolean> {
  if (process.env.NODE_ENV === "test") {
    if (domain.includes("nonexistent") || domain.includes("fake") || domain === "invalid") return false;
    return true;
  }
  try {
    const records = await dns.promises.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "EREFUSED") {
      return false;
    }
    return true;
  }
}

/**
 * Checks whether travel dates are absurd or malicious (e.g. Unix epoch 1970-05-31).
 */
export function isInvalidTripDate(dateStr?: string): boolean {
  if (!dateStr || !dateStr.trim()) return false;
  const match = dateStr.trim().match(/^(\d{4})-\d{2}-\d{2}$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  // Legitimate Rockies trip enquiries fall within current and upcoming seasons (2025–2035)
  if (year < 2025 || year > 2035) {
    return true;
  }
  return false;
}

/**
 * Checks whether message body is spam / bot payload (e.g. pure numeric phone dump like "4154416877").
 */
export function isSpamMessage(message: string): boolean {
  const trimmed = message.trim();
  // Pure digits of 6+ numbers with no actual inquiry words
  if (/^\+?\d{6,}$/.test(trimmed.replace(/[\s-]/g, ""))) {
    return true;
  }
  // Repeated random punctuation
  if (/^[^\w\s]{4,}$/.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Evaluates whether an incoming enquiry is automated bot spam.
 */
export function isSpamBotEnquiry(payload: EnquirySpamPayload): boolean {
  // 1. Honeypot check
  if (payload.website && payload.website.trim().length > 0) {
    return true;
  }

  // 2. Absurd travel dates (e.g., 1970 epoch date seen in spam logs)
  if (isInvalidTripDate(payload.date) || isInvalidTripDate(payload.toDate)) {
    return true;
  }

  // 3. Synthetic name generator detection
  if (isSyntheticBotName(payload.name)) {
    return true;
  }

  // 4. Pure numeric message body
  if (isSpamMessage(payload.message)) {
    return true;
  }

  // 5. Unrealistic guest count combined with no context or minimal message
  if (payload.guests && payload.guests > 35 && payload.message.trim().length < 30) {
    return true;
  }

  // 6. Suspicious email address patterns
  if (isSuspiciousEmail(payload.email)) {
    return true;
  }

  return false;
}
