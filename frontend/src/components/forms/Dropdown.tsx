"use client";

// The one dropdown for the whole site (replaces native <select> and the Astryx Selector so every
// list looks and behaves the same on every browser and OS). WAI-ARIA "select-only combobox":
//   trigger: role=combobox button, aria-activedescendant while open (focus never leaves it);
//   keys: ↓/↑/Enter/Space/Alt+↓ open · ↓ ↑ Home End PageUp PageDown move · type to jump ·
//         Enter/Space pick · Esc closes · Tab picks the highlighted option and moves on;
//   searchable lists put a filter field at the top of the panel (focus moves into it).
// The panel is portalled and fixed-positioned under the trigger (flips above when there is no
// room), so tables and overflow-hidden cards can't clip it. A hidden input carries `name` so plain
// GET/POST forms still submit. Variants: "field" (forms), "pill" (filter bars), "bare" (segments
// inside the hero search bar, where the parent draws the box).

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

type Variant = "field" | "pill" | "bare";

const TRIGGER: Record<Variant, string> = {
  field:
    "h-12 w-full rounded-2xl border border-obsidian-900/15 bg-white px-4 text-base text-obsidian-900 hover:border-obsidian-900/30 focus-visible:border-ocean-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600/30",
  pill: "h-11 w-full rounded-full border border-obsidian-900/15 bg-white px-4 text-sm text-obsidian-900 hover:border-obsidian-900/30 focus-visible:border-ocean-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600/30",
  bare: "mt-0.5 w-full rounded-md bg-transparent text-base text-obsidian-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600/40",
};

export function Dropdown({
  label,
  hideLabel = false,
  labelClassName = "mb-1.5 block text-sm text-slate-700",
  options,
  value,
  defaultValue,
  onChange,
  name,
  variant = "field",
  icon: Icon,
  placeholder = "Select…",
  searchable = false,
  searchPlaceholder = "Search",
  className = "",
  triggerClassName = "",
  id,
  invalid,
  describedBy,
  disabled,
}: {
  label: ReactNode;
  hideLabel?: boolean;
  labelClassName?: string;
  options: DropdownOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  variant?: Variant;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  triggerClassName?: string;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}) {
  const uid = useId();
  const triggerId = id ?? `dd-${uid}`;
  const labelId = `${triggerId}-label`;
  const listId = `${triggerId}-list`;

  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;
  const selected = options.find((o) => o.value === current);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number; up: boolean } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.label} ${o.description ?? ""}`.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const enabledIndex = useCallback(
    (from: number, step: 1 | -1) => {
      for (let i = from; i >= 0 && i < shown.length; i += step) if (!shown[i].disabled) return i;
      return -1;
    },
    [shown],
  );

  const choose = (opt: DropdownOption | undefined) => {
    if (!opt || opt.disabled) return;
    if (value === undefined) setInner(opt.value);
    onChange?.(opt.value);
    close();
  };

  const close = (refocus = true) => {
    setOpen(false);
    setPos(null);
    setQuery("");
    if (refocus) trigger.current?.focus();
  };

  const openList = (at?: "first" | "last") => {
    if (disabled) return;
    setOpen(true);
    const sel = options.findIndex((o) => o.value === current);
    setActive(at === "first" ? enabledIndex(0, 1) : at === "last" ? enabledIndex(options.length - 1, -1) : sel >= 0 ? sel : enabledIndex(0, 1));
  };

  // Place the panel under (or above) the trigger; follow scroll and resize while open.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = trigger.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const up = below < 240 && above > below;
      const maxHeight = Math.min(360, Math.max(160, up ? above : below) - 8);
      const width = Math.max(r.width, 224);
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
      setPos({ top: up ? r.top - 8 : r.bottom + 8, left, width, maxHeight, up });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Outside click closes (without stealing focus from whatever was clicked).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!trigger.current?.contains(t) && !panel.current?.contains(t)) close(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The panel mounts once it has a position, so focus the filter field after that.
  const placed = pos !== null;
  useEffect(() => {
    if (open && searchable && placed) search.current?.focus();
  }, [open, searchable, placed]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (!open || active < 0) return;
    panel.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  // Searching resets the highlight to the first match.
  useEffect(() => {
    if (open && query) setActive(enabledIndex(0, 1));
  }, [query, open, enabledIndex]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList(e.key === "ArrowUp" ? "last" : undefined);
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        if (searchable) {
          // Typing on a closed searchable list opens it and starts the filter with that letter.
          e.preventDefault();
          openList();
          setQuery(e.key);
        } else jump(e.key, true);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => (enabledIndex(a + 1, 1) >= 0 ? enabledIndex(a + 1, 1) : a));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (e.altKey) return choose(shown[active]);
        setActive((a) => (enabledIndex(a - 1, -1) >= 0 ? enabledIndex(a - 1, -1) : a));
        break;
      case "Home":
        e.preventDefault();
        setActive(enabledIndex(0, 1));
        break;
      case "End":
        e.preventDefault();
        setActive(enabledIndex(shown.length - 1, -1));
        break;
      case "PageDown":
        e.preventDefault();
        setActive((a) => enabledIndex(Math.min(shown.length - 1, a + 10), -1));
        break;
      case "PageUp":
        e.preventDefault();
        setActive((a) => enabledIndex(Math.max(0, a - 10), 1));
        break;
      case "Enter":
        e.preventDefault();
        choose(shown[active]);
        break;
      case " ":
        if (!searchable) {
          e.preventDefault();
          choose(shown[active]);
        }
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        if (shown[active] && shown[active].value !== current) choose(shown[active]);
        close(false);
        break;
      default:
        if (!searchable && e.key.length === 1 && !e.metaKey && !e.ctrlKey) jump(e.key, false);
    }
  };

  // Type-ahead: letters typed within half a second build a prefix to match.
  const jump = (key: string, select: boolean) => {
    const now = Date.now();
    typed.current = { text: now - typed.current.at < 500 ? typed.current.text + key.toLowerCase() : key.toLowerCase(), at: now };
    const start = Math.max(0, active);
    const order = [...options.slice(start + 1), ...options.slice(0, start + 1)];
    const hit = order.find((o) => !o.disabled && o.label.toLowerCase().startsWith(typed.current.text)) ?? order.find((o) => !o.disabled && o.label.toLowerCase().startsWith(key.toLowerCase()));
    if (!hit) return;
    if (select) {
      if (value === undefined) setInner(hit.value);
      onChange?.(hit.value);
    } else setActive(options.indexOf(hit));
  };

  const activeId = open && active >= 0 && shown[active] ? `${listId}-${active}` : undefined;

  return (
    <div className={`relative min-w-0 ${className}`}>
      <label id={labelId} htmlFor={triggerId} className={hideLabel ? "sr-only" : labelClassName}>
        {label}
      </label>
      {name && <input type="hidden" name={name} value={current} />}
      <div className="relative">
        {Icon && variant !== "bare" && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ocean-600" aria-hidden="true" />}
        <button
          ref={trigger}
          id={triggerId}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-labelledby={labelId}
          aria-activedescendant={searchable ? undefined : activeId}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          onClick={() => (open ? close() : openList())}
          onKeyDown={onKey}
          className={`flex min-w-0 items-center justify-between gap-2 text-left transition-[border-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-60 ${TRIGGER[variant]} ${
            Icon && variant !== "bare" ? "pl-10" : ""
          } ${invalid ? "border-red-500" : ""} ${triggerClassName}`}
        >
          <span className={`min-w-0 truncate ${selected ? "" : "text-slate-500"}`}>{selected?.label ?? placeholder}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panel}
            style={{ position: "fixed", left: pos.left, width: pos.width, maxHeight: pos.maxHeight, ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}
            className={`z-[60] flex flex-col overflow-hidden rounded-2xl bg-white text-obsidian-900 shadow-[0_24px_60px_-20px_rgba(12,31,33,0.45)] ring-1 ring-obsidian-900/10 motion-safe:animate-[vcDropIn_160ms_ease-out] ${
              pos.up ? "origin-bottom" : "origin-top"
            }`}
          >
            {searchable && (
              <div className="border-b border-obsidian-900/[0.06] p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                  <input
                    ref={search}
                    type="text"
                    role="searchbox"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKey}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    aria-controls={listId}
                    aria-activedescendant={activeId}
                    autoComplete="off"
                    className="h-10 w-full rounded-xl bg-obsidian-50 pl-9 pr-3 text-base text-obsidian-900 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600/40"
                  />
                </div>
              </div>
            )}
            <ul id={listId} role="listbox" aria-labelledby={labelId} className="overflow-y-auto overscroll-contain p-1.5">
              {shown.length === 0 && <li className="px-3 py-3 text-sm text-slate-600">No matches</li>}
              {shown.map((o, i) => {
                const isSel = o.value === current;
                return (
                  <li
                    key={o.value}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSel}
                    aria-disabled={o.disabled || undefined}
                    onPointerMove={() => !o.disabled && setActive(i)}
                    onClick={() => choose(o)}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 text-base ${i === active ? "bg-ocean-50" : ""} ${
                      o.disabled ? "cursor-not-allowed text-slate-400" : ""
                    }`}
                  >
                    <Check className={`mt-1 h-4 w-4 shrink-0 text-ocean-600 ${isSel ? "" : "invisible"}`} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className={`block ${isSel ? "text-obsidian-900" : ""}`}>{o.label}</span>
                      {o.description && <span className={`block text-sm ${o.disabled ? "text-slate-400" : "text-slate-600"}`}>{o.description}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
