// "Chat with a live agent": a guest starts a live chat from the concierge, staff are alerted and
// answer from Admin → Live chat, and only the guest's token opens the guest side.

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken } from "@/lib/auth/auth";
import { alertStaffPhones, phoneAlertChannels } from "@/modules/support/staff-alerts";
import { supportOnline } from "@/modules/support/live-chat";

const app = createApp();
let staffCookie = "";
let customerCookie = "";

beforeAll(async () => {
  const agent = await prisma.user.create({ data: { email: `chat-agent-${Date.now()}@example.com`, passwordHash: "x", name: "Priya Sharma", role: "OPERATOR" } });
  staffCookie = `vc_token=${signToken({ userId: agent.id, email: agent.email, role: "OPERATOR", name: agent.name })}`;
  const customer = await prisma.user.create({ data: { email: `chat-guest-${Date.now()}@example.com`, passwordHash: "x", name: "Guest", role: "CUSTOMER" } });
  customerCookie = `vc_token=${signToken({ userId: customer.id, email: customer.email, role: "CUSTOMER", name: customer.name })}`;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const start = (body: object = {}) =>
  request(app)
    .post("/api/concierge/live-chat")
    .set("X-Forwarded-For", `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`)
    .send({
      name: "Alex Rivera",
      email: "alex@example.com",
      transcript: [
        { role: "user", content: "Can I bring my dog? Card 4242 4242 4242 4242" },
        { role: "assistant", content: "Let me connect you with our team." },
      ],
      ...body,
    });

describe("live chat", () => {
  it("starts a chat with the concierge conversation, a backup enquiry and no card numbers", async () => {
    const res = await start({ note: "Is the 8:30 tour dog friendly?" });
    expect(res.status).toBe(201);
    expect(res.body.token.length).toBeGreaterThan(20);

    const guest = await request(app).get(`/api/concierge/live-chat/${res.body.id}?t=${res.body.token}`);
    expect(guest.status).toBe(200);
    const bodies = guest.body.chat.messages.map((m: { sender: string; body: string }) => `${m.sender}:${m.body}`);
    expect(bodies[0]).toBe("GUEST:Can I bring my dog? Card [redacted]");
    expect(bodies[1]).toBe("AI:Let me connect you with our team.");
    expect(bodies[2]).toBe("GUEST:Is the 8:30 tour dog friendly?");
    expect(guest.body.chat.status).toBe("WAITING");

    const chat = await prisma.liveChat.findUniqueOrThrow({ where: { id: res.body.id } });
    const enquiry = await prisma.enquiry.findUniqueOrThrow({ where: { id: chat.enquiryId! } });
    expect(enquiry.message).toContain(`/admin/live-chat?chat=${chat.id}`);
    expect(enquiry.message).not.toContain("4242");
  });

  it("opens the guest side only with the guest's token", async () => {
    const { body } = await start();
    expect((await request(app).get(`/api/concierge/live-chat/${body.id}`)).status).toBe(404);
    expect((await request(app).get(`/api/concierge/live-chat/${body.id}?t=${"x".repeat(32)}`)).status).toBe(404);
    expect((await request(app).post(`/api/concierge/live-chat/${body.id}/messages`).send({ token: "y".repeat(32), body: "hi" })).status).toBe(404);
  });

  it("lets staff see, answer and close the chat; the guest sees the agent's first name", async () => {
    const { body } = await start();
    const t = body.token;

    const pending = await request(app).get("/api/admin/live-chats/pending").set("Cookie", staffCookie);
    expect(pending.status).toBe(200);
    expect(pending.body.waiting).toBeGreaterThan(0);

    const list = await request(app).get("/api/admin/live-chats").set("Cookie", staffCookie);
    const row = list.body.chats.find((c: { id: string }) => c.id === body.id);
    expect(row.needsAnswer).toBe(true);
    expect(row.guestTokenHash).toBeUndefined();

    const reply = await request(app).post(`/api/admin/live-chats/${body.id}/messages`).set("Cookie", staffCookie).send({ body: "Hi Alex, yes, small dogs are welcome." });
    expect(reply.status).toBe(201);
    expect(reply.body.chat.status).toBe("ACTIVE");
    expect(reply.body.chat.needsAnswer).toBe(false);

    const guest = await request(app).get(`/api/concierge/live-chat/${body.id}?t=${t}`);
    expect(guest.body.chat.agentName).toBe("Priya");
    const last = guest.body.chat.messages.at(-1);
    expect(last).toMatchObject({ sender: "AGENT", authorName: "Priya", body: "Hi Alex, yes, small dogs are welcome." });
    expect(guest.body.chat.messages.some((m: { body: string }) => m.body === "Priya from Vista Chase joined the chat.")).toBe(true);

    const again = await request(app).post(`/api/concierge/live-chat/${body.id}/messages`).send({ token: t, body: "Great, thanks!" });
    expect(again.status).toBe(201);
    const after = await request(app).get(`/api/admin/live-chats/${body.id}`).set("Cookie", staffCookie);
    expect(after.body.chat.needsAnswer).toBe(true);

    const closed = await request(app).post(`/api/admin/live-chats/${body.id}/close`).set("Cookie", staffCookie);
    expect(closed.body.chat.status).toBe("CLOSED");
    const late = await request(app).post(`/api/concierge/live-chat/${body.id}/messages`).send({ token: t, body: "One more thing" });
    expect(late.status).toBe(409);

    const enquiry = await prisma.enquiry.findUniqueOrThrow({ where: { id: (await prisma.liveChat.findUniqueOrThrow({ where: { id: body.id } })).enquiryId! } });
    expect(enquiry.status).toBe("REPLIED");
  });

  it("keeps the staff side for staff only", async () => {
    expect((await request(app).get("/api/admin/live-chats")).status).toBe(403);
    expect((await request(app).get("/api/admin/live-chats").set("Cookie", customerCookie)).status).toBe(403);
  });

  it("lets the guest leave the chat", async () => {
    const { body } = await start();
    const res = await request(app).post(`/api/concierge/live-chat/${body.id}/close`).send({ token: body.token });
    expect(res.status).toBe(200);
    const chat = await prisma.liveChat.findUniqueOrThrow({ where: { id: body.id } });
    expect(chat.status).toBe("CLOSED");
  });

  it("knows the support hours in Mountain Time", () => {
    expect(supportOnline(new Date("2026-07-01T14:00:00Z"))).toBe(true); // 8 a.m. MDT
    expect(supportOnline(new Date("2026-07-01T05:00:00Z"))).toBe(false); // 11 p.m. MDT
  });
});

describe("staff phone alerts", () => {
  it("sends nothing when no channel is set up", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("NTFY_TOPIC_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(phoneAlertChannels()).toEqual([]);
    expect(await alertStaffPhones({ title: "t", body: "b", url: "https://x/admin/live-chat" })).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pushes to every Telegram chat and to ntfy, and survives a failure", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc");
    vi.stubEnv("TELEGRAM_CHAT_ID", "111, 222");
    vi.stubEnv("NTFY_TOPIC_URL", "https://ntfy.sh/vc-test-topic");
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response("{}", { status: url.includes("ntfy") ? 500 : 200 });
      }),
    );
    const sent = await alertStaffPhones({ title: "New live chat - Vista Chase", body: "Alex is waiting", url: "https://site/admin/live-chat?chat=1" });
    expect(sent).toEqual(["Telegram"]);
    const tg = calls.filter((c) => c.url === "https://api.telegram.org/bot123:abc/sendMessage");
    expect(tg.map((c) => JSON.parse(String(c.init.body)).chat_id)).toEqual(["111", "222"]);
    expect(JSON.parse(String(tg[0].init.body)).text).toContain("https://site/admin/live-chat?chat=1");
    const ntfy = calls.find((c) => c.url === "https://ntfy.sh/vc-test-topic")!;
    expect((ntfy.init.headers as Record<string, string>).Click).toBe("https://site/admin/live-chat?chat=1");
  });
});
