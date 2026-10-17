"use client";

// Two panels of the page editor that save on their own, apart from the page's fields:
// - Schema markup: this page's JSON-LD blocks (the SEO portal's /schema endpoints, page scope).
//   Anyone can check JSON; an SEO manager or admin saves and publishes. A published block is added
//   to the page next to the schema the page's code already renders.
// - Custom code: Webflow's "Inside <head> tag" and "Before </body> tag" boxes. Anyone can check the
//   code; only an admin can save it, and the server accepts a short list of tags only
//   (backend/src/modules/seo/portal/custom-code.ts).
// Both boxes have Prettify and Find (CodeTools.tsx).

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CodeToolbar } from "@/components/admin/seo/CodeTools";
import { CheckList, Chip, Empty, Panel, STATUS_STYLE, errorOf, field, labelCls, portalApi, primaryBtn, quietBtn, when, words, type FieldCheck, type PublishStatus } from "@/components/admin/seo/shared";

type Level = "error" | "warning" | "info";

interface Block {
  id: string;
  scope: "SITE" | "PAGE";
  pageId: string | null;
  name: string;
  schemaType: string;
  json: unknown;
  draftJson: unknown;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  validation: { level: Level; message: string }[];
  publishedAt: string | null;
  updatedAt: string;
}

interface LiveBlock {
  ok: boolean;
  types: string[];
}

interface Me {
  role: "ADMIN" | "SEO_MANAGER" | "EDITOR" | "VIEWER";
  seo: { manage: boolean };
}

const asChecks = (v: { level: Level; message: string }[]): FieldCheck[] => v.map((c) => ({ field: "json", level: c.level, message: c.message }));
const pretty = (v: unknown) => (v ? JSON.stringify(v, null, 2) : "");

function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    void portalApi<Me>("/me").then((r) => r.ok && setMe(r.data));
  }, []);
  return me;
}

const STARTER = `{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": ""
}`;

// ---------------------------------------------------------------------------------------------
// Schema markup

function BlockEditor({ pageId, block, canManage, onDone }: { pageId: string; block: Block | null; canManage: boolean; onDone: (message: string) => void }) {
  const uid = useId();
  const [name, setName] = useState(block?.name ?? "");
  const [json, setJson] = useState(block ? pretty(block.draftJson ?? block.json) : STARTER);
  const [checks, setChecks] = useState<FieldCheck[]>(block ? asChecks(block.validation ?? []) : []);
  const [saved, setSaved] = useState<Block | null>(block);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const jsonRef = useRef<HTMLTextAreaElement>(null);

  async function validate() {
    setBusy("check");
    setError("");
    const res = await portalApi<{ checks: { level: Level; message: string }[]; types: string[] }>("/schema/validate", "POST", { scope: "PAGE", json });
    setBusy(null);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't check the JSON."));
    const list = asChecks(res.data.checks);
    setChecks(list.length ? list : [{ field: "json", level: "info", message: `Valid JSON-LD${res.data.types?.length ? ` (${res.data.types.join(", ")})` : ""}.` }]);
  }

  async function save(publish: boolean) {
    setBusy(publish ? "publish" : "save");
    setError("");
    const body = { scope: "PAGE", pageId, name: name.trim(), json };
    const res = saved ? await portalApi<{ block: Block; checks: { level: Level; message: string }[] }>(`/schema/${saved.id}`, "PUT", body) : await portalApi<{ block: Block; checks: { level: Level; message: string }[] }>("/schema", "POST", body);
    if (!res.ok) {
      setBusy(null);
      if (res.data.checks) setChecks(res.data.checks);
      return setError(errorOf(res.data, "Couldn't save the block."));
    }
    setSaved(res.data.block);
    setChecks(asChecks(res.data.checks ?? []));
    if (!publish) {
      setBusy(null);
      return onDone("Schema block saved as a draft. The live page is unchanged until it's published.");
    }
    const pub = await portalApi(`/schema/${res.data.block.id}/publish`, "POST", {});
    setBusy(null);
    if (!pub.ok) {
      if (pub.data.checks) setChecks(pub.data.checks);
      return setError(errorOf(pub.data, "Saved as a draft, but couldn't publish it."));
    }
    onDone("Schema block published. The live page shows it within a minute.");
  }

  return (
    <div className="space-y-4 rounded-2xl bg-obsidian-50/70 p-5 ring-1 ring-obsidian-900/[0.06]">
      <div>
        <label htmlFor={`${uid}-name`} className={labelCls}>
          Block name
        </label>
        <input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="For example: FAQ for this page" className={field} disabled={!canManage} />
      </div>
      <div>
        <label htmlFor={`${uid}-json`} className={labelCls}>
          JSON-LD
        </label>
        <CodeToolbar id={`${uid}-json`} target={jsonRef} value={json} onChange={setJson} kind="json" />
        <textarea
          ref={jsonRef}
          id={`${uid}-json`}
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={12}
          spellCheck={false}
          aria-describedby={`${uid}-json-hint`}
          className={`${field} font-mono text-sm`}
        />
        <p id={`${uid}-json-hint`} className="mt-1.5 text-sm text-slate-600">
          Paste the JSON only, without the &lt;script&gt; tag. It should describe only what the page shows.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {checks.length > 0 && (
        <div aria-live="polite">
          <CheckList checks={checks} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void validate()} disabled={busy !== null || !json.trim()} className={quietBtn}>
          {busy === "check" ? "Checking…" : "Validate"}
        </button>
        {canManage && (
          <>
            <button type="button" onClick={() => void save(false)} disabled={busy !== null || name.trim().length < 2 || !json.trim()} className={quietBtn}>
              {busy === "save" ? "Saving…" : "Save draft"}
            </button>
            <button type="button" onClick={() => void save(true)} disabled={busy !== null || name.trim().length < 2 || !json.trim()} className={primaryBtn}>
              {busy === "publish" ? "Publishing…" : "Save and publish"}
            </button>
          </>
        )}
        <button type="button" onClick={() => onDone("")} disabled={busy !== null} className={quietBtn}>
          Close
        </button>
      </div>
      {!canManage && <p className="text-sm text-slate-600">You can check JSON here. An SEO manager or admin saves and publishes schema.</p>}
    </div>
  );
}

export function PageSchemaPanel({ pageId, idBase }: { pageId: string; idBase: string }) {
  const me = useMe();
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [coded, setCoded] = useState<LiveBlock[] | null>(null);
  const [editing, setEditing] = useState<Block | "new" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const canManage = Boolean(me?.seo.manage);

  const load = useCallback(async () => {
    const res = await portalApi<{ managed: Block[]; live: { pageId: string; crawled: boolean; blocks: LiveBlock[] }[] }>("/schema");
    if (!res.ok) return setError(errorOf(res.data, "Couldn't load this page's schema."));
    setError("");
    setBlocks(res.data.managed.filter((b) => b.scope === "PAGE" && b.pageId === pageId));
    const live = res.data.live.find((p) => p.pageId === pageId);
    setCoded(live?.crawled ? live.blocks : null);
  }, [pageId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function unpublish(b: Block) {
    setBusy(b.id);
    const res = await portalApi(`/schema/${b.id}/unpublish`, "POST", {});
    setBusy(null);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't take the block off the page."));
    setMessage("Block taken off the page and kept as a draft.");
    void load();
  }

  return (
    <Panel
      id={`${idBase}-schema`}
      title="Schema markup"
      description="Structured data (JSON-LD) for this page. Blocks added here are published alongside the schema the page's template already renders."
      actions={
        editing === null && (
          <button type="button" onClick={() => setEditing("new")} className={quietBtn}>
            Add JSON-LD block
          </button>
        )
      }
    >
      <div className="space-y-5 px-6 py-6">
        <p aria-live="polite" className={message ? "rounded-2xl bg-ocean-50 px-5 py-3 text-sm text-ocean-800" : "sr-only"}>
          {message}
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        {coded && (
          <p className="text-sm text-slate-600">
            From the last audit, the live page carries {coded.length === 0 ? "no JSON-LD" : `${coded.length} JSON-LD block${coded.length === 1 ? "" : "s"}: ${Array.from(new Set(coded.flatMap((b) => b.types))).join(", ") || "untyped"}`}.
          </p>
        )}
        {blocks === null ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : blocks.length === 0 && editing === null ? (
          <Empty>No JSON-LD blocks managed for this page yet.</Empty>
        ) : (
          <ul className="divide-y divide-obsidian-900/[0.06]">
            {blocks.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-base text-obsidian-900">{b.name}</p>
                  <p className="text-sm text-slate-600">
                    {b.schemaType} · updated {when(b.updatedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip className={STATUS_STYLE[b.status as PublishStatus]}>{words(b.status)}</Chip>
                  <button type="button" onClick={() => setEditing(b)} className={quietBtn}>
                    {canManage ? "Edit" : "View"}
                  </button>
                  {canManage && b.status === "PUBLISHED" && (
                    <button type="button" onClick={() => void unpublish(b)} disabled={busy === b.id} className={quietBtn}>
                      {busy === b.id ? "Working…" : "Unpublish"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {editing !== null && (
          <BlockEditor
            key={editing === "new" ? "new" : editing.id}
            pageId={pageId}
            block={editing === "new" ? null : editing}
            canManage={canManage}
            onDone={(m) => {
              setEditing(null);
              setMessage(m);
              void load();
            }}
          />
        )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------
// Custom code

interface CheckResult {
  head: { tags: string[]; errors: string[] };
  body: { tags: string[]; errors: string[] };
}

function CodeBox({ id, label, hint, value, onChange, wrap }: { id: string; label: string; hint: string; value: string; onChange: (v: string) => void; wrap: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <CodeToolbar id={id} target={ref} value={value} onChange={onChange} kind="html" />
      <textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        spellCheck={false}
        wrap={wrap ? "soft" : "off"}
        aria-describedby={`${id}-hint`}
        className={`${field} font-mono text-sm ${wrap ? "" : "whitespace-pre"}`}
      />
      <p id={`${id}-hint`} className="mt-1.5 text-sm text-slate-600">
        {hint}
      </p>
    </div>
  );
}

export function PageCustomCodePanel({ pageId, idBase, head: savedHead, body: savedBody, onSaved }: { pageId: string; idBase: string; head: string | null; body: string | null; onSaved: () => void }) {
  const me = useMe();
  const isAdmin = me?.role === "ADMIN";
  const [head, setHead] = useState(savedHead ?? "");
  const [body, setBody] = useState(savedBody ?? "");
  const [wrap, setWrap] = useState(true);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = head !== (savedHead ?? "") || body !== (savedBody ?? "");

  useEffect(() => {
    setHead(savedHead ?? "");
    setBody(savedBody ?? "");
  }, [savedHead, savedBody]);

  async function check() {
    setBusy("check");
    setError("");
    const res = await portalApi<CheckResult>("/custom-code/check", "POST", { head, body });
    setBusy(null);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't check the code."));
    setResult(res.data);
  }

  async function save() {
    setBusy("save");
    setError("");
    setMessage("");
    const res = await portalApi<{ changed: boolean }>(`/pages/${encodeURIComponent(pageId)}/custom-code`, "PUT", { head, body });
    setBusy(null);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't save the code."));
    setResult(null);
    setMessage(res.data.changed ? "Custom code saved. A published page shows it within a minute." : "No changes to save.");
    onSaved();
  }

  const summary = (r: { tags: string[]; errors: string[] }, where: string) =>
    r.errors.length ? r.errors.map((e) => ({ ok: false, text: `${where}: ${e}` })) : [{ ok: true, text: `${where}: ${r.tags.length ? `OK (${r.tags.join(", ")})` : "empty"}` }];

  return (
    <Panel
      id={`${idBase}-code`}
      title="Custom code"
      description="Code added to this page only, like Webflow's page custom code. Allowed: <script> (inline, or an https src), <noscript>, <style>, <meta> and <link> (head only). Anything else is refused."
      actions={
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} className="h-4 w-4 accent-ocean-600" />
          Wrap lines
        </label>
      }
    >
      <div className="space-y-5 px-6 py-6">
        {me && !isAdmin && (
          <p className="rounded-2xl bg-summit-100 px-5 py-3 text-sm text-obsidian-900 ring-1 ring-summit-300">Only an admin can change custom code, because it runs on the live page. You can read it and check a change.</p>
        )}
        <CodeBox id={`${idBase}-code-head`} label="Inside <head> tag" hint="For verification tags, preconnects and tracking snippets." value={head} onChange={setHead} wrap={wrap} />
        <CodeBox id={`${idBase}-code-body`} label="Before </body> tag" hint="Scripts that run after the page loads (chat widgets, embeds). <meta> and <link> belong in the head box." value={body} onChange={setBody} wrap={wrap} />
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <p aria-live="polite" className={message ? "rounded-2xl bg-ocean-50 px-5 py-3 text-sm text-ocean-800" : "sr-only"}>
          {message}
        </p>
        {result && (
          <ul aria-live="polite" className="space-y-1 text-sm">
            {[...summary(result.head, "Head"), ...summary(result.body, "Before </body>")].map((line) => (
              <li key={line.text} className={line.ok ? "text-ocean-700" : "text-red-700"}>
                {line.text}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void check()} disabled={busy !== null} className={quietBtn}>
            {busy === "check" ? "Checking…" : "Check code"}
          </button>
          {isAdmin && (
            <button type="button" onClick={() => void save()} disabled={busy !== null || !dirty} className={primaryBtn}>
              {busy === "save" ? "Saving…" : "Save custom code"}
            </button>
          )}
          {dirty && (
            <button
              type="button"
              onClick={() => {
                setHead(savedHead ?? "");
                setBody(savedBody ?? "");
                setResult(null);
              }}
              disabled={busy !== null}
              className={quietBtn}
            >
              Discard
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}
