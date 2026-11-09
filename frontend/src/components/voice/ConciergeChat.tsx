"use client";

// The AI concierge conversation, shared by the floating side panel and the full /concierge page.
// Layout follows the chat apps people already know (ChatGPT, Claude, Gemini, Cursor):
//   empty state  greeting + suggestion chips, centred
//   messages     assistant replies as plain text beside a small avatar; the visitor's messages
//                in soft right-aligned bubbles; booking cards attached under replies
//   composer     one rounded box pinned at the bottom: auto-growing text field, mic (voice
//                input) and send; Enter sends, Shift+Enter adds a line
// Language: a selector beside the mic (Auto = reply in the guest's language); the choice is sent
// with each message and remembered on this device. "Chat with a live agent" hands the
// conversation to the support team (LiveAgentHandoff).
// Voice: the mic uses the browser's speech recognition; replies can be read aloud (toggle in
// the header), and speaking stops as soon as the visitor types, talks or taps Stop.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUp, Brain, Clock, FileText, Globe, Headset, Image as ImageIcon, LayoutGrid, Maximize2, Mic, Navigation, Paperclip, RotateCcw, Smile, Sparkles, Square, Sunrise, Ticket, Volume2, VolumeX, X, MapPin } from "lucide-react";
import { VoiceBookingCardStream, type VoiceCardData } from "./VoiceBookingCardStream";
import { ConciergeMarkdownRenderer } from "./ConciergeMarkdownRenderer";
import { ConciergeHistoryDrawer, type ChatSessionMeta } from "./ConciergeHistoryDrawer";
import { LiveAgentHandoff } from "./LiveAgentHandoff";
import { CONCIERGE_LANGUAGES, speechTag } from "@/lib/conciergeLanguages";

const LANGUAGE_KEY = "vc-concierge-language";
const CHAT_SESSIONS_KEY = "vc_concierge_sessions";
const PERSONA_KEY = "vc_user_persona_graph";

export interface MessageAttachment {
  name: string;
  mediaType: string;
  previewUrl?: string;
  base64?: string;
}

export interface StagedAttachment {
  id: string;
  name: string;
  mediaType: string;
  size: number;
  previewUrl?: string;
  base64?: string;
}

interface StoredChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  sessionState?: Record<string, unknown>;
}

interface Message {
  id: string;
  role: "assistant" | "user";
  text: string;
  attachments?: MessageAttachment[];
  thinkingMode?: "standard" | "deep";
  data?: VoiceCardData | { type: "handoff" };
  checkoutUrl?: string;
  hasSafetyRefusal?: boolean;
}

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

const SUGGESTIONS = [
  { icon: Sunrise, text: "How do I see sunrise at Moraine Lake?" },
  { icon: LayoutGrid, text: "Show me the 12-seat Sprinter seat map" },
  { icon: MapPin, text: "Where do you pick up in Banff?" },
  { icon: Sparkles, text: "Why is Lake Louise so blue?" },
  { icon: Ticket, text: "Book the shared Banff tour for 2 adults" },
  { icon: Smile, text: "Can I pet the bears or ride an elk in Banff?" },
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
  const [language, setLanguage] = useState<string | null>(null);
  const [handoff, setHandoff] = useState(false);
  const [sessions, setSessions] = useState<StoredChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [userPersona, setUserPersona] = useState<any>(null);
  const [knowledgeGraph, setKnowledgeGraph] = useState<any>(null);
  const [thinkingMode, setThinkingMode] = useState<"standard" | "deep">("standard");
  const [stagedFiles, setStagedFiles] = useState<StagedAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const sendRef = useRef<(text: string) => void>(() => {});

  // The language, chat history sessions, and traveler persona loaded on mount
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem(LANGUAGE_KEY);
      if (savedLang && CONCIERGE_LANGUAGES.some((l) => l.code === savedLang)) setLanguage(savedLang);

      const savedSessions = localStorage.getItem(CHAT_SESSIONS_KEY);
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed)) setSessions(parsed);
      }

      const savedPersona = localStorage.getItem(PERSONA_KEY);
      if (savedPersona) {
        const parsedP = JSON.parse(savedPersona);
        if (parsedP?.persona) setUserPersona(parsedP.persona);
        if (parsedP?.graph) setKnowledgeGraph(parsedP.graph);
      }
    } catch {
      // storage blocked: stay on defaults
    }
  }, []);

  const chooseLanguage = (code: string) => {
    const next = code || null;
    setLanguage(next);
    try {
      if (next) localStorage.setItem(LANGUAGE_KEY, next);
      else localStorage.removeItem(LANGUAGE_KEY);
    } catch {
      // storage blocked: the choice lasts for this visit
    }
  };

  const handleFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;

    list.slice(0, 5).forEach((file) => {
      const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const isImage = file.type.startsWith("image/");
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined;

      const reader = new FileReader();
      reader.onload = () => {
        const result = (reader.result as string) || "";
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        setStagedFiles((prev) => [
          ...prev,
          {
            id,
            name: file.name,
            mediaType: file.type || "application/octet-stream",
            size: file.size,
            previewUrl,
            base64,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (id: string) => {
    setStagedFiles((prev) => {
      const found = prev.find((x) => x.id === id);
      if (found?.previewUrl) {
        try {
          URL.revokeObjectURL(found.previewUrl);
        } catch {}
      }
      return prev.filter((x) => x.id !== id);
    });
  };

  const selectSession = (id: string) => {
    const s = sessions.find((x) => x.id === id);
    if (!s) return;
    setCurrentSessionId(s.id);
    setMessages(s.messages || []);
    setSession(s.sessionState || {});
    stopSpeaking();
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setSession({});
    setInput("");
    setStagedFiles([]);
    stopSpeaking();
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => {
      const nextList = prev.filter((s) => s.id !== id);
      try {
        localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(nextList));
      } catch {}
      return nextList;
    });
    if (currentSessionId === id) {
      startNewChat();
    }
  };

  const clearAllSessions = () => {
    setSessions([]);
    try {
      localStorage.removeItem(CHAT_SESSIONS_KEY);
    } catch {}
    startNewChat();
  };

  // Keep the newest message in view. Before the first message the welcome starts at its top, so a
  // phone's short screen doesn't hide the greeting under the header (mobile check, 9 Nov 2026).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (messages.length === 0) el.scrollTo({ top: 0 });
    else el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
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
      if (language) u.lang = speechTag(language);
      u.onstart = () => setVoice("speaking");
      u.onend = () => setVoice("idle");
      u.onerror = () => setVoice("idle");
      window.speechSynthesis.speak(u);
    },
    [speakReplies, language],
  );

  const send = useCallback(
    async (raw: string, explicitAttachments?: StagedAttachment[]) => {
      const currentAttachments = explicitAttachments ?? stagedFiles;
      let text = (raw || "").trim();
      if (!text && currentAttachments.length === 0) return;
      if (voice === "thinking") return;
      if (!text && currentAttachments.length > 0) {
        text = "Please inspect and help me with this photo/document for my Canadian Rockies trip.";
      }
      stopSpeaking();

      const userAttachments: MessageAttachment[] = currentAttachments.map((a) => ({
        name: a.name,
        mediaType: a.mediaType,
        previewUrl: a.previewUrl,
        base64: a.base64,
      }));

      const next: Message[] = [
        ...messages,
        {
          id: `u-${Date.now()}`,
          role: "user" as const,
          text,
          attachments: userAttachments.length > 0 ? userAttachments : undefined,
          thinkingMode,
        },
      ];
      setMessages(next);
      setInput("");
      setStagedFiles([]);
      setVoice("thinking");

      const sessionId = currentSessionId || `session-${Date.now()}`;
      if (!currentSessionId) setCurrentSessionId(sessionId);

      // Streamed reply (Server-Sent Events): text deltas fill the reply as it's written, status
      // events say what the concierge is doing, "done" carries cards and session memory.
      const id = `a-${Date.now()}`;
      let started = false;
      const patch = (fn: (m: Message) => Message) => setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
      try {
        const sessionPayload = {
          ...session,
          userPersona: userPersona || undefined,
          knowledgeGraph: knowledgeGraph || undefined,
        };

        const res = await fetch("/api/concierge/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({
            messages: next.map((m) => ({ role: m.role, content: m.text })),
            sessionState: sessionPayload,
            language: language ?? undefined,
            thinkingMode,
            attachments: userAttachments.length > 0
              ? userAttachments.map((a) => ({
                  name: a.name,
                  mediaType: a.mediaType,
                  base64: a.base64 || "",
                }))
              : undefined,
          }),
        });
        if (res.status === 429) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "rate");
        }
        if (!res.ok || !res.body) throw new Error("bad response");
        setMessages((prev) => [...prev, { id, role: "assistant", text: "", thinkingMode }]);
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
            const rawEvent = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            const event = rawEvent.match(/^event: (.+)$/m)?.[1];
            const data = rawEvent.match(/^data: (.*)$/m)?.[1];
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
              patch((m) => ({ ...m, text: finalText, data: payload.data, checkoutUrl: payload.checkoutUrl, hasSafetyRefusal: payload.hasSafetyRefusal, thinkingMode }));
              
              const updatedState = payload.sessionState ?? session;
              if (payload.sessionState) {
                setSession(payload.sessionState);
                if (payload.sessionState.userPersona) {
                  setUserPersona(payload.sessionState.userPersona);
                }
                if (payload.sessionState.knowledgeGraph) {
                  setKnowledgeGraph(payload.sessionState.knowledgeGraph);
                }
                try {
                  localStorage.setItem(
                    PERSONA_KEY,
                    JSON.stringify({
                      persona: payload.sessionState.userPersona || userPersona,
                      graph: payload.sessionState.knowledgeGraph || knowledgeGraph,
                    })
                  );
                } catch {}
              }

              // Persist conversation to sessions list
              const assistantMessage: Message = {
                id,
                role: "assistant",
                text: finalText,
                data: payload.data,
                checkoutUrl: payload.checkoutUrl,
                hasSafetyRefusal: payload.hasSafetyRefusal,
                thinkingMode,
              };
              const updatedSessionMessages = [...next, assistantMessage];

              setSessions((prev) => {
                const existing = prev.find((s) => s.id === sessionId);
                const title = existing?.title || (text.length > 36 ? `${text.slice(0, 36)}…` : text);
                const newSessionItem: StoredChatSession = {
                  id: sessionId,
                  title,
                  createdAt: existing?.createdAt || Date.now(),
                  updatedAt: Date.now(),
                  messages: updatedSessionMessages,
                  sessionState: updatedState,
                };
                const nextList = [newSessionItem, ...prev.filter((s) => s.id !== sessionId)].slice(0, 40);
                try {
                  localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(nextList));
                } catch {}
                return nextList;
              });
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
    [messages, session, voice, speak, stopSpeaking, language, currentSessionId, userPersona, knowledgeGraph, thinkingMode, stagedFiles],
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

  useEffect(() => {
    if (recognition.current) recognition.current.lang = speechTag(language);
  }, [language]);

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
    <div className="relative flex h-full min-h-0 flex-col bg-white text-obsidian-900">
      <ConciergeHistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        sessions={sessions.map((s) => ({
          id: s.id,
          title: s.title,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          messageCount: s.messages.length,
          lastMessageSnippet: s.messages[s.messages.length - 1]?.text?.slice(0, 60),
        }))}
        currentSessionId={currentSessionId}
        onSelectSession={selectSession}
        onNewChat={startNewChat}
        onDeleteSession={deleteSession}
        onClearAll={clearAllSessions}
        userPersona={userPersona}
      />
      {handoff && (
        <LiveAgentHandoff
          transcript={messages.filter((m) => m.text.trim()).map((m) => ({ role: m.role, content: m.text }))}
          language={language}
          onClose={() => setHandoff(false)}
        />
      )}
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
          <IconButton
            label="Chat history"
            pressed={historyOpen}
            onClick={() => setHistoryOpen(true)}
          >
            <span className="relative inline-flex items-center justify-center">
              <Clock className="h-4 w-4" />
              {sessions.length > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-ocean-600 ring-2 ring-white" />
              )}
            </span>
          </IconButton>
          <IconButton label="New chat" onClick={startNewChat}>
            <RotateCcw className="h-4 w-4" />
          </IconButton>
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
              <p className="mt-2 max-w-sm text-base text-slate-600">Ask about tours, prices, hotel pickups and Moraine Lake access, or check dates to book.</p>
              <ul className={`mt-8 grid w-full gap-2.5 ${page ? "sm:grid-cols-2" : ""}`}>
                {SUGGESTIONS.map(({ icon: Icon, text }) => (
                  <li key={text}>
                    <button
                      type="button"
                      onClick={() => send(text)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-obsidian-900/10 px-4 py-3 text-left text-sm text-obsidian-900 transition-colors hover:border-obsidian-900/15 hover:bg-obsidian-50"
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
                    <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-slate-100 border border-slate-200/80 px-4 py-2.5 shadow-xs">
                      <span className="sr-only">You: </span>
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mb-2.5 flex flex-wrap gap-2">
                          {m.attachments.map((att, i) => (
                            <div key={i} className="overflow-hidden rounded-xl border border-slate-300/80 bg-white shadow-2xs">
                              {att.mediaType.startsWith("image/") ? (
                                <img
                                  src={att.previewUrl || (att.base64 ? `data:${att.mediaType};base64,${att.base64}` : "")}
                                  alt={att.name}
                                  className="max-h-48 max-w-[260px] object-cover rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                                  onClick={() => {
                                    const src = att.previewUrl || (att.base64 ? `data:${att.mediaType};base64,${att.base64}` : "");
                                    if (src) window.open(src, "_blank");
                                  }}
                                />
                              ) : (
                                <div className="flex items-center gap-2 p-2.5 text-xs text-slate-800">
                                  <FileText className="h-4 w-4 text-ocean-600" />
                                  <span className="font-medium truncate max-w-[180px]">{att.name}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {m.text && (
                        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-900 font-normal" style={{ color: "#0f172a" }}>
                          {m.text}
                        </p>
                      )}
                    </div>
                  </li>
                ) : (
                  <li key={m.id} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-obsidian-900 text-summit-400 shadow-xs" aria-hidden="true">
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="sr-only">Concierge: </span>
                      {m.thinkingMode === "deep" && (
                        <div className="mb-1.5 flex items-center">
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                            <Brain className="h-3 w-3 text-amber-600" />
                            Deep Thinking Turbo
                          </span>
                        </div>
                      )}
                      <ConciergeMarkdownRenderer content={m.text} />
                      {m.data?.type === "handoff" && (
                        <button
                          type="button"
                          onClick={() => setHandoff(true)}
                          className="mt-3 inline-flex h-10 items-center gap-2 rounded-full border border-obsidian-900/15 px-4 text-sm text-obsidian-900 hover:bg-obsidian-50"
                        >
                          <Headset className="h-4 w-4 text-ocean-600" aria-hidden="true" />
                          Chat with a live agent
                        </button>
                      )}
                      <VoiceBookingCardStream
                        data={m.data?.type === "handoff" ? undefined : (m.data as VoiceCardData | undefined)}
                        checkoutUrl={m.checkoutUrl}
                        hasSafetyRefusal={m.hasSafetyRefusal}
                        onSelectDeparture={(dep) => send(`I choose the departure on ${dep.date} at ${dep.departureTime}`)}
                        onSelectPickup={(name) => send(`Pickup at ${name}`)}
                        onSelectSeats={(seats) => send(`I would like to reserve seats: ${seats.join(", ")}`)}
                      />
                    </div>
                  </li>
                ),
              )}
              {voice === "thinking" && (
                <li className="flex items-center gap-3" aria-label={status ?? "The concierge is typing"}>
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-obsidian-900 text-summit-400" aria-hidden="true">
                    {thinkingMode === "deep" ? (
                      <Brain className="h-3.5 w-3.5 text-amber-400 motion-safe:animate-pulse" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    )}
                  </span>
                  <span className="flex gap-1" aria-hidden="true">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="h-2 w-2 rounded-full bg-slate-400 motion-safe:animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                  <span className="text-sm text-slate-600">
                    {status || (thinkingMode === "deep" ? "Deep Thinking Turbo: Formulating complete in-depth alpine route & schedule analysis…" : "Concierge is typing…")}
                  </span>
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
                className="inline-flex h-9 items-center gap-2 rounded-full border border-obsidian-900/10 bg-white px-4 text-sm text-obsidian-900 shadow-sm hover:bg-obsidian-50"
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
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
            }}
            className={`rounded-none border bg-white p-2 shadow-[0_8px_30px_-12px_rgba(12,31,33,0.25)] transition-colors ${
              isDragging ? "border-ocean-500 bg-ocean-50/20 ring-2 ring-ocean-500/20" : "border-obsidian-900/10 focus-within:border-obsidian-900/30"
            }`}
          >
            <label htmlFor={`concierge-input-${variant}`} className="sr-only">
              Message the concierge
            </label>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*,application/pdf,text/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {stagedFiles.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-obsidian-900/[0.06] px-2 pt-1 pb-2">
                {stagedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="group relative flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-2 pr-2.5 text-xs shadow-xs"
                  >
                    {file.mediaType.startsWith("image/") && file.previewUrl ? (
                      <img src={file.previewUrl} alt={file.name} className="h-8 w-8 rounded-lg object-cover border border-slate-200/90" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ocean-50 text-ocean-700">
                        <FileText className="h-4 w-4" />
                      </span>
                    )}
                    <div className="max-w-[130px] min-w-0">
                      <p className="truncate font-medium text-slate-800">{file.name}</p>
                      <p className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(file.id)}
                      className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <textarea
              id={`concierge-input-${variant}`}
              ref={field}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (voice === "speaking") stopSpeaking();
              }}
              onPaste={(e) => {
                if (e.clipboardData.files && e.clipboardData.files.length > 0) {
                  handleFiles(e.clipboardData.files);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={
                voice === "listening"
                  ? "Listening…"
                  : stagedFiles.length > 0
                  ? "Add note or question about this attachment, then press Enter…"
                  : "Ask anything about your Rockies trip"
              }
              className="block max-h-[200px] w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed text-obsidian-900 placeholder:text-slate-500 focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1">
              <div className="flex items-center gap-1.5">
                {micSupported ? (
                  <button
                    type="button"
                    onClick={toggleMic}
                    aria-label={voice === "listening" ? "Stop voice input" : "Speak your message"}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors ${
                      voice === "listening" ? "bg-red-600 text-white" : "text-slate-700 hover:bg-obsidian-900/[0.06] hover:text-obsidian-900"
                    }`}
                  >
                    <Mic className={`h-3.5 w-3.5 ${voice === "listening" ? "motion-safe:animate-pulse" : ""}`} aria-hidden="true" />
                    {voice === "listening" ? "Listening…" : "Voice"}
                  </button>
                ) : null}

                {/* Attach files and photos */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach photos or documents"
                  title="Attach photos, park passes, itineraries, or tickets"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-obsidian-900/[0.06] hover:text-obsidian-900 transition-colors"
                >
                  <Paperclip className="h-4 w-4" aria-hidden="true" />
                </button>

                {/* Deep Thinking vs Standard Thinking Mode Chip */}
                <button
                  type="button"
                  onClick={() => setThinkingMode((m) => (m === "deep" ? "standard" : "deep"))}
                  aria-pressed={thinkingMode === "deep"}
                  title={
                    thinkingMode === "deep"
                      ? "Deep Thinking Turbo Mode active: Full unrestricted in-depth planning with strict RBAC & safety enforcement. Click to return to Standard Thinking."
                      : "Click to select Deep Thinking Turbo Mode for complete in-depth itineraries and comprehensive route analysis"
                  }
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs transition-all ${
                    thinkingMode === "deep"
                      ? "border border-amber-400/80 bg-amber-500/15 text-amber-900 shadow-xs ring-2 ring-amber-400/30 font-semibold"
                      : "border border-slate-200/90 bg-slate-100/90 text-slate-600 hover:border-slate-300 hover:bg-slate-200/80 hover:text-slate-900"
                  }`}
                >
                  <Brain className={`h-3.5 w-3.5 ${thinkingMode === "deep" ? "text-amber-700 motion-safe:animate-pulse" : "text-slate-500"}`} />
                  <span>{thinkingMode === "deep" ? "Deep Thinking Turbo" : "Deep Thinking"}</span>
                  {thinkingMode === "deep" ? (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-600" />
                  ) : (
                    <span className="text-[10px] text-slate-400">Off</span>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <label className="flex min-w-0 items-center gap-1.5 rounded-full px-2 text-xs text-slate-700 focus-within:ring-2 focus-within:ring-ocean-600/25 hover:bg-obsidian-900/[0.06]">
                  <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="sr-only">Reply language</span>
                  <select
                    value={language ?? ""}
                    onChange={(e) => chooseLanguage(e.target.value)}
                    className="h-9 min-w-0 max-w-[8.5rem] cursor-pointer truncate bg-transparent text-xs text-obsidian-900 focus:outline-none"
                  >
                    <option value="">Auto language</option>
                    {CONCIERGE_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code} lang={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={(!input.trim() && stagedFiles.length === 0) || voice === "thinking"}
                  aria-label="Send message"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-obsidian-900 text-white transition-colors hover:bg-obsidian-800 disabled:bg-obsidian-900/15 disabled:text-slate-500"
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </form>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-slate-600">
            <button type="button" onClick={() => setHandoff(true)} className="inline-flex items-center gap-1.5 text-sm text-ocean-700 underline-offset-4 hover:underline">
              <Headset className="h-4 w-4" aria-hidden="true" />
              Chat with a live agent
            </button>
            <span>The concierge can make mistakes, so check key details. It never asks for card numbers.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Turns bare URLs and site paths in a reply (web sources, checkout links, /privacy-policy-vista-chase)
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
