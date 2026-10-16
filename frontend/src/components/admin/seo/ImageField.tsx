"use client";

// An image setting (featured image, Open Graph image, blog thumbnail): a preview, a picker over the
// site's photo library and earlier uploads, an upload button, and the address itself for anyone who
// wants to paste one. Uploads go to POST /api/seo/portal/media, which re-encodes them as WebP under
// /media/uploads/seo; nothing here changes the page until the form around it is saved.

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ImagePlus, Images, Search, Upload, X } from "lucide-react";
import { errorOf, field, labelCls, portalApi, quietBtn } from "@/components/admin/seo/shared";

export interface LibraryImage {
  src: string;
  alt: string;
  title: string;
  width: number | null;
  height: number | null;
  source: "library" | "upload";
  uploadedAt?: string;
  uploadedBy?: string | null;
}

const MAX_BYTES = 8 * 1024 * 1024;
const SHOWN = 60;

const previewable = (src: string) => src.startsWith("/media/") || src.startsWith("https://");

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function Library({ idBase, selected, onPick, onClose }: { idBase: string; selected: string; onPick: (img: LibraryImage) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [images, setImages] = useState<LibraryImage[] | null>(null);
  const [error, setError] = useState("");
  const [source, setSource] = useState<"all" | "upload" | "library">("all");

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const res = await portalApi<{ images: LibraryImage[] }>(`/media${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
      if (cancelled) return;
      if (res.ok) {
        setImages(res.data.images);
        setError("");
      } else setError(errorOf(res.data, "Couldn't load the image library."));
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q]);

  const shown = (images ?? []).filter((i) => source === "all" || i.source === source);
  return (
    <div className="mt-3 rounded-2xl border border-obsidian-900/10 bg-obsidian-50/60 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor={`${idBase}-q`} className={labelCls}>
            Search the library
          </label>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input id={`${idBase}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Moraine Lake, gondola, winter…" className={`${field} pl-9`} />
          </span>
        </div>
        <div role="group" aria-label="Show" className="flex gap-1">
          {(
            [
              ["all", "All"],
              ["upload", "Uploaded"],
              ["library", "Site photos"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={source === value}
              onClick={() => setSource(value)}
              className={`h-10 rounded-full px-4 text-sm ${source === value ? "bg-obsidian-900 text-white" : "border border-obsidian-900/10 bg-white text-obsidian-900"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className={quietBtn}>
          <X className="h-4 w-4" aria-hidden="true" />
          Close
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {!images ? (
        <p className="mt-4 text-sm text-slate-600">Loading images…</p>
      ) : shown.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No images match.</p>
      ) : (
        <>
          <p className="mt-3 text-sm text-slate-600" aria-live="polite">
            {shown.length > SHOWN ? `Showing ${SHOWN} of ${shown.length}; search to narrow them down.` : `${shown.length} ${shown.length === 1 ? "image" : "images"}.`}
          </p>
          <ul className="mt-3 grid max-h-[26rem] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
            {shown.slice(0, SHOWN).map((img) => (
              <li key={img.src}>
                <button
                  type="button"
                  onClick={() => onPick(img)}
                  aria-pressed={selected === img.src}
                  className={`group block w-full overflow-hidden rounded-xl bg-white text-left ring-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600 ${selected === img.src ? "ring-2 ring-ocean-600" : "ring-obsidian-900/10 hover:ring-obsidian-900/30"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- thumbnails of arbitrary library files */}
                  <img src={img.src} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  <span className="block truncate px-2.5 pt-2 text-sm text-obsidian-900">{img.alt || img.title}</span>
                  <span className="block truncate px-2.5 pb-2 text-sm text-slate-600">
                    {img.source === "upload" ? "Uploaded" : "Site photo"}
                    {img.width && img.height ? ` · ${img.width}×${img.height}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function ImageField({
  id,
  label,
  value,
  onChange,
  fallback,
  fallbackLabel = "Default",
  hint,
  aspect = "aspect-[1200/630]",
  disabled,
  onUploaded,
  stacked,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (src: string) => void;
  /** Shown when no image is set: the image the page uses anyway. */
  fallback?: string | null;
  fallbackLabel?: string;
  hint?: ReactNode;
  aspect?: string;
  disabled?: boolean;
  /** Called after an upload or a library pick, with the image's alt text when it has one. */
  onUploaded?: (img: { src: string; alt: string }) => void;
  /** Preview above the controls, for narrow columns. */
  stacked?: boolean;
}) {
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const shown = value.trim() || fallback || "";
  const usingFallback = !value.trim() && !!fallback;
  const hintId = `${id}-hint`;

  const upload = useCallback(
    async (file: File) => {
      setError("");
      setNotice("");
      if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return setError("Choose a JPEG, PNG, WebP, GIF or AVIF image.");
      if (file.size > MAX_BYTES) return setError("The image is larger than 8 MB. Export a smaller copy and try again.");
      setBusy(true);
      try {
        const data = await readAsDataUrl(file);
        const res = await portalApi<{ image: LibraryImage }>("/media", "POST", { data, fileName: file.name });
        if (!res.ok) return setError(errorOf(res.data, "Couldn't upload the image."));
        onChange(res.data.image.src);
        onUploaded?.({ src: res.data.image.src, alt: res.data.image.alt });
        setNotice(`Uploaded (${res.data.image.width}×${res.data.image.height}). Save the page to use it.`);
      } catch {
        setError("Couldn't read that file.");
      } finally {
        setBusy(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [onChange, onUploaded],
  );

  return (
    <div>
      <p id={`${id}-label`} className={labelCls}>
        {label}
      </p>
      <div className={`grid gap-4 ${stacked ? "" : "sm:grid-cols-[minmax(0,16rem)_1fr]"}`}>
        <div className={`relative ${aspect} w-full overflow-hidden rounded-xl bg-obsidian-100 ring-1 ring-obsidian-900/10`}>
          {shown && previewable(shown) ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview of whatever address is entered
            <img src={shown} alt="" className={`h-full w-full object-cover ${usingFallback ? "opacity-60" : ""}`} />
          ) : (
            <span className="flex h-full items-center justify-center text-sm text-slate-600">No image</span>
          )}
          {usingFallback && <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2.5 py-0.5 text-sm text-obsidian-900">{fallbackLabel}</span>}
        </div>
        <div className="min-w-0 space-y-3">
          {!disabled && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={quietBtn}>
                <Images className="h-4 w-4" aria-hidden="true" />
                Choose from library
              </button>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={quietBtn}>
                {busy ? <ImagePlus className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                {busy ? "Uploading…" : "Upload image"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
              {value.trim() && (
                <button type="button" onClick={() => onChange("")} className={quietBtn}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  Remove
                </button>
              )}
            </div>
          )}
          <div>
            <label htmlFor={id} className="mb-1 block text-sm text-slate-600">
              Image address
            </label>
            <input
              id={id}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={fallback ?? "/media/…"}
              aria-describedby={hint ? hintId : undefined}
              disabled={disabled}
              className={`${field} font-mono text-sm`}
            />
          </div>
          {hint && (
            <p id={hintId} className="text-sm text-slate-600">
              {hint}
            </p>
          )}
          <div aria-live="polite">
            {notice && <p className="text-sm text-ocean-800">{notice}</p>}
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </div>
      {open && (
        <Library
          idBase={uid}
          selected={value}
          onClose={() => setOpen(false)}
          onPick={(img) => {
            onChange(img.src);
            onUploaded?.({ src: img.src, alt: img.alt });
            setNotice("Image chosen. Save the page to use it.");
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
