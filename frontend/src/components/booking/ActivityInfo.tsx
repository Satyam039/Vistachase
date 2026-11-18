"use client";

// The (i) beside each add-on activity (owner, 2026-11-18): a short description, what's included and
// useful details. Opens on click or tap (phones), and on hover with a mouse; Escape or a click
// elsewhere closes it. A plain button with aria-expanded, so it works by keyboard too.

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";
import type { PackageActivity } from "@/lib/activityAddOns";

export function ActivityInfo({ activity }: { activity: PackageActivity }) {
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const root = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = () => {
      pinned.current = false;
      setOpen(false);
    };
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const { about, includes, good } = activity.info;
  return (
    <span
      ref={root}
      className="relative inline-flex"
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && !pinned.current && setOpen(false)}
    >
      <button
        type="button"
        aria-label={`About ${activity.name}`}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ocean-600 hover:bg-ocean-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean-600"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          pinned.current = !open || !pinned.current;
          setOpen(pinned.current);
        }}
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className="absolute right-0 top-9 z-30 block w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 bg-white p-4 text-left text-xs text-slate-700 shadow-lg"
        >
          <span className="block text-sm text-obsidian-900">{activity.name}</span>
          <span className="mt-1 block">{about}</span>
          <span className="mt-2 block text-obsidian-900">What&apos;s included</span>
          {includes.map((x) => (
            <span key={x} className="mt-1 block">
              · {x}
            </span>
          ))}
          <span className="mt-2 block text-obsidian-900">Good to know</span>
          {good.map((x) => (
            <span key={x} className="mt-1 block">
              · {x}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
