// Email delivery: which provider is used (Resend, any SMTP mailbox, or the console log), a real SMTP
// conversation (login, attachment) against a small in-test SMTP server, the start-up warning, and
// the staff "send test email" check.

import net from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken } from "@/lib/auth/auth";
import { SmtpEmailProvider, emailSetup, smtpConfig } from "@/lib/email/email.provider";
import { configWarnings } from "@/lib/config/startup-checks";

describe("email provider selection", () => {
  it("uses Resend only with an API key", () => {
    expect(emailSetup({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_1" })).toMatchObject({ provider: "resend", configured: true });
    expect(emailSetup({ EMAIL_PROVIDER: "resend" })).toMatchObject({ provider: "console", configured: false });
  });

  it("uses SMTP (any mailbox, or SES's SMTP endpoint) when host, user and password are set", () => {
    const smtp = { SMTP_HOST: "smtp.gmail.com", SMTP_USER: "bookings@vistachase.com", SMTP_PASS: "app-password" };
    expect(emailSetup({ EMAIL_PROVIDER: "smtp", ...smtp })).toMatchObject({ provider: "smtp", configured: true });
    expect(emailSetup({ EMAIL_PROVIDER: "ses", ...smtp, SMTP_HOST: "email-smtp.ca-central-1.amazonaws.com" })).toMatchObject({ provider: "smtp", configured: true });
    expect(emailSetup({ EMAIL_PROVIDER: "smtp", SMTP_HOST: "smtp.gmail.com" })).toMatchObject({ provider: "console", configured: false });
    expect(emailSetup({})).toMatchObject({ provider: "console", configured: false });
  });

  it("picks TLS from the port unless SMTP_SECURE says otherwise", () => {
    const base = { SMTP_HOST: "h", SMTP_USER: "u", SMTP_PASS: "p" };
    expect(smtpConfig({ ...base, SMTP_PORT: "465" })).toMatchObject({ port: 465, secure: true });
    expect(smtpConfig({ ...base, SMTP_PORT: "587" })).toMatchObject({ port: 587, secure: false });
    expect(smtpConfig(base)).toMatchObject({ port: 587, secure: false });
    expect(smtpConfig({ ...base, SMTP_PORT: "2525", SMTP_SECURE: "true" })).toMatchObject({ secure: true });
  });

  it("start-up checks accept SMTP and still warn without any provider", () => {
    const smtp = { EMAIL_PROVIDER: "smtp", SMTP_HOST: "smtp.zoho.com", SMTP_USER: "b@vistachase.com", SMTP_PASS: "x" };
    expect(configWarnings(smtp).join("\n")).not.toContain("Email is not being sent");
    expect(configWarnings({ EMAIL_PROVIDER: "smtp" }).join("\n")).toContain("without SMTP_HOST, SMTP_USER and SMTP_PASS");
  });
});

// A minimal SMTP server: EHLO, AUTH PLAIN, MAIL, RCPT, DATA, QUIT. Records what it receives.
function fakeSmtp() {
  const received: { auth: string; from: string; to: string[]; data: string }[] = [];
  const server = net.createServer((socket) => {
    const msg = { auth: "", from: "", to: [] as string[], data: "" };
    let inData = false;
    let buffer = "";
    socket.write("220 test ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let i: number;
      while (true) {
        if (inData) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end === -1) return;
          msg.data = buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          inData = false;
          received.push({ ...msg, to: [...msg.to] });
          socket.write("250 OK queued\r\n");
          continue;
        }
        if ((i = buffer.indexOf("\r\n")) === -1) return;
        const line = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        const cmd = line.toUpperCase();
        if (cmd.startsWith("EHLO")) socket.write("250-test\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n");
        else if (cmd.startsWith("AUTH PLAIN")) { msg.auth = Buffer.from(line.split(" ")[2] ?? "", "base64").toString("utf8"); socket.write("235 Authenticated\r\n"); }
        else if (cmd.startsWith("MAIL FROM")) { msg.from = line; socket.write("250 OK\r\n"); }
        else if (cmd.startsWith("RCPT TO")) { msg.to.push(line); socket.write("250 OK\r\n"); }
        else if (cmd === "DATA") { inData = true; socket.write("354 End data with <CR><LF>.<CR><LF>\r\n"); }
        else if (cmd === "QUIT") { socket.write("221 Bye\r\n"); socket.end(); }
        else socket.write("250 OK\r\n");
      }
    });
  });
  return { server, received };
}

describe("SMTP delivery", () => {
  const smtp = fakeSmtp();
  let port = 0;
  beforeAll(async () => {
    await new Promise<void>((resolve) => smtp.server.listen(0, "127.0.0.1", resolve));
    port = (smtp.server.address() as net.AddressInfo).port;
  });
  afterAll(() => new Promise<void>((resolve) => smtp.server.close(() => resolve())));

  it("logs in and delivers the message with its PDF attachment", async () => {
    const provider = new SmtpEmailProvider({ host: "127.0.0.1", port, secure: false, user: "bookings@vistachase.com", pass: "app-password" });
    const result = await provider.sendEmail({
      to: "guest@example.com",
      from: "Vista Chase Bookings <bookings@vistachase.com>",
      subject: "Your Vista Chase booking is confirmed: VC-TEST",
      html: "<p>Confirmed</p>",
      text: "Confirmed",
      attachments: [{ filename: "itinerary.pdf", content: Buffer.from("%PDF-1.4 test"), contentType: "application/pdf" }],
    });
    expect(result.success).toBe(true);
    const mail = smtp.received.at(-1)!;
    expect(mail.auth).toContain("bookings@vistachase.com");
    expect(mail.to.join(" ")).toContain("guest@example.com");
    expect(mail.data).toContain("Subject: Your Vista Chase booking is confirmed: VC-TEST");
    expect(mail.data).toContain('filename=itinerary.pdf');
  });

  it("reports the server's refusal without throwing", async () => {
    const provider = new SmtpEmailProvider({ host: "127.0.0.1", port: 1, secure: false, user: "u", pass: "p" });
    const result = await provider.sendEmail({ to: "guest@example.com", subject: "x", html: "x" });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe("staff email check", () => {
  const app = createApp();
  let adminCookie = "";
  let customerCookie = "";
  beforeAll(async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    const customer = await prisma.user.findFirstOrThrow({ where: { role: "CUSTOMER" } });
    const cookie = (u: typeof admin) => `vc_token=${signToken({ userId: u.id, email: u.email, role: u.role, name: u.name })}`;
    adminCookie = cookie(admin);
    customerCookie = cookie(customer);
  });

  it("reports the provider to staff only, without secrets", async () => {
    expect((await request(app).get("/api/admin/email/status").set("Cookie", customerCookie)).status).toBe(403);
    const res = await request(app).get("/api/admin/email/status").set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.email).toMatchObject({ provider: "console", configured: false });
    expect(JSON.stringify(res.body)).not.toMatch(/SMTP_PASS|RESEND_API_KEY/);
  });

  it("refuses a test email when no provider is set up, and never for non-staff", async () => {
    expect((await request(app).post("/api/admin/email/test").set("Cookie", customerCookie)).status).toBe(403);
    const res = await request(app).post("/api/admin/email/test").set("Cookie", adminCookie);
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("isn't set up");
  });
});
