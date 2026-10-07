"use client";

import { Mic, MicOff, Volume2, Sparkles, Loader2 } from "lucide-react";

export type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "error";

interface VoiceAssistantOrbProps {
  state: VoiceState;
  onToggle: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function VoiceAssistantOrb({
  state,
  onToggle,
  className = "",
  size = "md",
}: VoiceAssistantOrbProps) {
  const sizeClasses = {
    sm: "w-14 h-14",
    md: "w-20 h-20",
    lg: "w-28 h-28",
  }[size];

  const iconSizes = {
    sm: "w-5 h-5",
    md: "w-7 h-7",
    lg: "w-10 h-10",
  }[size];

  const stateLabels: Record<VoiceState, string> = {
    idle: "Click or tap to speak with Vista Chase Voice Concierge",
    listening: "Listening to your voice... Click to pause or submit",
    thinking: "Checking Canadian Rockies catalog & live Bókun availability...",
    speaking: "Voice Concierge speaking. Click to interrupt or reply",
    error: "Voice connection paused. Click to retry",
  };

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Outer Glow Halo Ring */}
      <div
        className={`absolute inset-0 rounded-full transition-all duration-700 pointer-events-none ${
          state === "listening"
            ? "bg-red-500/25 animate-ping scale-150"
            : state === "thinking"
            ? "bg-cyan-500/20 animate-pulse scale-125"
            : state === "speaking"
            ? "bg-amber-400/25 animate-pulse scale-135"
            : "bg-summit-500/10 scale-105"
        }`}
      />

      {/* Pulsing Audio Frequency Rings */}
      {(state === "listening" || state === "speaking") && (
        <>
          <div className="absolute -inset-2 rounded-full border border-amber-400/40 animate-ping opacity-40 duration-1000 pointer-events-none" />
          <div className="absolute -inset-4 rounded-full border border-summit-500/20 animate-pulse duration-700 pointer-events-none" />
        </>
      )}

      {/* Main Interactive Button Orb */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={stateLabels[state]}
        title={stateLabels[state]}
        className={`relative ${sizeClasses} rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-summit-500 select-none ${
          state === "listening"
            ? "bg-gradient-to-tr from-red-600 to-rose-500 text-white scale-105 shadow-red-500/50"
            : state === "thinking"
            ? "bg-gradient-to-tr from-slate-900 via-ocean-900 to-slate-900 text-cyan-300 border-2 border-cyan-400/60 shadow-cyan-500/30"
            : state === "speaking"
            ? "bg-gradient-to-tr from-amber-600 via-summit-500 to-amber-400 text-slate-950 scale-105 shadow-amber-500/50"
            : state === "error"
            ? "bg-gradient-to-tr from-slate-800 to-rose-950 text-rose-300 border border-rose-500/40"
            : "bg-gradient-to-tr from-obsidian-900 via-forest-950 to-obsidian-800 text-summit-400 border border-summit-500/40 hover:border-summit-400 hover:scale-105 shadow-glow"
        }`}
      >
        {state === "listening" ? (
          <div className="flex flex-col items-center gap-1">
            <Mic className={`${iconSizes} animate-bounce`} />
            <div className="flex items-center gap-0.5">
              <span className="w-1 h-3 bg-white rounded-full animate-pulse" />
              <span className="w-1 h-4 bg-white rounded-full animate-pulse delay-75" />
              <span className="w-1 h-2 bg-white rounded-full animate-pulse delay-150" />
            </div>
          </div>
        ) : state === "thinking" ? (
          <div className="flex flex-col items-center gap-1">
            <Loader2 className={`${iconSizes} animate-spin text-cyan-300`} />
            <span className="text-xs font-mono tracking-widest text-cyan-200 uppercase font-bold">
              AI
            </span>
          </div>
        ) : state === "speaking" ? (
          <div className="flex flex-col items-center gap-1">
            <Volume2 className={`${iconSizes} animate-pulse`} />
            <div className="flex items-center gap-0.5">
              <span className="w-1 h-3 bg-slate-950 rounded-full animate-pulse" />
              <span className="w-1 h-4 bg-slate-950 rounded-full animate-pulse delay-75" />
              <span className="w-1 h-2 bg-slate-950 rounded-full animate-pulse delay-150" />
            </div>
          </div>
        ) : state === "error" ? (
          <MicOff className={iconSizes} />
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Mic className={iconSizes} />
            <Sparkles className="w-3 h-3 text-summit-400" />
          </div>
        )}
      </button>

      {/* Accessible Live Region */}
      <span className="sr-only" aria-live="polite">
        {stateLabels[state]}
      </span>
    </div>
  );
}
