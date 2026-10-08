"use client";

// The AI concierge conversation, shared by the floating side panel and the full /concierge page.
// Layout follows the chat apps people already know (ChatGPT, Claude, Gemini, Cursor):
//   empty state  greeting + suggestion chips, centred
//   messages     assistant replies as plain text beside a small avatar; the visitor's messages
//                in soft right-aligned bubbles; booking cards attached under replies
//   composer     one rounded box pinned at the bottom: auto-growing text field, mic (voice
//                input) and send; Enter sends, Shift+Enter adds a line
// Voice: the mic uses the browser's speech recognition; replies can be read aloud (toggle in
// the header), and speaking stops as soon as the visitor types, talks or taps Stop.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUp, Maximize2, Mic, RotateCcw, Square, Volume2, VolumeX, X, Sparkles, MapPin, Sunrise, Ticket, Navigation } from "lucide-react";
import { VoiceBookingCardStream, type VoiceCardData } from "./VoiceBookingCardStream";

interface Message {
  id: string;
  role: "assistant" | "user";
  text: string;
  data?: VoiceCardData;
  checkoutUrl?: string;
  hasSafetyRefusal?: boolean;
}

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

const SUGGESTIONS = [
  { icon: Sunrise, text: "How do I see sunrise at Moraine Lake?" },
  { icon: MapPin, text: "Where do you pick up in Banff?" },
  { icon: Ticket, text: "Book the shared Banff tour for 2 adults" },
  { icon: Navigation, text: "Where is my shuttle?" },
];

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

export function ConciergeChat({ variant, onClose }: { variant: "panel" | "page"; onClose?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [voice, setVoice] = useState<VoiceState>("idle");
  const [speakReplies, setSpeakReplies] = useState(false);
  const [session, setSession] = useState<Record<string, unknown>>({});
  const [micSupported, setMicSupported] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const sendRef = useRef<(text: string) => void>(() => {});

  // Keep the newest message in view.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, voice]);

  // Auto-grow the composer (up to ~8 lines).
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setVoice((v) => (v === "speaking" ? "idle" : v));
  }, []);

  // Stop any speech when the chat goes away.
  useEffect(() => stopSpeaking, [stopSpeaking]);

  const speak = useCallback(
    (text: string) => {
      if (!speakReplies || !("speechSynthesis" in window)) {
        setVoice("idle");
        return;
      }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[*#•_]/g, " ").replace(/\s+/g, " "));
      u.onstart = () => setVoice("speaking");
      u.onend = () => setVoice("idle");
      u.onerror = () => setVoice("idle");
      window.speechSynthesis.speak(u);
    },
    [speakReplies],
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || voice === "thinking") return;
      stopSpeaking();
      const next = [...messages, { id: `u-${Date.now()}`, role: "user" as const, text }];
      setMessages(next);
      setInput("");
      setVoice("thinking");
      // Streamed reply (Server-Sent Events): text deltas fill the reply as it's written, status
      // events say what the concierge is doing, "done" carries cards and session memory.
      const id = `a-${Date.now()}`;
      let started = false;
      const patch = (fn: (m: Message) => Message) => setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
      try {
        const res = await fetch("/api/concierge/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.text })), sessionState: session }),
        });
        if (res.status === 429) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "rate");
        }
        if (!res.ok || !res.body) throw new Error("bad response");
        setMessages((prev) => [...prev, { id, role: "assistant", text: "" }]);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalText = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let cut: number;
          while ((cut = buffer.indexOf("\n\n")) !== -1) {
            const raw = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            const event = raw.match(/^event: (.+)$/m)?.[1];
            const data = raw.match(/^data: (.*)$/m)?.[1];
            if (!event || !data) continue;
            const payload = JSON.parse(data);
            if (event === "status") setStatus(payload.text);
            if (event === "text") {
              if (!started) {
                started = true;
                setVoice("idle");
              }
              setStatus(null);
              finalText += payload.text;
              patch((m) => ({ ...m, text: m.text + payload.text }));
            }
            if (event === "done") {
              setStatus(null);
              finalText = payload.message ?? finalText;
              patch((m) => ({ ...m, text: finalText, data: payload.data, checkoutUrl: payload.checkoutUrl, hasSafetyRefusal: payload.hasSafetyRefusal }));
              if (payload.sessionState) setSession(payload.sessionState);
            }
            if (event === "error") throw new Error(payload.error);
          }
        }
        setVoice("idle");
        if (finalText) speak(finalText.split("\n\nSources:")[0]);
      } catch (err) {
        setStatus(null);
        const msg = err instanceof Error && err.message && !["bad response", "rate"].includes(err.message) && !err.message.startsWith("Failed")
          ? err.message
          : "Sorry, I couldn't reach our trip system just now. Please try again in a moment.";
        setMessages((prev) => [...prev.filter((m) => !(m.id === id && !m.text)), { id: `e-${Date.now()}`, role: "assistant", text: msg }]);
        setVoice("idle");
      }
    },
    [messages, session, voice, speak, stopSpeaking],
  );
  sendRef.current = send;

  // Voice input (browser speech recognition), created once.
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setMicSupported(false);
      return;
    }
    const r = new Ctor();
    r.lang = "en-CA";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript;
      if (transcript) sendRef.current(transcript);
    };
    r.onerror = () => setVoice((v) => (v === "listening" ? "idle" : v));
    r.onend = () => setVoice((v) => (v === "listening" ? "idle" : v));
    recognition.current = r;
  }, []);

  const toggleMic = () => {
    if (!recognition.current) return;
    if (voice === "listening") {
      recognition.current.stop();
      setVoice("idle");
      return;
    }
    stopSpeaking();
    try {
      recognition.current.start();
      setVoice("listening");
    } catch {
      setVoice("idle");
    }
  };

  const reset = () => {
    stopSpeaking();
    setMessages([]);
    setSession({});
    setInput("");
    field.current?.focus();
  };

  const empty = messages.length === 0;
  const page = variant === "page";

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-obsidian-900">
      {/* Header */}
      <div className={`flex shrink-0 items-center justify-between gap-3 border-b border-obsidian-900/[0.07] ${page ? "px-page py-3" : "px-4 py-3"}`}>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-obsidian-900 text-summit-400">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            {page ? (
              <h1 className="truncate text-base text-obsidian-900">Vista Chase Concierge</h1>
            ) : (
              <h2 className="truncate text-base text-obsidian-900">Vista Chase Concierge</h2>
            )}
            <p className="truncate text-xs text-slate-600">Tours, pickups and bookings in the Rockies</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!empty && (
            <IconButton label="New chat" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
            </IconButton>
          )}
          <IconButton
            label="Read replies aloud"
            pressed={speakReplies}
            onClick={() => {
              stopSpeaking();
              setSpeakReplies((s) => !s);
            }}
          >
            {speakReplies ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </IconButton>
          {!page && (
            <Link
              href="/concierge"
              onClick={onClose}
              aria-label="Open full screen"
              title="Open full screen"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-obsidian-900/[0.06] hover:text-obsidian-900"
            >
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
          {onClose && (
            <IconButton label="Close concierge" onClick={onClose}>
              <X className="h-5 w-5" />
            </IconButton>
          )}
        </div>
      </div>

      {/* Conversation */}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto" role="log" aria-live="polite" aria-label="Conversation" tabIndex={0}>
        <div className={`mx-auto flex min-h-full w-full flex-col ${page ? "max-w-3xl px-page" : "px-4"} py-6`}>
          {empty ? (
            <div className="my-auto flex flex-col items-center py-8 text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-obsidian-900 text-summit-400">
                <Sparkles className="h-6 w-6" aria-hidden="true" />
              </span>
              <p className={`mt-5 font-light tracking-tight text-obsidian-900 ${page ? "text-4xl" : "text-2xl"}`}>Where to in the Rockies?</p>
              <p className="mt-2 max-w-sm text-base text-slate-600">Ask about tours, hotel pickups and Moraine Lake access, or book seats right here.</p>
              <ul className={`mt-8 grid w-full gap-2.5 ${page ? "sm:grid-cols-2" : ""}`}>
                {SUGGESTIONS.map(({ icon: Icon, text }) => (
                  <li key={text}>
                    <button
                      type="button"
                      onClick={() => send(text)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-obsidian-900/10 px-4 py-3 text-left text-sm text-obsidian-900 transition-colors hover:border-obsidian-900/25 hover:bg-obsidian-50"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-ocean-600" aria-hidden="true" />
                      {text}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ol className="space-y-6">
              {messages.map((m) =>
                m.role === "assistant" && !m.text ? null : m.role === "user" ? (
                  <li key={m.id} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-obsidian-100 px-4 py-2.5 text-[15px] leading-relaxed text-obsidian-900">
                      <span className="sr-only">You: </span>
                      {m.text}
                    </p>
                  </li>
                ) : (
                  <li key={m.id} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-obsidian-900 text-summit-400" aria-hidden="true">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-obsidian-900">
                        <span className="sr-only">Concierge: </span>
                        <Linkified text={m.text} />
                      </p>
                      <VoiceBookingCardStream
                        data={m.data}
                        checkoutUrl={m.checkoutUrl}
                        hasSafetyRefusal={m.hasSafetyRefusal}
                        onSelectDeparture={(dep) => send(`I choose the departure on ${dep.date} at ${dep.departureTime}`)}
                        onSelectPickup={(name) => send(`Pickup at ${name}`)}
                      />
                    </div>
                  </li>
                ),
              )}
              {voice === "thinking" && (
                <li className="flex items-center gap-3" aria-label={status ?? "The concierge is typing"}>
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-obsidian-900 text-summit-400" aria-hidden="true">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex gap-1" aria-hidden="true">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="h-2 w-2 rounded-full bg-slate-400 motion-safe:animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                  {status && <span className="text-sm text-slate-600">{status}</span>}
                </li>
              )}
            </ol>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className={`shrink-0 ${page ? "px-page pb-5" : "px-4 pb-4"}`}>
        <div className={`mx-auto w-full ${page ? "max-w-3xl" : ""}`}>
          {voice === "speaking" && (
            <div className="mb-2 flex justify-center">
              <button
                type="button"
                onClick={stopSpeaking}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-obsidian-900/15 bg-white px-4 text-sm text-obsidian-900 shadow-sm hover:bg-obsidian-50"
              >
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                Stop reading
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="rounded-[1.75rem] border border-obsidian-900/15 bg-white p-2 shadow-[0_8px_30px_-12px_rgba(12,31,33,0.25)] focus-within:border-obsidian-900/30"
          >
            <label htmlFor={`concierge-input-${variant}`} className="sr-only">
              Message the concierge
            </label>
            <textarea
              id={`concierge-input-${variant}`}
              ref={field}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (voice === "speaking") stopSpeaking();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={voice === "listening" ? "Listening…" : "Ask anything about your Rockies trip"}
              className="block max-h-[200px] w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed text-obsidian-900 placeholder:text-slate-500 focus:outline-none"
            />
            <div className="flex items-center justify-between gap-2 px-1 pt-1">
              {micSupported ? (
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label={voice === "listening" ? "Stop voice input" : "Speak your message"}
                  className={`inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm transition-colors ${
                    voice === "listening" ? "bg-red-600 text-white" : "text-slate-700 hover:bg-obsidian-900/[0.06] hover:text-obsidian-900"
                  }`}
                >
                  <Mic className={`h-4 w-4 ${voice === "listening" ? "motion-safe:animate-pulse" : ""}`} aria-hidden="true" />
                  {voice === "listening" ? "Listening… tap to stop" : "Voice"}
                </button>
              ) : (
                <span />
              )}
              <button
                type="submit"
                disabled={!input.trim() || voice === "thinking"}
                aria-label="Send message"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-obsidian-900 text-white transition-colors hover:bg-obsidian-800 disabled:bg-obsidian-900/15 disabled:text-slate-500"
              >
                <ArrowUp className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </form>
          <p className="mt-2 text-center text-xs text-slate-600">
            The concierge can make mistakes, so check key details. It never asks for card numbers.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Turns bare URLs and site paths in a reply (web sources, checkout links, /cancellation-policy)
 * into links. Site paths must start a word ("/faq", not "and/or"); trailing punctuation stays text. */
const LINK = /(https?:\/\/[^\s)]+|(?<=^|[\s(])\/[a-z][a-z0-9-]*(?:\/[A-Za-z0-9._~%-]+)*\/?(?:\?[^\s)]*)?)/g;
function Linkified({ text }: { text: string }) {
  const out: ReactNode[] = [];
  text.split(LINK).forEach((part, i) => {
    if (i % 2 === 0) {
      if (part) out.push(<span key={i}>{part}</span>);
      return;
    }
    const href = part.replace(/[.,;:!?]+$/, "");
    const tail = part.slice(href.length);
    const external = href.startsWith("http");
    out.push(
      <a
        key={i}
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="break-all text-ocean-700 underline underline-offset-2 hover:text-ocean-900"
      >
        {external ? href.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60) : href}
      </a>,
    );
    if (tail) out.push(<span key={`${i}t`}>{tail}</span>);
  });
  return (
    <>
      {out}
    </>
  );
}

function IconButton({ label, onClick, pressed, children }: { label: string; onClick: () => void; pressed?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-obsidian-900/[0.06] hover:text-obsidian-900"
    >
      {children}
    </button>
  );
}
