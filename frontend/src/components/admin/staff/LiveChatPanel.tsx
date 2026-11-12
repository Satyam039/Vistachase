"use client";

// Admin → Live chat: guests who tapped "Chat with a live agent" in the AI concierge. Chats waiting
// for an answer are listed first; opening one shows the concierge conversation that came before,
// and a reply goes straight to the guest's chat window. Lists refresh every 5 seconds and the
// open chat every 3. Reads /api/admin/live-chats (backend modules/support/live-chat.ts).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Headset, Mail, Phone, Send } from "lucide-react";
import { Chip, adminApi, errorOf, isDenied, quietBtn, when } from "@/components/admin/staff/shared";

type Status = "WAITING" | "ACTIVE" | "CLOSED";

interface ChatRow {
  id: string;
  name: string;
  email: string;
  status: Status;
  agentName: string | null;
  needsAnswer: boolean;
  createdAt: string;
  lastMessage: { sender: string; body: string; createdAt: string } | null;
}

interface Message {
  id: string;
  sender: "GUEST" | "AGENT" | "AI" | "SYSTEM";
  authorName: string | null;
  body: string;
  createdAt: string;
}

interface ChatDetail extends Omit<ChatRow, "lastMessage"> {
  phone: string | null;
  page: string | null;
  language: string | null;
  messages: Message[];
}

const STATUS_STYLE: Record<Status, string> = {
  WAITING: "bg-summit-100 text-obsidian-900",
  ACTIVE: "bg-emerald-50 text-emerald-800",
  CLOSED: "bg-obsidian-100 text-slate-700",
};
const STATUS_LABEL: Record<Status, string> = { WAITING: "Waiting", ACTIVE: "Active", CLOSED: "Ended" };

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", timeZone: "America/Edmonton" });

export function LiveChatPanel({ onDenied }: { onDenied: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("chat");
  const [rows, setRows] = useState<ChatRow[] | null>(null);
  const [phoneAlerts, setPhoneAlerts] = useState<string[]>([]);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState("");

  const loadList = useCallback(async () => {
    const r = await adminApi<{ chats: ChatRow[]; phoneAlerts: string[]; online: boolean }>("/live-chats");
    if (isDenied(r.status)) return onDenied();
    if (!r.ok) return setError(errorOf(r.data, "Couldn't load live chats."));
    setError("");
    setRows(r.data.chats);
    setPhoneAlerts(r.data.phoneAlerts);
    setOnline(r.data.online);
  }, [onDenied]);

  useEffect(() => {
    void loadList();
    const t = setInterval(() => void loadList(), 5000);
    return () => clearInterval(t);
  }, [loadList]);

  const open = (id: string | null) => router.replace(id ? `/admin/live-chat?chat=${encodeURIComponent(id)}` : "/admin/live-chat", { scroll: false });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        {phoneAlerts.length
          ? `New chats also alert your phones by ${phoneAlerts.join(" and ")}, and the support inbox gets an email.`
          : "New chats chime on this screen and email the support inbox. Phone alerts aren't set up yet: add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (or NTFY_TOPIC_URL) to the server's .env."}
        {!online && " Support hours are over (6 a.m. – 9 p.m. MT), so guests are told you may reply by email."}
      </p>
      {error && (
        <p role="alert" className="bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section aria-label="Chats" className={`bg-white ring-1 ring-obsidian-900/[0.07] ${selected ? "hidden lg:block" : ""}`}>
          {rows === null ? (
            <p className="px-5 py-10 text-center text-sm text-slate-600">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-600">No live chats in the last 24 hours.</p>
          ) : (
            <ul className="divide-y divide-obsidian-900/[0.06]">
              {rows.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => open(c.id)}
                    aria-current={c.id === selected ? "true" : undefined}
                    className={`block w-full px-5 py-4 text-left hover:bg-obsidian-50 ${c.id === selected ? "bg-ocean-50" : ""}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-base text-obsidian-900">
                        {c.needsAnswer && <span className="h-2.5 w-2.5 rounded-full bg-summit-500" aria-label="Needs an answer" />}
                        {c.name}
                      </span>
                      <Chip className={STATUS_STYLE[c.status]}>{STATUS_LABEL[c.status]}</Chip>
                    </span>
                    {c.lastMessage && (
                      <span className="mt-1 block truncate text-sm text-slate-600">
                        {c.lastMessage.sender === "AGENT" ? "You: " : ""}
                        {c.lastMessage.body}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-slate-500">
                      {when(c.createdAt)}
                      {c.agentName ? ` · ${c.agentName}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {selected ? (
          <ChatView key={selected} id={selected} onBack={() => open(null)} onChanged={loadList} onDenied={onDenied} />
        ) : (
          <section className="hidden items-center justify-center bg-white px-6 py-16 text-center ring-1 ring-obsidian-900/[0.07] lg:flex">
            <p className="text-base text-slate-600">
              <Headset className="mx-auto mb-3 h-8 w-8 text-ocean-600" aria-hidden="true" />
              Pick a chat to answer it.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function ChatView({ id, onBack, onChanged, onDenied }: { id: string; onBack: () => void; onChanged: () => void; onDenied: () => void }) {
  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  const load = useCallback(async () => {
    const r = await adminApi<{ chat: ChatDetail }>(`/live-chats/${encodeURIComponent(id)}`);
    if (isDenied(r.status)) return onDenied();
    if (!r.ok) return setError(errorOf(r.data, "Couldn't load this chat."));
    setChat(r.data.chat);
  }, [id, onDenied]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const n = chat?.messages.length ?? 0;
    if (n !== count.current) {
      // A new message here also changes the chat list (last message, needs an answer).
      if (count.current) onChanged();
      count.current = n;
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }
  }, [chat?.messages.length, onChanged]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    const r = await adminApi<{ chat: ChatDetail }>(`/live-chats/${encodeURIComponent(id)}/messages`, "POST", { body: text });
    setBusy(false);
    if (!r.ok) return setError(errorOf(r.data, "Your reply didn't send."));
    setChat(r.data.chat);
    setText("");
    onChanged();
  };

  const close = async () => {
    if (!window.confirm("End this chat? The guest can start a new one from the concierge.")) return;
    const r = await adminApi<{ chat: ChatDetail }>(`/live-chats/${encodeURIComponent(id)}/close`, "POST", {});
    if (!r.ok) return setError(errorOf(r.data, "Couldn't end the chat."));
    setChat(r.data.chat);
    onChanged();
  };

  return (
    <section aria-label="Conversation" className="flex min-h-[32rem] flex-col bg-white ring-1 ring-obsidian-900/[0.07] lg:h-[calc(100vh-16rem)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-obsidian-900/[0.06] px-5 py-4">
        <div className="min-w-0">
          <button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-sm text-ocean-700 lg:hidden">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All chats
          </button>
          <h2 className="text-xl text-obsidian-900">{chat?.name ?? "Loading…"}</h2>
          {chat && (
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <a href={`mailto:${chat.email}`} className="inline-flex items-center gap-1 text-ocean-700 hover:underline">
                <Mail className="h-4 w-4" aria-hidden="true" />
                {chat.email}
              </a>
              {chat.phone && (
                <a href={`tel:${chat.phone}`} className="inline-flex items-center gap-1 text-ocean-700 hover:underline">
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {chat.phone}
                </a>
              )}
              {chat.page && <span>From {chat.page}</span>}
              {chat.language && chat.language !== "en" && <span>Language: {chat.language}</span>}
            </p>
          )}
        </div>
        {chat && (
          <div className="flex items-center gap-2">
            <Chip className={STATUS_STYLE[chat.status]}>{STATUS_LABEL[chat.status]}</Chip>
            {chat.status !== "CLOSED" && (
              <button type="button" onClick={close} className={quietBtn}>
                End chat
              </button>
            )}
          </div>
        )}
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-obsidian-50 px-5 py-4">
        {chat?.messages.map((m) =>
          m.sender === "SYSTEM" ? (
            <p key={m.id} className="text-center text-xs text-slate-600">
              {m.body} · {time(m.createdAt)}
            </p>
          ) : (
            <div key={m.id} className={`flex ${m.sender === "AGENT" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.sender === "AGENT" ? "bg-ocean-600 text-white" : m.sender === "GUEST" ? "bg-white text-obsidian-900 ring-1 ring-obsidian-900/10" : "bg-obsidian-100 text-slate-700"
                }`}
              >
                <span className={`mb-0.5 block text-xs ${m.sender === "AGENT" ? "text-white/80" : "text-slate-600"}`}>
                  {m.sender === "AGENT" ? m.authorName ?? "Agent" : m.sender === "AI" ? "AI concierge" : chat?.name} · {time(m.createdAt)}
                </span>
                {m.body}
              </div>
            </div>
          ),
        )}
      </div>

      <div className="border-t border-obsidian-900/[0.06] px-5 py-4">
        {chat?.status === "CLOSED" ? (
          <p className="text-sm text-slate-600">This chat has ended. To follow up, email {chat.email}.</p>
        ) : (
          <form onSubmit={send} className="flex items-end gap-2">
            <label htmlFor="agent-reply" className="sr-only">
              Reply to the guest
            </label>
            <textarea
              id="agent-reply"
              rows={2}
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={chat?.status === "WAITING" ? "Say hello to join the chat…" : "Type your reply…"}
              className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base text-obsidian-900 focus:border-ocean-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600"
            />
            <button type="submit" disabled={busy || !text.trim()} className="inline-flex h-11 items-center gap-2 rounded-full bg-ocean-600 px-5 text-sm text-white hover:bg-ocean-700 disabled:opacity-60">
              <Send className="h-4 w-4" aria-hidden="true" />
              Send
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-800">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
