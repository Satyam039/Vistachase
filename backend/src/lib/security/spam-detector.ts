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

/**
 * Checks whether a name string matches synthetic high-entropy bot patterns.
 * Examples from attack log: glZrgkquEiQCfXTR, AXaFtFE, qmthDEI, OviLdqz, gsXjSYT, NuLBPir.
 */
export function isSyntheticBotName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;

  // Real names usually have spaces or reasonable length.
  // Synthetic bot names are single strings (no spaces) of 6+ chars with unusual casing or consonant clusters.
  if (!trimmed.includes(" ") && trimmed.length >= 6) {
    // 4 or more consecutive consonants (e.g. qmth, glZrg, QCfXTR, gsXjS)
    if (/[bcdfghjklmnpqrstvwxyz]{4,}/i.test(trimmed)) {
      return true;
    }

    // Two or more consecutive uppercase letters appearing after lowercase (e.g. NuLBPir, qmthDEIps)
    if (/[a-z][A-Z]{2,}/.test(trimmed)) {
      return true;
    }

    // Multiple uppercase letters scattered in non-initial positions (e.g. glZrgkquEiQCfXTR, AXaFtFE)
    const upperCount = (trimmed.match(/[A-Z]/g) || []).length;
    const lowerCount = (trimmed.match(/[a-z]/g) || []).length;
    if (upperCount >= 2 && lowerCount >= 2) {
      let transitions = 0;
      for (let i = 1; i < trimmed.length; i++) {
        const prevLower = /[a-z]/.test(trimmed[i - 1]);
        const currUpper = /[A-Z]/.test(trimmed[i]);
        if (prevLower && currUpper) transitions++;
      }
      if (transitions >= 2) return true;
    }
  }

  return false;
}

/**
 * Checks whether travel dates are absurd or malicious (e.g. Unix epoch 1970-05-31).
 */
export function isInvalidTripDate(dateStr?: string): boolean {
  if (!dateStr || !dateStr.trim()) return false;
  const match = dateStr.trim().match(/^(\d{4})-\d{2}-\d{2}$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  // Legitimate Rockies trip enquiries fall within current and upcoming seasons (2025–2032)
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

  return false;
}
