"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  ShieldAlert,
  ArrowRight,
  Clock,
  MapPin,
  Calendar,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";

interface Message {
  id: string;
  role: "assistant" | "user";
  text: string;
  data?: any;
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
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Recognition ref
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Scroll to bottom on new message
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    // Setup Web Speech Recognition if available
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
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function speakText(text: string) {
    if (!ttsEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function toggleListening() {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please type your message.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Speech start error:", e);
      }
    }
  }

  async function handleSendMessage(textToSend?: string) {
    const text = textToSend || inputText;
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text: text.trim(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText("");
    setLoading(true);

    try {
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
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
        speakText(data.message);
      } else {
        const errorMsg: Message = {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: "I encountered a minor glitch connecting to the Rockies knowledge base. Please try asking again!",
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: "assistant",
        text: "Network connection error. Please verify your connection and try again.",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-forest-950 text-white flex flex-col">
      {/* Top Banner Header */}
      <div className="border-b border-forest-800 bg-forest-900/80 px-4 py-4 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-forest-950 font-bold shadow-glow">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-white flex items-center gap-2">
                <span>AI Rockies Travel Concierge</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-sans uppercase">
                  Voice Enabled
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Official guide for Lake Louise, Moraine Lake, and Banff National Park
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (isSpeaking) window.speechSynthesis.cancel();
                setTtsEnabled(!ttsEnabled);
              }}
              className={`p-2.5 rounded-xl border transition-colors ${
                ttsEnabled
                  ? "bg-forest-800 text-gold-400 border-forest-700 hover:bg-forest-700"
                  : "bg-forest-950 text-slate-400 border-forest-800"
              }`}
              title={ttsEnabled ? "Mute Voice Speech" : "Enable Voice Speech"}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Safety Guardrail Notice Bar */}
      <div className="bg-forest-900/40 border-b border-forest-800/60 px-4 py-2 text-xs text-slate-300">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-gold-400 flex-shrink-0" />
          <span>
            <strong>Safe Voice Policy:</strong> Our Concierge will <em>never</em> ask for credit card numbers or process payments over voice. Seat holds are placed for 10 minutes and completed via encrypted checkout.
          </span>
        </div>
      </div>

      {/* Main Conversation Stream: a polite live log, so new replies are announced (WCAG 4.1.3),
          and focusable so keyboard users can scroll it (WCAG 2.1.1). */}
      <div
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
                  <div className="w-8 h-8 rounded-xl bg-forest-900 border border-forest-700 flex items-center justify-center text-gold-400 flex-shrink-0 mt-1">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div className={`space-y-3 max-w-[85%] sm:max-w-xl`}>
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      isUser
                        ? "bg-gold-500 text-forest-950 font-medium rounded-tr-none shadow-glow"
                        : m.hasSafetyRefusal
                        ? "bg-amber-950/60 border border-amber-700 text-amber-100 rounded-tl-none shadow-xl"
                        : "bg-forest-900 border border-forest-800 text-slate-200 rounded-tl-none shadow-xl"
                    }`}
                  >
                    {m.hasSafetyRefusal && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold mb-2">
                        <ShieldAlert className="w-4 h-4" />
                        <span>SECURITY GUARDRAIL TRIGGERED</span>
                      </div>
                    )}
                    <p className="text-inherit">{m.text}</p>
                  </div>

                  {/* Attached Pickup Results */}
                  {m.data?.type === "pickups" && m.data.stops && (
                    <div className="p-3 bg-forest-900/90 border border-forest-800 rounded-2xl space-y-2 text-xs">
                      <div className="font-semibold text-gold-400 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Matching Banff &amp; Canmore Stops</span>
                      </div>
                      <div className="space-y-1.5">
                        {m.data.stops.map((s: any) => (
                          <div
                            key={s.id}
                            className="p-2 rounded-xl bg-forest-950 border border-forest-800/80 flex items-center justify-between"
                          >
                            <div>
                              <div className="font-semibold text-white">{s.name}</div>
                              <div className="text-[11px] text-slate-400">{s.address}, {s.town}</div>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-forest-800 text-[10px] text-slate-300">
                              Pickup Stop
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attached Availability Results */}
                  {m.data?.type === "availability" && m.data.departures && (
                    <div className="p-3 bg-forest-900/90 border border-forest-800 rounded-2xl space-y-2 text-xs">
                      <div className="font-semibold text-gold-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Upcoming Scheduled Departures</span>
                      </div>
                      <div className="space-y-1.5">
                        {m.data.departures.map((d: any) => (
                          <div
                            key={d.id}
                            className="p-2.5 rounded-xl bg-forest-950 border border-forest-800/80 flex items-center justify-between"
                          >
                            <div>
                              <div className="font-semibold text-white">{d.title}</div>
                              <div className="text-[11px] text-slate-400">
                                {d.date} at {d.departureTime}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-gold-400 font-mono">
                                ${d.price} {d.currency}
                              </div>
                              <div className="text-[10px] text-emerald-400">
                                {d.availableSeats} seats left
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attached Reservation Hold Card */}
                  {m.checkoutUrl && (
                    <div className="p-4 bg-gradient-to-br from-forest-900 to-forest-950 border-2 border-gold-400/80 rounded-2xl space-y-3 shadow-glow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gold-400 font-bold text-xs uppercase tracking-wider">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>10-Minute Hold Placed</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-amber-400 font-mono">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Expires in 10:00</span>
                        </div>
                      </div>

                      {m.data?.departure && (
                        <div className="text-xs text-slate-300">
                          <div className="font-semibold text-white">{m.data.departure.title}</div>
                          <div>
                            {m.data.departure.date} at {m.data.departure.departureTime} • {m.data.departure.seats} Seats Reserved
                          </div>
                        </div>
                      )}

                      <Link
                        href={m.checkoutUrl}
                        className="w-full py-2.5 px-4 rounded-xl font-bold text-forest-950 gold-gradient text-xs flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-all"
                      >
                        <span>Finalize Checkout &amp; Pay Securely</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-forest-900 border border-forest-700 flex items-center justify-center text-gold-400">
                <Sparkles className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-4 rounded-2xl bg-forest-900 border border-forest-800 text-slate-400 text-xs rounded-tl-none flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gold-400 animate-ping"></span>
                <span>Consulting Canadian Rockies knowledge base...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggested Quick Inquiries */}
      <div className="px-4 py-2 border-t border-forest-800/60 bg-forest-950">
        <div className="max-w-4xl mx-auto flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 flex items-center gap-1 whitespace-nowrap">
            <HelpCircle className="w-3 h-3 text-gold-400" />
            <span>Try:</span>
          </span>
          <button
            onClick={() => handleSendMessage("Can I drive my own car to Moraine Lake?")}
            className="px-3 py-1 rounded-full bg-forest-900 hover:bg-forest-800 border border-forest-800 text-slate-300 hover:text-white whitespace-nowrap transition-colors"
          >
            Can I drive to Moraine Lake?
          </button>
          <button
            onClick={() => handleSendMessage("Where do you pick up in Banff?")}
            className="px-3 py-1 rounded-full bg-forest-900 hover:bg-forest-800 border border-forest-800 text-slate-300 hover:text-white whitespace-nowrap transition-colors"
          >
            Hotel pickup locations
          </button>
          <button
            onClick={() => handleSendMessage("Please hold 2 seats for Lake Louise tour")}
            className="px-3 py-1 rounded-full bg-forest-900 hover:bg-forest-800 border border-forest-800 text-gold-300 hover:text-gold-200 whitespace-nowrap transition-colors font-medium"
          >
            Hold 2 seats (10-min hold)
          </button>
          <button
            onClick={() => handleSendMessage("My credit card number is 4532 1234 5678 9012")}
            className="px-3 py-1 rounded-full bg-forest-900 hover:bg-red-950/60 border border-forest-800 hover:border-red-800 text-slate-400 hover:text-red-300 whitespace-nowrap transition-colors"
          >
            Test card security refusal
          </button>
        </div>
      </div>

      {/* Bottom Voice / Text Input Bar */}
      <div className="border-t border-forest-800 bg-forest-900/90 p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          {/* Voice Microphone Toggle Button */}
          <button
            onClick={toggleListening}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              isListening
                ? "bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/50 scale-105"
                : "bg-forest-800 hover:bg-forest-700 text-gold-400 border border-forest-700"
            }`}
            title={isListening ? "Listening... click to stop" : "Speak with Voice Concierge"}
          >
            {isListening ? <Mic className="w-5 h-5 animate-bounce" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Text Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex-1 flex items-center gap-2 bg-forest-950 border border-forest-700 rounded-2xl px-4 py-2 focus-within:border-gold-400 transition-colors"
          >
            <input
              type="text"
              aria-label="Message the AI concierge"
              placeholder={isListening ? "Listening to your voice..." : "Ask anything about Banff, shuttles, pickups, or reserve seats..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || loading}
              aria-label="Send message"
              className="p-2.5 rounded-xl text-forest-950 gold-gradient hover:opacity-95 disabled:opacity-40 transition-all"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
