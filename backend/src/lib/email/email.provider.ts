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
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
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
        replyTo: payload.replyTo,
        attachments: payload.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
      });
      return { success: true, messageId: info.messageId };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
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
    console.error(`[SESEmailProvider] not implemented: email to ${Array.isArray(payload.to) ? payload.to.length + " recipients" : "1 recipient"} was NOT sent. Set EMAIL_PROVIDER=resend.`);
    return { success: false, error: "The SES email provider is not implemented; use EMAIL_PROVIDER=resend." };
  }
}

let emailInstance: IEmailProvider | null = null;

/** True when emails really leave the server (not the console provider used in development). */
export function emailDeliveryConfigured(): boolean {
  const providerType = process.env.EMAIL_PROVIDER || "console";
  return (providerType === "resend" && !!process.env.RESEND_API_KEY) || (providerType === "smtp" && smtpConfigured());
}

export function getEmailProvider(): IEmailProvider {
  if (emailInstance) return emailInstance;

  const providerType = process.env.EMAIL_PROVIDER || "console";
  if (providerType === "resend" && process.env.RESEND_API_KEY) {
    emailInstance = new ResendEmailProvider(process.env.RESEND_API_KEY);
  } else if (providerType === "smtp" && smtpConfigured()) {
    emailInstance = new SmtpEmailProvider();
  } else if (providerType === "ses" && process.env.AWS_ACCESS_KEY_ID) {
    emailInstance = new SESEmailProvider();
  } else {
    emailInstance = new ConsoleEmailProvider();
  }
  return emailInstance;
}
