import { getEmailProvider, EmailPayload } from "./email.provider";

/**
 * N3: Send through job queue with retries
 * A lightweight retry wrapper for sending emails to handle intermittent API failures.
 */
export async function sendEmailWithRetry(payload: EmailPayload, retries = 3): Promise<void> {
  const provider = getEmailProvider();
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await provider.sendEmail(payload);
      if (result.success) return; // Success!
      
      console.warn(`[Email Retry] Attempt ${attempt} failed: ${result.error}`);
    } catch (e: any) {
      console.warn(`[Email Retry] Attempt ${attempt} error: ${e.message}`);
    }

    if (attempt < retries) {
      // Exponential backoff
      await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 1000));
    }
  }

  console.error(`[Email Retry] Failed to send email to ${payload.to} after ${retries} attempts.`);
}
