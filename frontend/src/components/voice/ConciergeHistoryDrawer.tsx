"use client";

import { useEffect, useRef } from "react";
import { Clock, MessageSquare, Plus, Trash2, X, Sparkles, User, MapPin } from "lucide-react";

export interface ChatSessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  lastMessageSnippet?: string;
  messageCount: number;
}

export interface ConciergeHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSessionMeta[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onClearAll: () => void;
  userPersona?: {
    travelerType?: string;
    partySize?: number;
    lodgingLocation?: string;
    interests?: string[];
    travelerLocation?: {
      ip?: string;
      city?: string;
      region?: string;
      country?: string;
      source?: string;
    };
  };
}

export function ConciergeHistoryDrawer({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onClearAll,
  userPersona,
}: ConciergeHistoryDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Group sessions by date
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  const today = sessions.filter((s) => now - s.updatedAt < oneDay);
  const yesterday = sessions.filter((s) => now - s.updatedAt >= oneDay && now - s.updatedAt < 2 * oneDay);
  const older = sessions.filter((s) => now - s.updatedAt >= 2 * oneDay);

  const formatRelativeTime = (time: number) => {
    const diff = Math.floor((now - time) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(time).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  };

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-obsidian-950/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Chat history"
        className="relative z-10 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ease-out"
      >
        {/* Drawer Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ocean-50 text-ocean-700">
              <Clock className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-obsidian-900">Chat History</h2>
              <p className="text-xs text-slate-500">Your Rockies trip conversations</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close history"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Persona recognition banner if detected */}
        {(userPersona?.travelerType || userPersona?.travelerLocation) && (
          <div className="mx-4 mt-3 rounded-xl border border-ocean-100 bg-ocean-50/70 p-3 text-xs text-slate-700">
            <div className="flex items-center gap-1.5 font-medium text-ocean-900">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Learned Traveler Profile</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-600">
              {userPersona.travelerType && (
                <span className="rounded-md bg-white/80 px-1.5 py-0.5 border border-ocean-200/60 capitalize">
                  {userPersona.travelerType}
                  {userPersona.partySize ? ` (${userPersona.partySize})` : ""}
                </span>
              )}
              {userPersona.lodgingLocation && (
                <span className="rounded-md bg-white/80 px-1.5 py-0.5 border border-ocean-200/60">
                  📍 {userPersona.lodgingLocation}
                </span>
              )}
              {userPersona.travelerLocation && (
                <span
                  className="rounded-md bg-white/80 px-1.5 py-0.5 border border-ocean-200/60"
                  title={`Detected via IP: ${userPersona.travelerLocation.ip || "Unknown"}`}
                >
                  🌐 {[userPersona.travelerLocation.city, userPersona.travelerLocation.region, userPersona.travelerLocation.country].filter(Boolean).join(", ") || userPersona.travelerLocation.ip || "Detected Location"}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action: New Chat button */}
        <div className="px-4 pt-3 pb-2">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="golden-summit-btn flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Start New Conversation
          </button>
        </div>

        {/* Sessions list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {sessions.length === 0 ? (
            <div className="my-12 text-center text-slate-500">
              <MessageSquare className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium">No previous conversations</p>
              <p className="mt-1 text-xs">Your chats will be saved here automatically as you ask questions.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {today.length > 0 && (
                <div>
                  <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">Today</h3>
                  <div className="mt-1 space-y-1">
                    {today.map((s) => (
                      <SessionRow
                        key={s.id}
                        session={s}
                        isActive={s.id === currentSessionId}
                        time={formatRelativeTime(s.updatedAt)}
                        onSelect={() => {
                          onSelectSession(s.id);
                          onClose();
                        }}
                        onDelete={() => onDeleteSession(s.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {yesterday.length > 0 && (
                <div>
                  <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">Yesterday</h3>
                  <div className="mt-1 space-y-1">
                    {yesterday.map((s) => (
                      <SessionRow
                        key={s.id}
                        session={s}
                        isActive={s.id === currentSessionId}
                        time={formatRelativeTime(s.updatedAt)}
                        onSelect={() => {
                          onSelectSession(s.id);
                          onClose();
                        }}
                        onDelete={() => onDeleteSession(s.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {older.length > 0 && (
                <div>
                  <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">Previous Days</h3>
                  <div className="mt-1 space-y-1">
                    {older.map((s) => (
                      <SessionRow
                        key={s.id}
                        session={s}
                        isActive={s.id === currentSessionId}
                        time={formatRelativeTime(s.updatedAt)}
                        onSelect={() => {
                          onSelectSession(s.id);
                          onClose();
                        }}
                        onDelete={() => onDeleteSession(s.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        {sessions.length > 0 && (
          <div className="border-t border-slate-200/80 px-4 py-3">
            <button
              type="button"
              onClick={onClearAll}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all chat history
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionRow({
  session,
  isActive,
  time,
  onSelect,
  onDelete,
}: {
  session: ChatSessionMeta;
  isActive: boolean;
  time: string;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group relative flex w-full items-center justify-between rounded-xl p-2.5 text-left transition-colors ${
        isActive
          ? "border border-ocean-300 bg-ocean-50 text-ocean-950 font-medium"
          : "hover:bg-slate-100 text-slate-800"
      }`}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-start gap-2.5">
        <MessageSquare className={`mt-0.5 h-4 w-4 shrink-0 ${isActive ? "text-ocean-600" : "text-slate-400"}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{session.title || "Rockies Trip Inquiry"}</p>
          {session.lastMessageSnippet && (
            <p className="truncate text-xs text-slate-500 font-normal">{session.lastMessageSnippet}</p>
          )}
          <span className="mt-0.5 block text-[10px] text-slate-400 font-normal">{time}</span>
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Delete chat"
        title="Delete chat"
        className="ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-0 transition-opacity hover:bg-rose-100 hover:text-rose-700 group-hover:opacity-100 focus:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
