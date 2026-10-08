"use client";

// Floating "Ask AI concierge" button on every page (except /concierge), opening the chat in a
// panel: a floating card on the right on desktop (like ChatGPT / Intercom side chats), full
// screen on phones. The panel is a modal dialog: focus moves into the composer, Esc or the
// close button closes it, and focus returns to the launcher.

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { ConciergeChat } from "./ConciergeChat";

export function GlobalVoiceAssistantDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Close on route change (e.g. a link inside the chat).
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const el = panel.current;
    el?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      // Keep Tab inside the dialog.
      if (e.key === "Tab" && el) {
        const items = el.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),textarea,[tabindex="0"]');
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    if (window.matchMedia("(max-width: 639px)").matches) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => launcher.current?.focus());
  }

  if (pathname === "/concierge") return null;

  return (
    <>
      <button
        ref={launcher}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`fixed bottom-[calc(1.5rem+var(--vc-bottom-bar-h,0px))] right-6 z-40 inline-flex h-14 items-center gap-2.5 rounded-full bg-obsidian-900 pl-2 pr-5 text-white shadow-[0_18px_40px_-16px_rgba(12,31,33,0.7)] ring-1 ring-white/10 transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-summit-500 ${
          open ? "pointer-events-none opacity-0" : ""
        }`}
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-summit-200 text-obsidian-900">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="text-sm max-sm:sr-only">Ask AI concierge</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end sm:p-4">
          <button type="button" aria-label="Close concierge" tabIndex={-1} onClick={close} className="absolute inset-0 cursor-default bg-obsidian-950/30 sm:bg-obsidian-950/20" />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Vista Chase AI concierge"
            className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_30px_80px_-20px_rgba(12,31,33,0.45)] sm:max-w-[440px] sm:rounded-[1.75rem] sm:ring-1 sm:ring-obsidian-900/10 motion-safe:animate-[fadeUp_350ms_ease-out]"
          >
            <ConciergeChat variant="panel" onClose={close} />
          </div>
        </div>
      )}
    </>
  );
}
