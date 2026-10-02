export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface IEmailProvider {
  sendEmail(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

class ConsoleEmailProvider implements IEmailProvider {
  async sendEmail(payload: EmailPayload): Promise<{ success: boolean; messageId: string }> {
    const messageId = `mock_msg_${Date.now()}`;
    console.log("\n================ [EMAIL DISPATCH: CONSOLE PROVIDER] ================");
    console.log(`To: ${Array.isArray(payload.to) ? payload.to.join(", ") : payload.to}`);
    console.log(`From: ${payload.from || process.env.EMAIL_FROM || "bookings@vistachase.com"}`);
    console.log(`Subject: ${payload.subject}`);
    console.log("----------------------- [EMAIL CONTENT PREVIEW] -----------------------");
    console.log(payload.text || payload.html.replace(/<[^>]*>?/gm, "").substring(0, 300) + "...");
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
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.message || "Failed to send email" };
      }
      return { success: true, messageId: data.id };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  }
}

class SESEmailProvider implements IEmailProvider {
  async sendEmail(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    console.log(`[SESEmailProvider] AWS SES ready send to ${payload.to}`);
    return { success: true, messageId: `ses_${Date.now()}` };
  }
}

let emailInstance: IEmailProvider | null = null;

export function getEmailProvider(): IEmailProvider {
  if (emailInstance) return emailInstance;

  const providerType = process.env.EMAIL_PROVIDER || "console";
  if (providerType === "resend" && process.env.RESEND_API_KEY) {
    emailInstance = new ResendEmailProvider(process.env.RESEND_API_KEY);
  } else if (providerType === "ses" && process.env.AWS_ACCESS_KEY_ID) {
    emailInstance = new SESEmailProvider();
  } else {
    emailInstance = new ConsoleEmailProvider();
  }
  return emailInstance;
}
