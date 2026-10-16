"use client";

// The blog post content editor: rich text like Webflow's (headings, bold, italic, lists, quotes),
// plus images (upload or the site library), links to the site's own pages or other https addresses,
// and tables. It saves the Markdown subset the blog renders (see ./markdown.ts), so the post shows
// exactly what was written here and no HTML from the editor ever reaches the site.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Columns3,
  Heading2,
  Heading3,
  Heading4,
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  Rows3,
  Search,
  Table as TableIcon,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { ImageField } from "@/components/admin/seo/ImageField";
import { field, labelCls, portalApi, primaryBtn, quietBtn } from "@/components/admin/seo/shared";
import { imageSrc, safeHref } from "@/components/seo/GuideMarkdown";
import { docToMarkdown, markdownToDoc } from "./markdown";

type Panel = "link" | "image" | null;

function ToolButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      // Keep the text selection: a mousedown on the button would otherwise blur the editor first.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg px-2 text-sm disabled:opacity-40 ${active ? "bg-obsidian-900 text-white" : "text-obsidian-900 hover:bg-obsidian-100"}`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span aria-hidden="true" className="mx-1 h-6 w-px bg-obsidian-900/10" />;

interface SitePage {
  path: string;
  label: string;
}

function LinkPanel({ editor, idBase, onClose }: { editor: Editor; idBase: string; onClose: () => void }) {
  const current = (editor.getAttributes("link").href as string | undefined) ?? "";
  const [href, setHref] = useState(current);
  const [q, setQ] = useState("");
  const [pages, setPages] = useState<SitePage[] | null>(null);
  const [error, setError] = useState("");
  const hasSelection = !editor.state.selection.empty;

  useEffect(() => {
    let cancelled = false;
    void portalApi<{ pages: SitePage[] }>("/page-keywords").then((res) => {
      if (!cancelled) setPages(res.ok ? res.data.pages : []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (pages ?? []).filter((p) => !term || `${p.label} ${p.path}`.toLowerCase().includes(term)).slice(0, 8);
  }, [pages, q]);

  function apply(target: string, label?: string) {
    const safe = safeHref(target);
    if (!safe) return setError("Use a site address starting with /, or a full https:// address.");
    const chain = editor.chain().focus();
    if (hasSelection || editor.isActive("link")) chain.extendMarkRange("link").setLink({ href: safe }).run();
    else chain.insertContent({ type: "text", text: label ?? safe, marks: [{ type: "link", attrs: { href: safe } }] }).insertContent(" ").run();
    onClose();
  }

  return (
    <div className="border-b border-obsidian-900/10 bg-obsidian-50/70 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor={`${idBase}-href`} className={labelCls}>
            Link address
          </label>
          <input
            id={`${idBase}-href`}
            value={href}
            onChange={(e) => {
              setHref(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply(href);
              }
            }}
            placeholder="/private-tours or https://…"
            className={`${field} font-mono text-sm`}
            autoFocus
          />
        </div>
        <button type="button" onClick={() => apply(href)} disabled={!href.trim()} className={primaryBtn}>
          {current ? "Update link" : "Add link"}
        </button>
        {current && (
          <button
            type="button"
            onClick={() => {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              onClose();
            }}
            className={quietBtn}
          >
            <Link2Off className="h-4 w-4" aria-hidden="true" />
            Remove link
          </button>
        )}
        <button type="button" onClick={onClose} className={quietBtn}>
          <X className="h-4 w-4" aria-hidden="true" />
          Close
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-4">
        <label htmlFor={`${idBase}-pages`} className={labelCls}>
          Or link to a page on the site
        </label>
        <span className="relative block max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input id={`${idBase}-pages`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tours, pages and posts" className={`${field} pl-9`} />
        </span>
        {!pages ? (
          <p className="mt-2 text-sm text-slate-600">Loading pages…</p>
        ) : shown.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No pages match.</p>
        ) : (
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {shown.map((p) => (
              <li key={p.path}>
                <button type="button" onClick={() => apply(p.path, p.label)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white">
                  <span className="block truncate text-obsidian-900">{p.label}</span>
                  <span className="block truncate font-mono text-slate-600">{p.path}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!hasSelection && !current && <p className="mt-2 text-sm text-slate-600">Tip: select some text first to turn it into the link. Otherwise the page name is added as the link text.</p>}
      </div>
    </div>
  );
}

function ImagePanel({ editor, idBase, onClose }: { editor: Editor; idBase: string; onClose: () => void }) {
  const [src, setSrc] = useState("");
  const [alt, setAlt] = useState("");
  const [error, setError] = useState("");

  function insert() {
    const safe = imageSrc(src);
    if (!safe) return setError("Upload an image, pick one from the library, or enter a /media/… or https:// address.");
    editor.chain().focus().setImage({ src: safe, alt: alt.trim() || undefined }).run();
    onClose();
  }

  return (
    <div className="space-y-4 border-b border-obsidian-900/10 bg-obsidian-50/70 p-4">
      <ImageField
        id={`${idBase}-img`}
        label="Image in the post"
        value={src}
        onChange={(v) => {
          setSrc(v);
          setError("");
        }}
        aspect="aspect-[4/3]"
        onUploaded={(img) => {
          if (!alt.trim() && img.alt) setAlt(img.alt);
        }}
      />
      <div className="max-w-xl">
        <label htmlFor={`${idBase}-alt`} className={labelCls}>
          Alt text (describe the image for search engines and screen readers)
        </label>
        <input id={`${idBase}-alt`} value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} placeholder="Moraine Lake at sunrise with the Valley of the Ten Peaks" className={field} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={insert} disabled={!src.trim()} className={primaryBtn}>
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          Insert image
        </button>
        <button type="button" onClick={onClose} className={quietBtn}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function RichTextEditor({ id, value, onChange, disabled, labelledBy }: { id: string; value: string; onChange: (markdown: string) => void; disabled?: boolean; labelledBy?: string }) {
  const uid = useId();
  const [panel, setPanel] = useState<Panel>(null);
  const lastValue = useRef(value);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", isAllowedUri: (url) => safeHref(url) !== null },
      }),
      Image.configure({ inline: false }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: "Write the post here. Use the toolbar for headings, lists, images, links and tables." }),
    ],
    content: markdownToDoc(value),
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
        class: "vc-post-body min-h-[22rem] px-5 py-4 outline-none",
      },
    },
    onUpdate: ({ editor: e }) => {
      const md = docToMarkdown(e.getJSON());
      if (md !== lastValue.current) {
        lastValue.current = md;
        onChange(md);
      }
    },
  });

  useEffect(() => {
    // No update event: toggling editability isn't an edit.
    if (editor && editor.isEditable === !!disabled) editor.setEditable(!disabled, false);
  }, [editor, disabled]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            p: e.isActive("paragraph"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            h4: e.isActive("heading", { level: 4 }),
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            ul: e.isActive("bulletList"),
            ol: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            link: e.isActive("link"),
            table: e.isActive("table"),
            undo: e.can().undo(),
            redo: e.can().redo(),
          }
        : null,
  });

  const c = () => editor!.chain().focus();
  return (
    <div className="overflow-hidden rounded-2xl border border-obsidian-900/15 bg-white focus-within:ring-2 focus-within:ring-ocean-600">
      {editor && state && !disabled && (
        <>
          <div role="toolbar" aria-label="Formatting" aria-controls={id} className="flex flex-wrap items-center gap-0.5 border-b border-obsidian-900/10 bg-white px-2 py-1.5">
            <ToolButton label="Paragraph" active={state.p && !state.quote} onClick={() => c().setParagraph().run()}>
              <Pilcrow className="h-4 w-4" aria-hidden="true" />
            </ToolButton>
            <ToolButton label="Heading 2" active={state.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}>
              <Heading2 className="h-4 w-4" aria-hidden="true" />
            </ToolButton>
            <ToolButton label="Heading 3" active={state.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}>
              <Heading3 className="h-4 w-4" aria-hidden="true" />
            </ToolButton>
            <ToolButton label="Heading 4" active={state.h4} onClick={() => c().toggleHeading({ level: 4 }).run()}>
              <Heading4 className="h-4 w-4" aria-hidden="true" />
            </ToolButton>
            <Sep />
            <ToolButton label="Bold" active={state.bold} onClick={() => c().toggleBold().run()}>
              <Bold className="h-4 w-4" aria-hidden="true" />
            </ToolButton>
            <ToolButton label="Italic" active={state.italic} onClick={() => c().toggleItalic().run()}>
              <Italic className="h-4 w-4" aria-hidden="true" />
            </ToolButton>
            <ToolButton label={state.link ? "Edit link" : "Add link"} active={state.link || panel === "link"} onClick={() => setPanel(panel === "link" ? null : "link")}>
              <Link2 className="h-4 w-4" aria-hidden="true" />
            </ToolButton>
            <Sep />
            <ToolButton label="Bulleted list" active={state.ul} onClick={() => c().toggleBulletList().run()}>
              <List className="h-4 w-4" aria-hidden="true" />
            </ToolButton>
            <ToolButton label="Numbered list" active={state.ol} onClick={() => c().toggleOrderedList().run()}>
              <ListOrdered className="h-4 w-4" aria-hidden="true" />
            </ToolButton>
            <ToolButton label="Quote" active={state.quote} onClick={() => c().toggleBlockquote().run()}>
              <Quote className="h-4 w-4" aria-hidden="true" />
            </ToolButton>
            <Sep />
            <ToolButton label="Insert image" active={panel === "image"} onClick={() => setPanel(panel === "image" ? null : "image")}>
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
            </ToolButton>
            <ToolButton label="Insert table" disabled={state.table} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
              <TableIcon className="h-4 w-4" aria-hidden="true" />
            </ToolButton>
            <Sep />
            <ToolButton label="Undo" disabled={!state.undo} onClick={() => c().undo().run()}>
              <Undo2 className="h-4 w-4" aria-hidden="true" />
            </ToolButton>
            <ToolButton label="Redo" disabled={!state.redo} onClick={() => c().redo().run()}>
              <Redo2 className="h-4 w-4" aria-hidden="true" />
            </ToolButton>
          </div>
          {state.table && (
            <div role="toolbar" aria-label="Table" aria-controls={id} className="flex flex-wrap items-center gap-0.5 border-b border-obsidian-900/10 bg-obsidian-50 px-2 py-1.5 text-sm">
              <span className="px-2 text-slate-600">Table:</span>
              <ToolButton label="Add row below" onClick={() => c().addRowAfter().run()}>
                <Rows3 className="h-4 w-4" aria-hidden="true" />
                Add row
              </ToolButton>
              <ToolButton label="Add column to the right" onClick={() => c().addColumnAfter().run()}>
                <Columns3 className="h-4 w-4" aria-hidden="true" />
                Add column
              </ToolButton>
              <ToolButton label="Delete row" onClick={() => c().deleteRow().run()}>
                Delete row
              </ToolButton>
              <ToolButton label="Delete column" onClick={() => c().deleteColumn().run()}>
                Delete column
              </ToolButton>
              <ToolButton label="Delete table" onClick={() => c().deleteTable().run()}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete table
              </ToolButton>
            </div>
          )}
          {panel === "link" && <LinkPanel editor={editor} idBase={uid} onClose={() => setPanel(null)} />}
          {panel === "image" && <ImagePanel editor={editor} idBase={uid} onClose={() => setPanel(null)} />}
        </>
      )}
      {!editor && <div className="min-h-[22rem] px-5 py-4 text-slate-600">Loading the editor…</div>}
      <EditorContent editor={editor} />
    </div>
  );
}
