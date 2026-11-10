/**
 * Where the website's staff emails go (enquiries, "Chat with a live agent", partner applications).
 *
 * The owner confirmed (2026-11-10) that info@vistachase.com doesn't exist: every enquiry sent there
 * bounced back as "Undeliverable". support@vistachase.com is the team's real inbox, so it is the
 * default, and an env value still set to info@ (from the old .env.example) is ignored.
 */
export const SUPPORT_INBOX = "support@vistachase.com";
const DEAD_INBOXES = new Set(["info@vistachase.com"]);

/** The first configured address that isn't a dead mailbox, else support@vistachase.com. */
export function staffInbox(...configured: (string | undefined)[]): string {
  for (const value of configured) {
    const address = value?.trim();
    if (address && !DEAD_INBOXES.has(address.toLowerCase())) return address;
  }
  return SUPPORT_INBOX;
}
