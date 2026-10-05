"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  Mic,
  X,
  Maximize2,
  Volume2,
  VolumeX,
  Send,
  ShieldCheck,
} from "lucide-react";
import { VoiceAssistantOrb, VoiceState } from "./VoiceAssistantOrb";
import { VoiceBookingCardStream, VoiceCardData } from "./VoiceBookingCardStream";

interface Message {
  id: string;
  role: "assistant" | "user";
  text: string;
  data?: VoiceCardData;
  checkoutUrl?: string;
  hasSafetyRefusal?: boolean;
}

export function GlobalVoiceAssistantDrawer() {
  const pathname = usePathname();
  // Don't show drawer trigger if already on full /concierge page
  const isConciergePage = pathname === "/concierge";

  const [isOpen, setIsOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sessionState, setSessionState] = useState<any>({});
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-drawer",
      role: "assistant",
      text: "Hello! I am your Vista Chase AI Voice Concierge. Ask me anything about Lake Louise, Moraine Lake access, book a tour, or check your shuttle status.",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          handleSendMessage(transcript);
        }
        setVoiceState("thinking");
      };

      recognition.onerror = () => {
        setVoiceState("idle");
      };

      recognition.onend = () => {
        if (voiceState === "listening") {
          setVoiceState("idle");
        }
      };

      recognitionRef.current = recognition;
    }
  }, [voiceState]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Natural interruption: cancel synthesis
  function stopSpeaking() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (voiceState === "speaking") {
      setVoiceState("idle");
    }
  }

  function speakText(text: string) {
    if (!ttsEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoiceState("idle");
      return;
    }

    stopSpeaking();
    const cleanText = text.replace(/[*#•_-]/g, " ").replace(/\s+/g, " ");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setVoiceState("speaking");
    utterance.onend = () => setVoiceState("idle");
    utterance.onerror = () => setVoiceState("idle");

    window.speechSynthesis.speak(utterance);
  }

  function toggleListening() {
    // If speaking, interrupt!
    if (voiceState === "speaking") {
      stopSpeaking();
      return;
    }

    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use text input.");
      return;
    }

    if (voiceState === "listening") {
      recognitionRef.current.stop();
      setVoiceState("idle");
    } else {
      try {
        stopSpeaking();
        recognitionRef.current.start();
        setVoiceState("listening");
      } catch (err) {
        console.error("Speech start error:", err);
        setVoiceState("idle");
      }
    }
  }

  async function handleSendMessage(textToSend?: string) {
    const text = textToSend || inputText;
    if (!text.trim() || voiceState === "thinking") return;

    stopSpeaking();
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text: text.trim(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText("");
    setVoiceState("thinking");

    try {
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          sessionState,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          text: json.message,
          data: json.data,
          checkoutUrl: json.checkoutUrl,
          hasSafetyRefusal: json.hasSafetyRefusal,
        };
        setMessages((prev) => [...prev, aiMsg]);
        if (json.sessionState) {
          setSessionState(json.sessionState);
        }
        speakText(json.message);
      } else {
        const errorMsg: Message = {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: "I encountered a minor glitch connecting to the Rockies knowledge base. Please try asking again!",
        };
        setMessages((prev) => [...prev, errorMsg]);
        setVoiceState("idle");
      }
    } catch {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: "assistant",
        text: "Network connection error. Please verify your connection and try again.",
      };
      setMessages((prev) => [...prev, errorMsg]);
      setVoiceState("idle");
    }
  }

  if (isConciergePage) return null;

  return (
    <>
      {/* Floating Launcher Button */}
      <aside aria-label="Vista Chase AI Voice Assistant">
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            stopSpeaking();
          }}
          aria-label="Open AI Voice Assistant"
          className="fixed bottom-6 right-6 z-40 p-3.5 rounded-full bg-gradient-to-r from-obsidian-950 via-forest-950 to-obsidian-900 border-2 border-summit-500/80 text-summit-400 hover:text-summit-300 shadow-2xl hover:scale-105 hover:shadow-glow transition-all duration-300 flex items-center gap-2.5 group"
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute -inset-1 rounded-full bg-summit-500/30 animate-ping group-hover:bg-summit-500/50" />
            <Mic className="w-5 h-5 text-summit-400" />
          </div>
          <span className="text-xs font-bold text-white pr-1 hidden sm:inline-block">
            AI Voice Concierge
          </span>
          <Sparkles className="w-3.5 h-3.5 text-summit-400 animate-pulse" />
        </button>
      </aside>

      {/* Slide-Over Drawer Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-obsidian-950/60 backdrop-blur-sm transition-opacity">
          <div
            className="w-full max-w-md h-full bg-obsidian-950 border-l border-slate-800 text-white flex flex-col shadow-2xl animate-in slide-in-from-right duration-300"
            role="dialog"
            aria-modal="true"
            aria-label="AI Voice Assistant Drawer"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-obsidian-900/90 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-summit-400 to-amber-500 flex items-center justify-center text-slate-950 font-bold shadow-md">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                    <span>AI Voice Concierge</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                      LIVE
                    </span>
                  </h2>
                  <p className="text-[10px] text-slate-400">Lake Louise, Moraine Lake &amp; Banff</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    stopSpeaking();
                    setTtsEnabled(!ttsEnabled);
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:text-summit-300 hover:bg-slate-800"
                  title={ttsEnabled ? "Mute speech audio" : "Enable speech audio"}
                >
                  {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <Link
                  href="/concierge"
                  onClick={() => {
                    stopSpeaking();
                    setIsOpen(false);
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:text-summit-300 hover:bg-slate-800"
                  title="Expand to Fullscreen Concierge"
                >
                  <Maximize2 className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    stopSpeaking();
                    setIsOpen(false);
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  title="Close Assistant"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Voice Orb Hero Area */}
            <div className="py-4 px-4 bg-gradient-to-b from-obsidian-900/60 to-obsidian-950 flex flex-col items-center justify-center border-b border-slate-800/80">
              <VoiceAssistantOrb
                state={voiceState}
                onToggle={toggleListening}
                size="md"
              />
              <div className="text-[11px] text-slate-300 mt-2 font-medium" style={{ color: "#cbd5e1" }}>
                {voiceState === "listening"
                  ? "Listening... Tap orb to submit or pause"
                  : voiceState === "thinking"
                  ? "Consulting live Bókun catalog..."
                  : voiceState === "speaking"
                  ? "Speaking... Tap orb to interrupt"
                  : "Tap orb to speak with voice"}
              </div>
            </div>

            {/* Conversation Log Stream */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-4 text-xs focus:outline-none ai-voice-drawer"
              tabIndex={0}
              role="log"
              aria-live="polite"
            >
              {messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div key={m.id} className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
                    {!isUser && (
                      <div className="w-6 h-6 rounded-lg bg-obsidian-900 border border-slate-700 flex items-center justify-center text-summit-400 flex-shrink-0 mt-0.5 shadow-sm">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div className="space-y-2 max-w-[85%]">
                      <div
                        className={`p-3.5 rounded-2xl leading-relaxed backdrop-blur-md shadow-lg transition-all ${
                          isUser
                            ? "bg-gradient-to-r from-summit-400 to-summit-500 text-obsidian-950 font-semibold rounded-tr-none"
                            : m.hasSafetyRefusal
                            ? "bg-amber-950/80 border border-amber-500/80 text-amber-100 rounded-tl-none"
                            : "bg-white/10 border border-white/20 text-white rounded-tl-none"
                        }`}
                      >
                        <p
                          className={`text-xs leading-relaxed ${
                            isUser ? "text-obsidian-950 font-semibold" : "text-white font-normal"
                          }`}
                          style={{ color: isUser ? "#0c1f21" : "#ffffff" }}
                        >
                          {m.text}
                        </p>
                      </div>

                      {/* Visual Companion Cards */}
                      <VoiceBookingCardStream
                        data={m.data}
                        checkoutUrl={m.checkoutUrl}
                        hasSafetyRefusal={m.hasSafetyRefusal}
                        onSelectDeparture={(dep) => handleSendMessage(`I choose departure ${dep.date} at ${dep.departureTime}`)}
                        onSelectPickup={(pickup) => handleSendMessage(`Pickup at ${pickup}`)}
                      />
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-slate-800 bg-obsidian-900/90">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2 bg-obsidian-950 border border-slate-700 rounded-xl px-3 py-1.5 focus-within:border-summit-400"
              >
                <input
                  type="text"
                  placeholder={voiceState === "listening" ? "Listening to your voice..." : "Ask or book with AI Concierge..."}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="w-full bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none"
                  style={{ color: "#ffffff" }}
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || voiceState === "thinking"}
                  className="p-1.5 rounded-lg text-slate-950 bg-summit-500 hover:bg-summit-400 disabled:opacity-40 transition-all"
                  aria-label="Send message"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
              <div className="flex items-center justify-between mt-2 text-[9px] text-slate-400 px-1">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Card security enforced</span>
                </span>
                <span>Bókun System of Record</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
