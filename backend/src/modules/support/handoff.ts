// "Chat with a live agent" from the AI concierge. The site has no real-time chat backend, so the
// hand-off goes where the support team already works: it is saved as an enquiry (Admin → Messages)
// and emailed to the support inbox with the whole conversation, reply-to the guest. The guest
// gets an email saying the team has it. When a live chat service is connected (the frontend's
// NEXT_PUBLIC_CRISP_WEBSITE_ID), the chat opens there as well, and this record is the backup.

import prisma from "@/lib/db/prisma";
import { getEmailProvider } from "@/lib/email/email.provider";
import { conciergeLanguage } from "@/lib/ai/languages";

export interface HandoffInput {
  name: string;
  email: string;
  phone?: string;
  note?: string;
  language?: string;
  page?: string;
  transcript: { role: "user" | "assistant"; content: string }[];
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const supportInbox = () => process.env.SUPPORT_HANDOFF_TO || process.env.ENQUIRIES_TO || "info@vistachase.com";

export async function createSupportHandoff(input: HandoffInput) {
  const lang = conciergeLanguage(input.language);
  const conversation = input.transcript.map((m) => `${m.role === "user" ? "Guest" : "AI concierge"}: ${m.content.trim()}`).join("\n\n");
  const header = [
    "Live agent request from the AI concierge",
    lang && lang.code !== "en" ? `Language chosen: ${lang.english}` : null,
    input.page ? `Page: ${input.page}` : null,
    input.note ? `\nGuest's note: ${input.note}` : null,
  ].filter((l): l is string => l !== null);
  const message = `${header.join("\n")}\n\nConversation:\n${conversation || "(no messages yet)"}`;

  const enquiry = await prisma.enquiry.create({
    data: { name: input.name, email: input.email, phone: input.phone, message: message.slice(0, 20000) },
  });

  const lines = [`Name: ${input.name}`, `Email: ${input.email}`, input.phone ? `Phone: ${input.phone}` : null, "", message].filter((l): l is string => l !== null);
  const sent = await getEmailProvider()
    .sendEmail({
      to: supportInbox(),
      replyTo: input.email,
      subject: `Live agent request from ${input.name} (AI concierge)`,
      text: lines.join("\n"),
      html: `<p>${lines.map(escape).join("<br>")}</p>`,
    })
    .catch((err: Error) => ({ success: false, error: err.message }));
  if (!sent.success) console.error(`[handoff] support email failed for enquiry ${enquiry.id}: ${"error" in sent ? sent.error : "unknown"}`);

  await getEmailProvider()
    .sendEmail({
      to: input.email,
      subject: "We've got your message - Vista Chase",
      text: `Hi ${input.name},\n\nThanks for reaching out. Our support team has your conversation with the AI concierge and will reply to this email address.\n\nFor anything urgent, call +1 (825) 734-9456 (6 a.m. – 9 p.m. Mountain Time).\n\nVista Chase\nsupport@vistachase.com`,
      html: `<p>Hi ${escape(input.name)},</p><p>Thanks for reaching out. Our support team has your conversation with the AI concierge and will reply to this email address.</p><p>For anything urgent, call <a href="tel:+18257349456">+1 (825) 734-9456</a> (6 a.m. – 9 p.m. Mountain Time).</p><p>Vista Chase<br>support@vistachase.com</p>`,
    })
    .catch((err: Error) => console.error("[handoff] guest acknowledgement failed", err.message));

  return { id: enquiry.id, delivered: sent.success };
}
