/**
 * "Chat with a live agent" from the AI concierge: a real-time chat between the guest and the
 * support team, kept in the database (LiveChat, LiveChatMessage).
 *
 *  1. The guest starts a chat from the concierge. The concierge conversation is copied in, the chat
 *     is saved as an Enquiry too (Admin → Messages, the backup if nobody answers), and the team is
 *     alerted: support inbox email, phone push (staff-alerts.ts: Telegram / ntfy) and the
 *     Admin → Live chat screen, which plays a sound and shows a browser notification.
 *  2. An agent opens Admin → Live chat and replies; the first reply moves the chat to ACTIVE and the
 *     guest sees the agent's first name.
 *  3. Both sides poll every few seconds (no websockets needed behind nginx/PM2).
 *
 * The guest is identified by a random token returned once when the chat starts; only its SHA-256 is
 * stored, so the chat id alone never opens a conversation.
 */

import crypto from "node:crypto";
import prisma from "@/lib/db/prisma";
import { getEmailProvider } from "@/lib/email/email.provider";
import { conciergeLanguage } from "@/lib/ai/languages";
import { siteUrl } from "@/lib/security/signed-links";
import { supportInbox, type HandoffInput } from "@/modules/support/handoff";
import { alertStaffPhones, phoneAlertChannels } from "@/modules/support/staff-alerts";

export type LiveChatStatus = "WAITING" | "ACTIVE" | "CLOSED";
export type LiveChatSender = "GUEST" | "AGENT" | "AI" | "SYSTEM";

const MAX_MESSAGES = 300;
const CARD_NUMBER = /\b(?:\d[ -]*?){13,19}\b/g;
/** Support lines are open 6 a.m. to 9 p.m. Mountain Time. */
const OPEN_HOUR = 6;
const CLOSE_HOUR = 21;

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const clean = (s: string) => s.replace(CARD_NUMBER, "[redacted]").trim();
const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "Vista Chase";
const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const liveChatAdminUrl = (id: string) => `${siteUrl()}/admin/live-chat?chat=${encodeURIComponent(id)}`;

/** True during support hours (6 a.m. – 9 p.m. Mountain Time). */
export function supportOnline(now = new Date()): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", hour: "numeric", hourCycle: "h23" }).format(now));
  return hour >= OPEN_HOUR && hour < CLOSE_HOUR;
}

export class LiveChatError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function guestChat(id: string, token: string) {
  const chat = await prisma.liveChat.findUnique({ where: { id } });
  if (!chat || typeof token !== "string" || token.length < 20) throw new LiveChatError("Chat not found.", 404);
  const a = Buffer.from(chat.guestTokenHash, "hex");
  const b = Buffer.from(hashToken(token), "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new LiveChatError("Chat not found.", 404);
  return chat;
}

const messagesOf = (chatId: string) =>
  prisma.liveChatMessage.findMany({
    where: { chatId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: MAX_MESSAGES,
    select: { id: true, sender: true, authorName: true, body: true, createdAt: true },
  });

export async function startLiveChat(input: HandoffInput) {
  const token = crypto.randomBytes(24).toString("base64url");
  const online = supportOnline();
  const lang = conciergeLanguage(input.language);

  const history = input.transcript
    .filter((m) => m.content.trim())
    .slice(-40)
    .map((m) => ({ sender: (m.role === "user" ? "GUEST" : "AI") as LiveChatSender, body: clean(m.content).slice(0, 6000) }));
  if (input.note?.trim()) history.push({ sender: "GUEST", body: clean(input.note).slice(0, 2000) });
  history.push({
    sender: "SYSTEM",
    body: online
      ? "You're in the queue. An agent from our team will join this chat shortly."
      : "Our team is offline right now (6 a.m. – 9 p.m. Mountain Time). Leave your message here and we'll reply in this chat or by email.",
  });

  // createdAt is set one millisecond apart so the copied conversation keeps its order.
  const start = Date.now();
  const chat = await prisma.liveChat.create({
    data: {
      guestTokenHash: hashToken(token),
      name: input.name,
      email: input.email,
      phone: input.phone,
      language: lang?.code ?? null,
      page: input.page,
      messages: { create: history.map((m, i) => ({ ...m, createdAt: new Date(start + i) })) },
    },
  });

  const url = liveChatAdminUrl(chat.id);
  const conversation = history
    .filter((m) => m.sender !== "SYSTEM")
    .map((m) => `${m.sender === "GUEST" ? "Guest" : "AI concierge"}: ${m.body}`)
    .join("\n\n");
  const header = [
    "Live agent request from the AI concierge (live chat)",
    `Answer in the live chat: ${url}`,
    lang && lang.code !== "en" ? `Language chosen: ${lang.english}` : null,
    input.page ? `Page: ${input.page}` : null,
  ].filter((l): l is string => l !== null);
  const message = `${header.join("\n")}\n\nConversation:\n${conversation || "(no messages yet)"}`;

  // The enquiry is the backup in Admin → Messages: if nobody answers the chat, staff reply by email.
  const enquiry = await prisma.enquiry.create({ data: { name: input.name, email: input.email, phone: input.phone, message: message.slice(0, 20000) } });
  await prisma.liveChat.update({ where: { id: chat.id }, data: { enquiryId: enquiry.id } });

  // Alerts go out in the background so the guest's chat opens at once.
  const lastGuestLine = [...history].reverse().find((m) => m.sender === "GUEST")?.body ?? "";
  const alertBody = `${input.name} is waiting in the website chat.${lastGuestLine ? `\n"${lastGuestLine.slice(0, 160)}"` : ""}`;
  void alertStaffPhones({ title: "New live chat - Vista Chase", body: alertBody, url });
  const lines = [`Name: ${input.name}`, `Email: ${input.email}`, input.phone ? `Phone: ${input.phone}` : null, "", message].filter((l): l is string => l !== null);
  void getEmailProvider()
    .sendEmail({
      to: supportInbox(),
      replyTo: input.email,
      subject: `Live chat waiting: ${input.name} (AI concierge)`,
      text: lines.join("\n"),
      html: `<p><a href="${escape(url)}"><strong>Open the live chat</strong></a></p><p>${lines.map(escape).join("<br>")}</p>`,
    })
    .then((r) => {
      if (!r.success) console.error(`[live-chat] support email failed for chat ${chat.id}: ${r.error ?? "unknown"}`);
    })
    .catch((err: Error) => console.error(`[live-chat] support email failed for chat ${chat.id}: ${err.message}`));

  return { id: chat.id, token, online };
}

/** What the guest's chat window shows. */
export async function guestLiveChat(id: string, token: string) {
  const chat = await guestChat(id, token);
  return {
    id: chat.id,
    status: chat.status as LiveChatStatus,
    agentName: chat.agentName ? firstName(chat.agentName) : null,
    online: supportOnline(),
    email: chat.email,
    messages: (await messagesOf(chat.id)).map((m) => ({ ...m, authorName: m.sender === "AGENT" ? firstName(m.authorName) : null })),
  };
}

export async function guestSendLiveChat(id: string, token: string, body: string) {
  const chat = await guestChat(id, token);
  if (chat.status === "CLOSED") throw new LiveChatError("This chat has ended. Start a new one from the concierge.", 409);
  const count = await prisma.liveChatMessage.count({ where: { chatId: id } });
  if (count >= MAX_MESSAGES) throw new LiveChatError("This chat is full. Please email support@vistachase.com.", 409);
  await prisma.$transaction([
    prisma.liveChatMessage.create({ data: { chatId: id, sender: "GUEST", body: clean(body) } }),
    prisma.liveChat.update({ where: { id }, data: { lastGuestAt: new Date() } }),
  ]);
  return guestLiveChat(id, token);
}

export async function guestCloseLiveChat(id: string, token: string) {
  const chat = await guestChat(id, token);
  if (chat.status !== "CLOSED") {
    await prisma.$transaction([
      prisma.liveChatMessage.create({ data: { chatId: id, sender: "SYSTEM", body: "The guest left the chat." } }),
      prisma.liveChat.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date() } }),
    ]);
  }
  return { success: true };
}

// ---------------------------------------------------------------- staff side

/** A chat needs an answer when it's open and the guest wrote last (or nobody has answered yet). */
const needsAnswer = (c: { status: string; lastGuestAt: Date; lastAgentAt: Date | null }) =>
  c.status !== "CLOSED" && (!c.lastAgentAt || c.lastGuestAt > c.lastAgentAt);

/** Open chats plus those closed in the last 24 hours, the ones needing an answer first. */
export async function staffListLiveChats() {
  const since = new Date(Date.now() - 24 * 3600_000);
  const chats = await prisma.liveChat.findMany({
    where: { OR: [{ status: { not: "CLOSED" } }, { closedAt: { gte: since } }] },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { messages: { where: { sender: { in: ["GUEST", "AGENT"] } }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const rows = chats.map(({ messages, guestTokenHash: _hash, ...c }) => ({
    ...c,
    needsAnswer: needsAnswer(c),
    lastMessage: messages[0] ? { sender: messages[0].sender, body: messages[0].body.slice(0, 160), createdAt: messages[0].createdAt } : null,
  }));
  rows.sort((a, b) => Number(b.needsAnswer) - Number(a.needsAnswer) || Number(a.status === "CLOSED") - Number(b.status === "CLOSED"));
  return { chats: rows, waiting: rows.filter((r) => r.needsAnswer).length, phoneAlerts: phoneAlertChannels(), online: supportOnline() };
}

/** How many chats are waiting for an answer, and the newest one (the alert in every admin page). */
export async function staffLiveChatPending() {
  const open = await prisma.liveChat.findMany({
    where: { status: { not: "CLOSED" } },
    select: { id: true, name: true, status: true, lastGuestAt: true, lastAgentAt: true },
    orderBy: { lastGuestAt: "desc" },
    take: 100,
  });
  const waiting = open.filter(needsAnswer);
  return { waiting: waiting.length, latest: waiting[0] ? { id: waiting[0].id, name: waiting[0].name, at: waiting[0].lastGuestAt } : null };
}

export async function staffGetLiveChat(id: string) {
  const chat = await prisma.liveChat.findUnique({ where: { id } });
  if (!chat) throw new LiveChatError("Chat not found.", 404);
  const { guestTokenHash: _hash, ...rest } = chat;
  return { ...rest, needsAnswer: needsAnswer(chat), messages: await messagesOf(id) };
}

export async function staffSendLiveChat(id: string, staff: { userId: string; name: string }, body: string) {
  const chat = await prisma.liveChat.findUnique({ where: { id } });
  if (!chat) throw new LiveChatError("Chat not found.", 404);
  if (chat.status === "CLOSED") throw new LiveChatError("This chat has ended.", 409);
  const now = new Date();
  const joined = chat.status === "WAITING";
  await prisma.$transaction([
    ...(joined ? [prisma.liveChatMessage.create({ data: { chatId: id, sender: "SYSTEM", body: `${firstName(staff.name)} from Vista Chase joined the chat.`, createdAt: new Date(now.getTime() - 1) } })] : []),
    prisma.liveChatMessage.create({ data: { chatId: id, sender: "AGENT", authorName: staff.name, body: body.trim(), createdAt: now } }),
    prisma.liveChat.update({
      where: { id },
      data: { status: "ACTIVE", lastAgentAt: now, ...(joined || !chat.agentId ? { agentId: staff.userId, agentName: staff.name } : {}) },
    }),
  ]);
  if (chat.enquiryId) await prisma.enquiry.updateMany({ where: { id: chat.enquiryId, status: "NEW" }, data: { status: "REPLIED" } });
  return staffGetLiveChat(id);
}

export async function staffCloseLiveChat(id: string, staff: { name: string }) {
  const chat = await prisma.liveChat.findUnique({ where: { id } });
  if (!chat) throw new LiveChatError("Chat not found.", 404);
  if (chat.status !== "CLOSED") {
    await prisma.$transaction([
      prisma.liveChatMessage.create({ data: { chatId: id, sender: "SYSTEM", body: `${firstName(staff.name)} ended the chat. Thanks for chatting with Vista Chase.` } }),
      prisma.liveChat.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date() } }),
    ]);
  }
  return staffGetLiveChat(id);
}
