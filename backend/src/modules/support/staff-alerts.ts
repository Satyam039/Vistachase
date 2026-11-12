/**
 * Instant alerts to the support team's phones when a guest asks for a live agent.
 *
 * Every channel is optional and free, and none blocks the guest: a channel that isn't set up is
 * skipped and a failed send is only logged. The support inbox email and the Admin → Live chat
 * screen (sound + browser notification) always work; these add a push on the phone:
 *   - Telegram: TELEGRAM_BOT_TOKEN (from @BotFather) and TELEGRAM_CHAT_ID (one id, or several
 *     separated by commas, e.g. each agent's chat or a team group).
 *   - ntfy (https://ntfy.sh, free phone app, no account): NTFY_TOPIC_URL, e.g.
 *     https://ntfy.sh/vistachase-live-<random>. Anyone who knows the topic can read it, so keep the
 *     name long and random; alerts carry no guest email or phone, only the name and the link.
 */

export interface StaffAlert {
  title: string;
  body: string;
  /** Where staff answer it (the Admin → Live chat screen). */
  url: string;
}

const TIMEOUT_MS = 8000;

async function post(url: string, init: RequestInit): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } finally {
    clearTimeout(timer);
  }
}

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim());
}

export function ntfyConfigured(): boolean {
  return /^https:\/\/\S+$/.test(process.env.NTFY_TOPIC_URL?.trim() ?? "");
}

/** The phone channels that are set up (shown on the Live chat screen so staff know what reaches them). */
export function phoneAlertChannels(): string[] {
  return [telegramConfigured() ? "Telegram" : null, ntfyConfigured() ? "ntfy" : null].filter((c): c is string => c !== null);
}

async function sendTelegram(alert: StaffAlert): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN!.trim();
  const chats = process.env.TELEGRAM_CHAT_ID!.split(",").map((c) => c.trim()).filter(Boolean);
  const text = `${alert.title}\n${alert.body}\n\nAnswer: ${alert.url}`;
  await Promise.all(
    chats.map((chat_id) =>
      post(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text, disable_web_page_preview: true }),
      }),
    ),
  );
}

async function sendNtfy(alert: StaffAlert): Promise<void> {
  // ntfy headers must be plain ASCII.
  const ascii = (s: string) => s.replace(/[^\x20-\x7E]/g, "");
  await post(process.env.NTFY_TOPIC_URL!.trim(), {
    method: "POST",
    headers: { Title: ascii(alert.title), Priority: "high", Tags: "speech_balloon", Click: alert.url },
    body: alert.body,
  });
}

/** Sends the alert on every configured phone channel. Never throws. */
export async function alertStaffPhones(alert: StaffAlert): Promise<string[]> {
  const sent: string[] = [];
  const jobs: Promise<void>[] = [];
  if (telegramConfigured()) {
    jobs.push(sendTelegram(alert).then(() => void sent.push("Telegram")).catch((e: Error) => console.error("[staff-alerts] Telegram failed:", e.message)));
  }
  if (ntfyConfigured()) {
    jobs.push(sendNtfy(alert).then(() => void sent.push("ntfy")).catch((e: Error) => console.error("[staff-alerts] ntfy failed:", e.message)));
  }
  await Promise.all(jobs);
  return sent;
}
