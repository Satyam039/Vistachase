import nodemailer, { type Transporter } from "nodemailer";

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
    console.log("ℹ️ Real emails are NOT enabled (EMAIL_PROVIDER=console). To send real emails, set EMAIL_PROVIDER=resend or EMAIL_PROVIDER=smtp.");
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
    const from = payload.from || process.env.EMAIL_FROM || "bookings@vistachase.com";
    const to = Array.isArray(payload.to) ? payload.to : [payload.to];
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
          ...(payload.attachments?.length
            ? { attachments: payload.attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64"), content_type: a.contentType })) }
            : {}),
        }),
      });

      const data = (await response.json()) as { id?: string; message?: string; name?: string; statusCode?: number };
      if (!response.ok) {
        const errorMsg = data.message || `Resend error (${response.status})`;
        console.error(`❌ [ResendEmailProvider] Failed to send email to ${to.join(", ")}:`, errorMsg);
        if (errorMsg.includes("domain") || response.status === 403) {
          console.error("💡 Hint: In Resend, the sender domain in EMAIL_FROM must be verified in https://resend.com/domains. For testing without a verified domain, use EMAIL_FROM='onboarding@resend.dev' and send only to your account email.");
        }
        return { success: false, error: errorMsg };
      }

      console.log(`✅ [ResendEmailProvider] Email sent successfully to ${to.join(", ")}, messageId: ${data.id}`);
      return { success: true, messageId: data.id };
    } catch (err: unknown) {
      const errorMsg = (err as Error).message;
      console.error(`❌ [ResendEmailProvider] Network error sending to ${to.join(", ")}:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }
}

// Any SMTP mailbox: Gmail or Google Workspace (smtp.gmail.com, an App Password), Hostinger or
// GoDaddy email. SMTP_HOST, SMTP_PORT (465 = TLS, 587 = STARTTLS), SMTP_USER, SMTP_PASS.
// EMAIL_FROM should be SMTP_USER's own address (or an alias the mailbox may send as).
class SmtpEmailProvider implements IEmailProvider {
  private transport: Transporter;

  constructor() {
    const port = Number(process.env.SMTP_PORT || 465);
    this.transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false },
    });
  }

  async sendEmail(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const from = payload.from || process.env.EMAIL_FROM || process.env.SMTP_USER || "bookings@vistachase.com";
    const to = Array.isArray(payload.to) ? payload.to.join(", ") : payload.to;
    try {
      const info = await this.transport.sendMail({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo: payload.replyTo,
        attachments: payload.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
      });
      console.log(`✅ [SmtpEmailProvider] Email sent successfully to ${to}, messageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err: unknown) {
      const errorMsg = (err as Error).message;
      console.error(`❌ [SmtpEmailProvider] Failed to send email to ${to}:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }
}

/** SMTP is set up: EMAIL_PROVIDER=smtp with a host, user and password. */
function smtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

// Not built yet. It says so instead of reporting a send that never happened (EMAIL_PROVIDER=ses
// used to look configured while every email was dropped). Use EMAIL_PROVIDER=resend.
class SESEmailProvider implements IEmailProvider {
  async sendEmail(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    console.error(`[SESEmailProvider] not implemented: email to ${Array.isArray(payload.to) ? payload.to.length + " recipients" : "1 recipient"} was NOT sent. Set EMAIL_PROVIDER=resend or EMAIL_PROVIDER=smtp.`);
    return { success: false, error: "The SES email provider is not implemented; use EMAIL_PROVIDER=resend or EMAIL_PROVIDER=smtp." };
  }
}

let emailInstance: IEmailProvider | null = null;

/** True when emails really leave the server (not the console provider used in development). */
export function emailDeliveryConfigured(): boolean {
  const providerType = (process.env.EMAIL_PROVIDER || "").toLowerCase();
  return (
    (providerType === "resend" && !!process.env.RESEND_API_KEY) ||
    (!providerType && !!process.env.RESEND_API_KEY) ||
    (providerType === "smtp" && smtpConfigured()) ||
    (!providerType && smtpConfigured())
  );
}

export function getEmailProvider(): IEmailProvider {
  if (emailInstance) return emailInstance;

  const providerType = (process.env.EMAIL_PROVIDER || "").toLowerCase();
  if ((providerType === "resend" || !providerType) && process.env.RESEND_API_KEY) {
    emailInstance = new ResendEmailProvider(process.env.RESEND_API_KEY);
  } else if ((providerType === "smtp" || !providerType) && smtpConfigured()) {
    emailInstance = new SmtpEmailProvider();
  } else if (providerType === "ses" && process.env.AWS_ACCESS_KEY_ID) {
    emailInstance = new SESEmailProvider();
  } else {
    emailInstance = new ConsoleEmailProvider();
  }
  return emailInstance;
}

export function setEmailProvider(provider: IEmailProvider | null) {
  emailInstance = provider;
}
