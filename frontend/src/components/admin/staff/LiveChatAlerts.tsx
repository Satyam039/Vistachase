"use client";

// Live chat alerts on every staff page (mounted by AdminHeader). Polls
// /api/admin/live-chats/pending; when a guest starts a chat or writes again it plays a chime, shows
// a browser notification (once staff allow it, and only on https or localhost, where browsers offer
// notifications), puts the count in the tab title and shows a banner linking to Admin → Live chat.
// Phone alerts (Telegram / ntfy) come from the backend (modules/support/staff-alerts.ts).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Headset } from "lucide-react";

interface Pending {
  waiting: number;
  latest: { id: string; name: string; at: string } | null;
}

const PREF = "vc-live-chat-alerts";
let audio: AudioContext | null = null;

function audioContext(): AudioContext | null {
  try {
    audio ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return audio;
  } catch {
    return null;
  }
}

/** Two short tones. Browsers play sound only after the person has clicked on the page once. */
export function chime() {
  const ctx = audioContext();
  if (!ctx) return;
  void ctx.resume().catch(() => undefined);
  [880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const at = ctx.currentTime + i * 0.18;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.32);
  });
}

const notificationsAvailable = () => typeof window !== "undefined" && "Notification" in window && window.isSecureContext;

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF) !== "off";
  } catch {
    return true;
  }
}

export function LiveChatAlerts({ onLiveChatPage = false }: { onLiveChatPage?: boolean }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | "unavailable">("unavailable");
  const seen = useRef<string | null>(null);
  const baseTitle = useRef<string>("");

  useEffect(() => {
    setEnabled(readPref());
    setPermission(notificationsAvailable() ? Notification.permission : "unavailable");
    baseTitle.current = document.title.replace(/^\(\d+\) /, "");
    // Browsers allow sound only after a click: unlock the chime on the first one.
    const unlock = () => void audioContext()?.resume().catch(() => undefined);
    document.addEventListener("pointerdown", unlock, { once: true });
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/live-chats/pending", { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as Pending;
      setPending(next);
      const key = next.latest ? `${next.latest.id}@${next.latest.at}` : null;
      // Alert on anything newer than what this page last saw (not on the first load).
      if (key && seen.current !== null && key !== seen.current && enabled) {
        chime();
        if (notificationsAvailable() && Notification.permission === "granted" && (document.hidden || !onLiveChatPage)) {
          const n = new Notification("Live chat - Vista Chase", {
            body: `${next.latest!.name} is waiting for an agent.`,
            tag: `live-chat-${next.latest!.id}`,
          });
          n.onclick = () => {
            window.focus();
            window.location.href = `/admin/live-chat?chat=${encodeURIComponent(next.latest!.id)}`;
          };
        }
      }
      seen.current = key ?? "";
      document.title = next.waiting ? `(${next.waiting}) ${baseTitle.current}` : baseTitle.current;
    } catch {
      /* offline for a moment */
    }
  }, [enabled, onLiveChatPage]);

  useEffect(() => {
    void poll();
    const timer = setInterval(() => void poll(), 8000);
    return () => clearInterval(timer);
  }, [poll]);

  const turnOn = async () => {
    audioContext()?.resume().catch(() => undefined);
    chime();
    try {
      localStorage.setItem(PREF, "on");
    } catch {
      /* ignore */
    }
    setEnabled(true);
    if (notificationsAvailable() && Notification.permission === "default") {
      setPermission(await Notification.requestPermission());
    }
  };

  const turnOff = () => {
    try {
      localStorage.setItem(PREF, "off");
    } catch {
      /* ignore */
    }
    setEnabled(false);
  };

  const waiting = pending?.waiting ?? 0;
  const needsSetup = enabled && permission === "default";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {waiting > 0 && !onLiveChatPage && (
        <Link
          href={`/admin/live-chat${pending?.latest ? `?chat=${encodeURIComponent(pending.latest.id)}` : ""}`}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-summit-300 px-4 text-sm text-obsidian-900 hover:bg-summit-200"
        >
          <Headset className="h-4 w-4" aria-hidden="true" />
          {waiting === 1 ? "1 guest waiting in live chat" : `${waiting} guests waiting in live chat`}
        </Link>
      )}
      {enabled ? (
        <button
          type="button"
          onClick={needsSetup ? turnOn : turnOff}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-obsidian-900/10 bg-white px-4 text-sm text-obsidian-900 hover:bg-obsidian-50"
          title={needsSetup ? "Allow browser notifications for new live chats" : "Turn off the chime and notifications for new live chats"}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {needsSetup ? "Turn on chat alerts" : "Chat alerts on"}
        </button>
      ) : (
        <button type="button" onClick={turnOn} className="inline-flex h-10 items-center gap-2 rounded-full border border-obsidian-900/10 bg-white px-4 text-sm text-slate-700 hover:bg-obsidian-50">
          <BellOff className="h-4 w-4" aria-hidden="true" />
          Chat alerts off
        </button>
      )}
    </div>
  );
}
