"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Sparkles,
  Volume2,
  VolumeX,
  Send,
  ShieldAlert,
  ArrowRight,
  HelpCircle,
  Headphones,
  RotateCcw,
} from "lucide-react";
import { VoiceAssistantOrb, VoiceState } from "@/components/voice/VoiceAssistantOrb";
import { VoiceBookingCardStream, VoiceCardData } from "@/components/voice/VoiceBookingCardStream";

interface Message {
  id: string;
  role: "assistant" | "user";
  text: string;
  data?: VoiceCardData;
  checkoutUrl?: string;
  hasSafetyRefusal?: boolean;
}

export default function ConciergePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "intro",
      role: "assistant",
      text: "Welcome to Vista Chase! I'm your AI Canadian Rockies Travel Concierge. I can help you with Banff hotel pickups, Moraine Lake access rules, tour recommendations, or place a 10-minute reservation hold on seats. How can I assist your trip today?",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [sessionState, setSessionState] = useState<any>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, voiceState]);

  useEffect(() => {
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
    // Natural interruption: if speaking, clicking stops speech
    if (voiceState === "speaking") {
      stopSpeaking();
      return;
    }

    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please type your message.");
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
      } catch (e) {
        console.error("Speech start error:", e);
        setVoiceState("idle");
      }
    }
  }

  function resetConversation() {
    stopSpeaking();
    setSessionState({});
    setMessages([
      {
        id: "intro-reset",
        role: "assistant",
        text: "Welcome to Vista Chase! I'm your AI Canadian Rockies Travel Concierge. How can I assist your trip today?",
      },
    ]);
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

      const data = await res.json();
      if (res.ok && data.success) {
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          text: data.message,
          data: data.data,
          checkoutUrl: data.checkoutUrl,
          hasSafetyRefusal: data.hasSafetyRefusal,
        };
        setMessages((prev) => [...prev, aiMsg]);
        if (data.sessionState) {
          setSessionState(data.sessionState);
        }
        speakText(data.message);
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

  return (
    <div className="min-h-screen bg-obsidian-950 text-white flex flex-col selection:bg-summit-500 selection:text-slate-950">
      {/* Top Banner Header */}
      <header className="border-b border-slate-800 bg-obsidian-900/90 px-4 py-3.5 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-summit-400 to-amber-500 flex items-center justify-center text-slate-950 font-bold shadow-glow">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display font-bold text-base sm:text-lg text-white flex items-center gap-2">
                <span>AI Rockies Voice Concierge</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono uppercase">
                  Bókun Connected
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Official guide for Lake Louise, Moraine Lake, and Banff National Park
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetConversation}
              className="p-2 rounded-xl border border-slate-800 bg-obsidian-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Reset Conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                setTtsEnabled(!ttsEnabled);
              }}
              className={`p-2 rounded-xl border transition-colors ${
                ttsEnabled
                  ? "bg-slate-800 text-summit-400 border-slate-700 hover:bg-slate-700"
                  : "bg-obsidian-900 text-slate-500 border-slate-800"
              }`}
              title={ttsEnabled ? "Mute Voice Speech" : "Enable Voice Speech"}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Safety Guardrail Notice Bar */}
      <div className="bg-obsidian-900/50 border-b border-slate-800/80 px-4 py-2 text-xs text-slate-300">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-summit-400 flex-shrink-0" />
          <span>
            <strong>Safe Voice Policy:</strong> Our Concierge will <em>never</em> ask for credit card numbers or process payments over voice. Guaranteed seat holds are placed for 10 minutes and finalized via encrypted PCI-DSS checkout.
          </span>
        </div>
      </div>

      {/* Luxury Voice Orb Interactive Hero */}
      <section aria-label="Interactive Voice Assistant" className="py-6 px-4 bg-gradient-to-b from-obsidian-900/60 via-obsidian-950 to-obsidian-950 border-b border-slate-800/60 flex flex-col items-center justify-center">
        <div className="text-center space-y-2 mb-3">
          <p className="text-xs uppercase tracking-widest text-summit-400 font-bold flex items-center justify-center gap-1.5">
            <Headphones className="w-3.5 h-3.5" />
            <span>Voice-First Assistant &amp; Booking Guide</span>
          </p>
          <p className="text-xs text-slate-400 max-w-md">
            Speak naturally to inquire, check live Bókun seats, select hotel pickup, and receive an instant booking voucher.
          </p>
        </div>

        <VoiceAssistantOrb
          state={voiceState}
          onToggle={toggleListening}
          size="lg"
        />

        <div className="text-xs text-slate-300 mt-3 font-medium flex items-center gap-2">
          {voiceState === "listening" ? (
            <span className="text-rose-400 flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              Listening... Tap orb to submit or pause
            </span>
          ) : voiceState === "thinking" ? (
            <span className="text-cyan-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              Verifying Canadian Rockies Bókun availability...
            </span>
          ) : voiceState === "speaking" ? (
            <span className="text-summit-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-summit-400 animate-pulse" />
              Speaking... Tap orb to interrupt
            </span>
          ) : (
            <span className="text-slate-400">
              Tap the orb or use the microphone below to speak
            </span>
          )}
        </div>
      </section>

      {/* Main Conversation Stream */}
      <main
        className="flex-1 overflow-y-auto px-4 py-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-summit-500"
        tabIndex={0}
        aria-label="Conversation with the AI concierge"
      >
        <div className="max-w-4xl mx-auto space-y-4" role="log" aria-live="polite">
          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-obsidian-900 border border-slate-700 flex items-center justify-center text-summit-400 flex-shrink-0 mt-1">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div className="space-y-3 max-w-[85%] sm:max-w-xl">
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      isUser
                        ? "bg-summit-500 text-slate-950 font-medium rounded-tr-none shadow-glow"
                        : m.hasSafetyRefusal
                        ? "bg-amber-950/70 border border-amber-600/80 text-amber-100 rounded-tl-none shadow-xl"
                        : "bg-obsidian-900 border border-slate-800 text-slate-200 rounded-tl-none shadow-xl"
                    }`}
                  >
                    {m.hasSafetyRefusal && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold mb-2">
                        <ShieldAlert className="w-4 h-4" />
                        <span>SECURITY GUARDRAIL TRIGGERED</span>
                      </div>
                    )}
                    <p className="whitespace-pre-line">{m.text}</p>
                  </div>

                  {/* Interactive Companion Cards */}
                  <VoiceBookingCardStream
                    data={m.data}
                    checkoutUrl={m.checkoutUrl}
                    hasSafetyRefusal={m.hasSafetyRefusal}
                    onSelectDeparture={(dep) =>
                      handleSendMessage(`I choose departure on ${dep.date} at ${dep.departureTime}`)
                    }
                    onSelectPickup={(pickup) =>
                      handleSendMessage(`I am staying at ${pickup}`)
                    }
                  />
                </div>
              </div>
            );
          })}

          {voiceState === "thinking" && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-obsidian-900 border border-slate-700 flex items-center justify-center text-summit-400">
                <Sparkles className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-4 rounded-2xl bg-obsidian-900 border border-slate-800 text-slate-400 text-xs rounded-tl-none flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-summit-400 animate-ping" />
                <span>Checking live Bókun departures &amp; Banff routes...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Suggested Quick Prompts */}
      <div className="px-4 py-2 border-t border-slate-800/80 bg-obsidian-950">
        <div className="max-w-4xl mx-auto flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 flex items-center gap-1 whitespace-nowrap">
            <HelpCircle className="w-3 h-3 text-summit-400" />
            <span>Try:</span>
          </span>
          <button
            type="button"
            onClick={() => handleSendMessage("I want information about Moraine Lake.")}
            className="px-3 py-1 rounded-full bg-obsidian-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white whitespace-nowrap transition-colors"
          >
            Moraine Lake access rules
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage("I want to book the sunrise tour for two adults.")}
            className="px-3 py-1 rounded-full bg-obsidian-900 hover:bg-slate-800 border border-summit-500/40 text-summit-300 hover:text-summit-200 whitespace-nowrap transition-colors font-medium"
          >
            Book sunrise tour (2 adults)
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage("Where do you pick up in Banff?")}
            className="px-3 py-1 rounded-full bg-obsidian-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white whitespace-nowrap transition-colors"
          >
            Hotel pickup stops
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage("Where is my shuttle for booking VC-2026-98412?")}
            className="px-3 py-1 rounded-full bg-obsidian-900 hover:bg-slate-800 border border-ocean-600/50 text-ocean-300 hover:text-ocean-200 whitespace-nowrap transition-colors"
          >
            Track my shuttle (ETA)
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage("My credit card number is 4532 1234 5678 9012")}
            className="px-3 py-1 rounded-full bg-obsidian-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-300 whitespace-nowrap transition-colors"
          >
            Test card security refusal
          </button>
        </div>
      </div>

      {/* Bottom Voice / Text Input Bar */}
      <footer className="border-t border-slate-800 bg-obsidian-900/90 p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <VoiceAssistantOrb
            state={voiceState}
            onToggle={toggleListening}
            size="sm"
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex-1 flex items-center gap-2 bg-obsidian-950 border border-slate-700 rounded-2xl px-4 py-2.5 focus-within:border-summit-400 transition-colors"
          >
            <input
              type="text"
              aria-label="Message the AI concierge"
              placeholder={
                voiceState === "listening"
                  ? "Listening to your voice..."
                  : "Ask anything about Banff, shuttles, pickups, or reserve seats..."
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || voiceState === "thinking"}
              aria-label="Send message"
              className="p-2.5 rounded-xl text-slate-950 bg-summit-500 hover:bg-summit-400 disabled:opacity-40 transition-all"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
