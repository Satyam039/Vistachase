import nodemailer from "nodemailer";

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  /** Where replies go, e.g. the guest who asked for a live agent. */
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface IEmailProvider {
  sendEmail(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

/** Hides link tokens: query values named t, token or sig, and any hex run of 32+ characters. */
export function redactTokens(text: string): string {
  return text.replace(/([?&](?:t|token|sig)=)[^&\s"'<>]+/gi, "$1[redacted]").replace(/[a-f0-9]{32,}/gi, "[redacted]");
}

class ConsoleEmailProvider implements IEmailProvider {
  async sendEmail(payload: EmailPayload): Promise<{ success: boolean; messageId: string }> {
    const messageId = `mock_msg_${Date.now()}`;
    console.log("\n================ [EMAIL DISPATCH: CONSOLE PROVIDER] ================");
    console.log(`To: ${Array.isArray(payload.to) ? payload.to.join(", ") : payload.to}`);
    console.log(`From: ${payload.from || process.env.EMAIL_FROM || "bookings@vistachase.com"}`);
    console.log(`Subject: ${payload.subject}`);
    if (payload.replyTo) console.log(`Reply-To: ${payload.replyTo}`);
    for (const a of payload.attachments ?? []) console.log(`Attachment: ${a.filename} (${a.content.length} bytes)`);
    console.log("----------------------- [EMAIL CONTENT PREVIEW] -----------------------");
    // Link tokens (password reset, staff invites, email confirmation, voucher, check-in, review,
    // tracking) never go to the logs.
    const preview = payload.text || payload.html.replace(/<[^>]*>?/gm, "").substring(0, 300) + "...";
    console.log(redactTokens(preview));
    console.log("===================================================================\n");
    return { success: true, messageId };
  }
}

class ResendEmailProvider implements IEmailProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendEmail(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: payload.from || process.env.EMAIL_FROM || "bookings@vistachase.com",
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
          ...(payload.attachments?.length
            ? { attachments: payload.attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64"), content_type: a.contentType })) }
            : {}),
        }),
      });

      const data = (await response.json()) as { id?: string; message?: string };
      if (!response.ok) {
        return { success: false, error: data.message || "Failed to send email" };
      }
      return { success: true, messageId: data.id };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  }
}

/**
 * Any SMTP mailbox: Gmail / Google Workspace (an app password), Zoho, Hostinger, Outlook / Microsoft
 * 365, or Amazon SES through its SMTP endpoint (email-smtp.<region>.amazonaws.com, SES SMTP
 * credentials). Port 465 uses TLS from the start; 587 (and 25) upgrade with STARTTLS.
 */
export class SmtpEmailProvider implements IEmailProvider {
  private transport: nodemailer.Transporter;

  constructor(config: SmtpConfig) {
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }

  async sendEmail(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const info = await this.transport.sendMail({
        from: payload.from || process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
        attachments: payload.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
      });
      return { success: true, messageId: info.messageId };
    } catch (err: unknown) {
      // The server's reply (e.g. "535 Authentication failed"), never the password.
      return { success: false, error: (err as Error).message.slice(0, 300) };
    }
  }
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

/** SMTP settings from the environment, or null when they are incomplete. */
export function smtpConfig(env: NodeJS.ProcessEnv = process.env): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(env.SMTP_PORT) || 587;
  const secure = env.SMTP_SECURE ? /^(true|1|yes)$/i.test(env.SMTP_SECURE) : port === 465;
  return { host, port, secure, user, pass };
}

/**
 * Which provider sends email and whether it really leaves the server. EMAIL_PROVIDER=smtp (or ses
 * with SMTP_* set, i.e. SES through its SMTP endpoint) uses SMTP; resend needs RESEND_API_KEY.
 * Anything else, or missing settings, falls back to the console (emails only go to the log).
 */
export function emailSetup(env: NodeJS.ProcessEnv = process.env): { provider: "resend" | "smtp" | "console"; configured: boolean; problem: string | null } {
  const wanted = (env.EMAIL_PROVIDER || "console").toLowerCase();
  if (wanted === "resend") {
    return env.RESEND_API_KEY ? { provider: "resend", configured: true, problem: null } : { provider: "console", configured: false, problem: "EMAIL_PROVIDER=resend without RESEND_API_KEY" };
  }
  if (wanted === "smtp" || wanted === "ses") {
    return smtpConfig(env)
      ? { provider: "smtp", configured: true, problem: null }
      : { provider: "console", configured: false, problem: `EMAIL_PROVIDER=${wanted} without SMTP_HOST, SMTP_USER and SMTP_PASS` };
  }
  return { provider: "console", configured: false, problem: `EMAIL_PROVIDER=${wanted}` };
}

let emailInstance: IEmailProvider | null = null;

/** True when emails really leave the server (not the console provider used in development). */
export function emailDeliveryConfigured(): boolean {
  return emailSetup().configured;
}

export function getEmailProvider(): IEmailProvider {
  if (emailInstance) return emailInstance;

  const setup = emailSetup();
  if (setup.provider === "resend") {
    emailInstance = new ResendEmailProvider(process.env.RESEND_API_KEY!);
  } else if (setup.provider === "smtp") {
    emailInstance = new SmtpEmailProvider(smtpConfig()!);
  } else {
    emailInstance = new ConsoleEmailProvider();
  }
  return emailInstance;
}
