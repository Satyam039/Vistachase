"use client";

// "Chat with a live agent" in the AI concierge. It hands the conversation to the real support
// team, never to another bot:
//   - With a live chat service connected (NEXT_PUBLIC_CRISP_WEBSITE_ID, read at build time), the
//     Crisp chat opens with the guest's details and the concierge conversation as its first
//     message, so an agent answers in real time.
//   - Without one, it opens our own live chat (POST /api/concierge/live-chat, see
//     LiveChatWindow): staff are alerted on their phones and in Admin → Live chat, and answer here
//     in real time. The chat is also saved as an enquiry, so the team replies by email if they
//     miss it. The chat id and token stay in sessionStorage, so a reload resumes it.

import { useEffect, useState } from "react";
import { Headset, X } from "lucide-react";
import { LiveChatWindow, clearStoredChat, readStoredChat, storeChat, type StoredChat } from "./LiveChatWindow";

export interface TranscriptLine {
  role: "user" | "assistant";
  content: string;
}

const CRISP_ID = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;

type CrispWindow = Window & { $crisp?: unknown[][]; CRISP_WEBSITE_ID?: string };

function openCrisp(transcript: TranscriptLine[], name: string, email: string) {
  const w = window as CrispWindow;
  if (!w.$crisp) {
    w.$crisp = [];
    w.CRISP_WEBSITE_ID = CRISP_ID;
    const s = document.createElement("script");
    s.src = "https://client.crisp.chat/l.js";
    s.async = true;
    document.head.appendChild(s);
  }
  if (email) w.$crisp.push(["set", "user:email", [email]]);
  if (name) w.$crisp.push(["set", "user:nickname", [name]]);
  if (transcript.length) {
    const text = transcript.map((m) => `${m.role === "user" ? "Me" : "AI concierge"}: ${m.content}`).join("\n\n");
    w.$crisp.push(["do", "message:send", ["text", `My conversation with the AI concierge:\n\n${text.slice(-6000)}`]]);
  }
  w.$crisp.push(["do", "chat:open"]);
}

const FIELD =
  "h-11 w-full rounded-xl border border-obsidian-900/15 bg-white px-3 text-base text-obsidian-900 placeholder:text-slate-500 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/25";

export function LiveAgentHandoff({ transcript, language, onClose }: { transcript: TranscriptLine[]; language: string | null; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState("");
  const [chat, setChat] = useState<StoredChat | null>(null);

  // Resume a live chat started earlier in this tab.
  useEffect(() => {
    if (!CRISP_ID) setChat(readStoredChat());
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (CRISP_ID) {
      openCrisp(transcript, name.trim(), email.trim());
      onClose();
      return;
    }
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/concierge/live-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          note,
          language: language ?? undefined,
          page: window.location.pathname,
          transcript,
          website: (new FormData(e.currentTarget).get("website") as string) || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; id?: string; token?: string };
      if (!res.ok || !json.id || !json.token) throw new Error(json.error || "We couldn't start the chat just now.");
      const started = { id: json.id, token: json.token, email: email.trim() };
      storeChat(started);
      setChat(started);
      setState("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't send that just now.");
      setState("error");
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="live-agent-title" className="absolute inset-0 z-20 flex flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-obsidian-900/[0.07] px-4 py-3">
        <p id="live-agent-title" className="flex items-center gap-2 text-base text-obsidian-900">
          <Headset className="h-5 w-5 text-ocean-600" aria-hidden="true" />
          Chat with a live agent
        </p>
        <button type="button" onClick={onClose} aria-label="Back to the concierge" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-obsidian-900/[0.06]">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {chat ? (
        <LiveChatWindow
          chat={chat}
          onStartOver={() => {
            clearStoredChat();
            setChat(null);
          }}
        />
      ) : (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto w-full max-w-md">
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm leading-relaxed text-slate-700">
                {CRISP_ID
                  ? "We'll open a chat with our support team and share your conversation with the concierge."
                  : "Chat with our support team here. They'll see your conversation with the concierge and reply in this window (6 a.m. – 9 p.m. Mountain Time). If they miss you, they'll reply by email."}
              </p>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-700">Your name</span>
                <input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={FIELD} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-700">Email</span>
                <input required type="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={FIELD} />
              </label>
              {!CRISP_ID && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-sm text-slate-700">Phone (optional)</span>
                    <input type="tel" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" className={FIELD} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm text-slate-700">{transcript.length ? "Anything to add? (optional)" : "How can we help?"}</span>
                    <textarea rows={3} maxLength={2000} required={transcript.length === 0} value={note} onChange={(e) => setNote(e.target.value)} className={`${FIELD} h-auto py-2.5`} />
                  </label>
                </>
              )}
              {/* Honeypot for bots: hidden from people and assistive technology. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label>
                  Website
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              <p className="text-xs text-slate-600">
                {transcript.length ? `${transcript.length} message${transcript.length === 1 ? "" : "s"} from this chat will be shared.` : "Your note goes to the team with your details."}
              </p>
              {state === "error" && (
                <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-800">
                  {error} You can also call +1 (825) 734-9456 or email support@vistachase.com.
                </p>
              )}
              <button type="submit" disabled={state === "sending"} className="golden-summit-btn inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm disabled:opacity-70">
                <Headset className="h-4 w-4" aria-hidden="true" />
                {state === "sending" ? "Connecting…" : "Start live chat"}
              </button>
            </form>
        </div>
      </div>
      )}
    </div>
  );
}
