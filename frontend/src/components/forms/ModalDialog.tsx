"use client";

// A small native modal (<dialog>.showModal(): focus is trapped, Escape closes, the page behind is
// inert). Used for the partner sign-in "not approved yet" notice and the partner admin confirms.

import { useEffect, useId, useRef, type ReactNode } from "react";

export function ModalDialog({
  open,
  onClose,
  title,
  icon,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  actions: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-none bg-white p-0 text-obsidian-900 shadow-2xl backdrop:bg-obsidian-950/60 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="space-y-4 p-6 sm:p-7">
          {icon}
          <h2 id={titleId} className="text-2xl font-light text-obsidian-900">
            {title}
          </h2>
          <div className="space-y-3 text-base text-slate-700">{children}</div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">{actions}</div>
        </div>
      )}
    </dialog>
  );
}
