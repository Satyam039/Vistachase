"use client";

// The guest's side of the live chat with the support team (backend modules/support/live-chat.ts).
// Polls GET /api/concierge/live-chat/:id every 3 seconds (less often when the tab is hidden), sends
// with POST .../messages and leaves with POST .../close. The chat's id and token live in
// sessionStorage so a reload of the page resumes the same chat.

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Headset, Phone } from "lucide-react";

export interface StoredChat {
  id: string;
  token: string;
  email: string;
}

interface ChatMessage {
  id: string;
  sender: "GUEST" | "AGENT" | "AI" | "SYSTEM";
  authorName: string | null;
  body: string;
  createdAt: string;
}

interface ChatState {
  status: "WAITING" | "ACTIVE" | "CLOSED";
  agentName: string | null;
  online: boolean;
  messages: ChatMessage[];
}

const KEY = "vc-live-chat";
/** After this long with no agent, the guest is reminded the team will reply by email. */
const NO_AGENT_NOTE_MS = 4 * 60_000;

export function readStoredChat(): StoredChat | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as StoredChat) : null;
    return v && typeof v.id === "string" && typeof v.token === "string" ? v : null;
  } catch {
    return null;
  }
}

export function storeChat(chat: StoredChat) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(chat));
  } catch {
    /* private mode: the chat still works until the page reloads */
  }
}

export function clearStoredChat() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function LiveChatWindow({ chat, onStartOver }: { chat: StoredChat; onStartOver: () => void }) {
  const [state, setState] = useState<ChatState | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [gone, setGone] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const listRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/concierge/live-chat/${encodeURIComponent(chat.id)}?t=${encodeURIComponent(chat.token)}`, { cache: "no-store" });
      if (res.status === 404) {
        setGone(true);
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { chat?: ChatState };
      if (res.ok && json.chat) setState(json.chat);
    } catch {
      /* offline for a moment: the next poll retries */
    }
  }, [chat.id, chat.token]);

  useEffect(() => {
    void load();
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      timer = setTimeout(
        async () => {
          await load();
          setNow(Date.now());
          tick();
        },
        document.hidden ? 15_000 : 3_000,
      );
    };
    tick();
    return () => clearTimeout(timer);
  }, [load]);

  // Keep the newest message in view.
  useEffect(() => {
    const n = state?.messages.length ?? 0;
    if (n !== lastCount.current) {
      lastCount.current = n;
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [state?.messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/concierge/live-chat/${encodeURIComponent(chat.id)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: chat.token, body }),
      });
      const json = (await res.json().catch(() => ({}))) as { chat?: ChatState; error?: string };
      if (!res.ok || !json.chat) throw new Error(json.error || "Your message didn't send. Please try again.");
      setState(json.chat);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your message didn't send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const leave = async () => {
    await fetch(`/api/concierge/live-chat/${encodeURIComponent(chat.id)}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: chat.token }),
    }).catch(() => undefined);
    onStartOver();
  };

  if (gone) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-base text-obsidian-900">This chat is no longer available.</p>
        <button type="button" onClick={onStartOver} className="golden-summit-btn inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm">
          Start a new chat
        </button>
      </div>
    );
  }

  const closed = state?.status === "CLOSED";
  const waiting = state?.status === "WAITING";
  const status = !state
    ? "Connecting…"
    : closed
      ? "Chat ended"
      : state.agentName
        ? `You're chatting with ${state.agentName}`
        : state.online
          ? "Waiting for an agent to join…"
          : "Our team is offline: leave a message";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 bg-obsidian-50 px-4 py-2 text-sm text-slate-700" role="status" aria-live="polite">
        <span className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${closed ? "bg-slate-400" : waiting ? "bg-summit-500" : "bg-emerald-600"}`} aria-hidden="true" />
          {status}
        </span>
        {!closed && (
          <button type="button" onClick={leave} className="text-sm text-ocean-700 underline-offset-4 hover:underline">
            End chat
          </button>
        )}
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-label="Live chat messages">
        {state?.messages.map((m) =>
          m.sender === "SYSTEM" ? (
            <p key={m.id} className="mx-auto max-w-[90%] text-center text-xs leading-relaxed text-slate-600">
              {m.body}
            </p>
          ) : (
            <div key={m.id} className={`flex ${m.sender === "GUEST" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.sender === "GUEST" ? "bg-ocean-600 text-white" : m.sender === "AGENT" ? "bg-summit-100 text-obsidian-900" : "bg-obsidian-50 text-slate-700"
                }`}
              >
                {m.sender !== "GUEST" && (
                  <span className="mb-0.5 flex items-center gap-1 text-xs text-slate-600">
                    {m.sender === "AGENT" && <Headset className="h-3 w-3" aria-hidden="true" />}
                    {m.sender === "AGENT" ? `${m.authorName ?? "Vista Chase"} · Vista Chase` : "AI concierge"}
                  </span>
                )}
                {m.body}
                <span className={`mt-1 block text-right text-xs ${m.sender === "GUEST" ? "text-white/75" : "text-slate-500"}`}>{timeOf(m.createdAt)}</span>
              </div>
            </div>
          ),
        )}
        {waiting && now - startedAt > NO_AGENT_NOTE_MS && (
          <p className="mx-auto max-w-[90%] text-center text-xs leading-relaxed text-slate-600">
            Our team is busy right now. Stay here, or close this window: we&apos;ll reply to {chat.email} by email.
          </p>
        )}
      </div>

      <div className="shrink-0 border-t border-obsidian-900/[0.07] px-4 py-3">
        {closed ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-slate-700">This chat has ended. A copy is with our team.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={onStartOver} className="golden-summit-btn inline-flex h-10 items-center rounded-full px-4 text-sm">
                Start a new chat
              </button>
              <a href="tel:+18257349456" className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm text-ocean-700 ring-1 ring-obsidian-900/15">
                <Phone className="h-4 w-4" aria-hidden="true" />
                Call us
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={send} className="flex items-end gap-2">
            <label htmlFor="live-chat-input" className="sr-only">
              Message to our team
            </label>
            <textarea
              id="live-chat-input"
              rows={1}
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Type a message…"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-obsidian-900/15 bg-white px-3.5 py-2.5 text-base text-obsidian-900 placeholder:text-slate-500 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/25"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              aria-label="Send to our team"
              className="golden-summit-btn inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-60"
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <p className="mt-2 text-center text-xs text-slate-600">Please don&apos;t share card numbers in the chat.</p>
      </div>
    </div>
  );
}
