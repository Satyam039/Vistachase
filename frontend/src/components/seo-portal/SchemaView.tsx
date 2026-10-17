"use client";

// Schema markup: what the live pages carry (from the last audit), and JSON-LD blocks managed here.
// Page blocks go on one page (any page on the site) and are published by an SEO manager; site-wide blocks
// (which replace the coded organisation block when they share its @id) are published by an admin,
// so an SEO manager sends them for approval. Every block is validated before it is saved.

import { useCallback, useEffect, useId, useState } from "react";
import { Chip, CheckList, Empty, Grid, Panel, errorOf, field, labelCls, portalApi, primaryBtn, quietBtn, when, type FieldCheck } from "@/components/admin/seo/shared";
import { Dropdown } from "@/components/forms/Dropdown";
import { PortalHeading, usePortal } from "@/components/seo-portal/PortalShell";

interface Block {
  id: string;
  scope: "SITE" | "PAGE";
  pageId: string | null;
  name: string;
  schemaType: string;
  json: unknown;
  draftJson: unknown;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  validation: { level: "error" | "warning" | "info"; message: string }[];
  publishedAt: string | null;
  updatedAt: string;
}

interface LivePage {
  pageId: string;
  path: string;
  label: string;
  editable: boolean;
  crawled: boolean;
  blocks: { ok: boolean; error: string | null; types: string[]; ids: string[]; data: unknown }[];
}

interface Inventory {
  live: LivePage[];
  managed: Block[];
  summary: { pagesCrawled: number; pagesWithSchema: number; invalidBlocks: number; types: Record<string, number> };
}

const asChecks = (v: { level: "error" | "warning" | "info"; message: string }[]): FieldCheck[] => v.map((c) => ({ field: "json", level: c.level, message: c.message }));

function Editor({ pages, block, onDone }: { pages: LivePage[]; block: Block | null; onDone: () => void }) {
  const { me, notify } = usePortal();
  const uid = useId();
  const [scope, setScope] = useState<"SITE" | "PAGE">(block?.scope ?? "PAGE");
  const [pageId, setPageId] = useState(block?.pageId ?? "");
  const [name, setName] = useState(block?.name ?? "");
  const [json, setJson] = useState(block ? JSON.stringify(block.draftJson ?? block.json, null, 2) : "");
  const [checks, setChecks] = useState<FieldCheck[]>(block ? asChecks(block.validation) : []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<Block | null>(block);

  async function validate() {
    setBusy("check");
    const res = await portalApi<{ checks: { level: "error" | "warning" | "info"; message: string }[] }>("/schema/validate", "POST", { scope, json });
    setBusy(null);
    if (res.ok) setChecks(asChecks(res.data.checks));
  }

  async function save() {
    setBusy("save");
    setError("");
    const body = { scope, pageId: scope === "PAGE" ? pageId : null, name, json };
    const res = saved ? await portalApi<{ block: Block; checks: Block["validation"] }>(`/schema/${saved.id}`, "PUT", body) : await portalApi<{ block: Block; checks: Block["validation"] }>("/schema", "POST", body);
    setBusy(null);
    if (!res.ok) {
      if (res.data.checks) setChecks(res.data.checks);
      return setError(errorOf(res.data, "Couldn't save the block."));
    }
    setSaved(res.data.block);
    setChecks(asChecks(res.data.checks));
    notify("Draft saved. It isn't on the site until it is published.");
  }

  async function publish() {
    if (!saved) return;
    setBusy("publish");
    setError("");
    const res =
      saved.scope === "SITE" && me.role !== "ADMIN"
        ? await portalApi("/requests", "POST", { kind: "SITE_SCHEMA", targetId: saved.id, payload: { action: "publish" } })
        : await portalApi(`/schema/${saved.id}/publish`, "POST", {});
    setBusy(null);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't publish."));
    notify(saved.scope === "SITE" && me.role !== "ADMIN" ? "Sent to an admin for approval." : "Published.");
    onDone();
  }

  const editable = pages.filter((p) => p.editable);
  return (
    <div className="space-y-4 border-b border-obsidian-900/[0.06] px-6 py-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Dropdown
          id={`${uid}-scope`}
          label="Where"
          options={[
            { value: "PAGE", label: "One page" },
            { value: "SITE", label: "Every page (site-wide, admin approval)" },
          ]}
          value={scope}
          onChange={(v) => setScope(v as "SITE" | "PAGE")}
          disabled={Boolean(saved)}
        />
        {scope === "PAGE" && (
          <Dropdown id={`${uid}-page`} label="Page" searchable options={editable.map((p) => ({ value: p.pageId, label: p.label, description: p.path }))} value={pageId} onChange={setPageId} disabled={Boolean(saved)} />
        )}
        <div>
          <label htmlFor={`${uid}-name`} className={labelCls}>
            Name
          </label>
          <input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </div>
      </div>
      <div>
        <label htmlFor={`${uid}-json`} className={labelCls}>
          JSON-LD (the object inside the script tag)
        </label>
        <textarea id={`${uid}-json`} rows={14} value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} className={`${field} font-mono text-sm`} />
        <p className="mt-1.5 text-sm text-slate-600">Copy it from the Webflow page exactly. Keep @id values; replace Webflow image addresses with the /media copies first.</p>
      </div>
      <CheckList checks={checks} />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void validate()} disabled={busy !== null || !json.trim()} className={quietBtn}>
          {busy === "check" ? "Checking…" : "Check"}
        </button>
        <button type="button" onClick={() => void save()} disabled={busy !== null || !json.trim() || name.trim().length < 2 || (scope === "PAGE" && !pageId)} className={primaryBtn}>
          {busy === "save" ? "Saving…" : "Save draft"}
        </button>
        {saved && (
          <button type="button" onClick={() => void publish()} disabled={busy !== null} className={quietBtn}>
            {saved.scope === "SITE" && me.role !== "ADMIN" ? "Send for approval" : "Publish"}
          </button>
        )}
        <button type="button" onClick={onDone} className={quietBtn}>
          Close
        </button>
      </div>
    </div>
  );
}

export function SchemaView() {
  const { me, notify } = usePortal();
  const uid = useId();
  const [data, setData] = useState<Inventory | null>(null);
  const [editing, setEditing] = useState<Block | "new" | null>(null);
  const [showPage, setShowPage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await portalApi<Inventory>("/schema");
    if (res.ok) setData(res.data);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function unpublish(b: Block) {
    if (b.scope === "SITE" && me.role !== "ADMIN") {
      const res = await portalApi("/requests", "POST", { kind: "SITE_SCHEMA", targetId: b.id, payload: { action: "unpublish" } });
      notify(res.ok ? "Sent to an admin for approval." : errorOf(res.data, "Couldn't send the request."));
      return;
    }
    const res = await portalApi(`/schema/${b.id}/unpublish`, "POST", {});
    notify(res.ok ? "Taken off the site. The draft is kept." : errorOf(res.data, "Couldn't unpublish."));
    void load();
  }

  return (
    <div className="space-y-6">
      <PortalHeading title="Schema markup" intro="Structured data (JSON-LD) on the site. Pages built in code keep their coded schema; blocks managed here go on one page or, with an admin's approval, every page. A page block is added alongside the page's coded schema." />
      {data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 ring-1 ring-obsidian-900/[0.07]">
            <p className="text-sm text-slate-600">Pages with schema (last audit)</p>
            <p className="mt-1 text-3xl font-light">
              {data.summary.pagesWithSchema}/{data.summary.pagesCrawled}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 ring-1 ring-obsidian-900/[0.07]">
            <p className="text-sm text-slate-600">Invalid blocks found</p>
            <p className={`mt-1 text-3xl font-light ${data.summary.invalidBlocks ? "text-red-700" : ""}`}>{data.summary.invalidBlocks}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 ring-1 ring-obsidian-900/[0.07]">
            <p className="text-sm text-slate-600">Types</p>
            <p className="mt-1 text-sm text-slate-700">{Object.entries(data.summary.types).map(([t, n]) => `${t} ${n}`).join(" · ") || "Not audited yet"}</p>
          </div>
        </div>
      )}
      <Panel
        id={`${uid}-managed`}
        title="Managed blocks"
        actions={
          me.seo.manage && (
            <button type="button" onClick={() => setEditing("new")} className={quietBtn}>
              New block
            </button>
          )
        }
      >
        {editing && data && (
          <Editor
            pages={data.live}
            block={editing === "new" ? null : editing}
            onDone={() => {
              setEditing(null);
              void load();
            }}
          />
        )}
        {!data ? null : data.managed.length === 0 ? (
          <Empty>No blocks managed here yet.</Empty>
        ) : (
          <Grid label="Managed JSON-LD blocks" head={[["Block"], ["Where"], ["Status"], ["Checks"], [""]]}>
            {data.managed.map((b) => (
              <tr key={b.id} className="align-top">
                <td className="px-6 py-3">
                  <span className="block text-base">{b.name}</span>
                  <span className="text-sm text-slate-600">{b.schemaType}</span>
                </td>
                <td className="px-6 py-3 text-sm">{b.scope === "SITE" ? "Every page" : (data.live.find((p) => p.pageId === b.pageId)?.path ?? "A page")}</td>
                <td className="px-6 py-3">
                  <Chip className={b.status === "PUBLISHED" ? "bg-ocean-50 text-ocean-800" : "bg-obsidian-100 text-slate-700"}>{b.status === "PUBLISHED" ? "Published" : "Draft"}</Chip>
                  {b.publishedAt && <span className="mt-1 block text-sm text-slate-600">{when(b.publishedAt)}</span>}
                </td>
                <td className="px-6 py-3 text-sm text-slate-700">
                  {b.validation.filter((c) => c.level === "error").length} errors · {b.validation.filter((c) => c.level === "warning").length} warnings
                </td>
                <td className="px-6 py-3 text-right">
                  {me.seo.manage && (
                    <span className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditing(b)} className={quietBtn}>
                        Edit
                      </button>
                      {b.status === "PUBLISHED" && (
                        <button type="button" onClick={() => void unpublish(b)} className={quietBtn}>
                          Unpublish
                        </button>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </Grid>
        )}
      </Panel>
      <Panel id={`${uid}-live`} title="On the live pages" description="Every JSON-LD block the last audit found, page by page.">
        {!data ? null : (
          <Grid label="JSON-LD found on pages" head={[["Page"], ["Blocks"], [""]]}>
            {data.live
              .filter((p) => p.crawled)
              .map((p) => (
                <tr key={p.pageId} className="align-top">
                  <td className="px-6 py-3">
                    <span className="block text-base">{p.label}</span>
                    <span className="font-mono text-sm text-slate-600">{p.path}</span>
                  </td>
                  <td className="px-6 py-3 text-sm">
                    {p.blocks.length === 0 ? (
                      <span className="text-slate-600">None</span>
                    ) : (
                      p.blocks.map((b, i) => (
                        <span key={i} className={`block ${b.ok ? "" : "text-red-700"}`}>
                          {b.ok ? b.types.join(", ") || "(no @type)" : `Invalid JSON: ${b.error}`}
                        </span>
                      ))
                    )}
                    {showPage === p.pageId && (
                      <pre className="mt-2 max-h-80 overflow-auto rounded-xl bg-obsidian-950 p-3 text-sm text-white/90">{JSON.stringify(p.blocks.map((b) => b.data), null, 2)}</pre>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {p.blocks.length > 0 && (
                      <button type="button" onClick={() => setShowPage(showPage === p.pageId ? null : p.pageId)} className={quietBtn}>
                        {showPage === p.pageId ? "Hide" : "View"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </Grid>
        )}
      </Panel>
    </div>
  );
}
