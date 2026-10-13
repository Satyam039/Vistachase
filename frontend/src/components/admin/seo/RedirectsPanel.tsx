"use client";

// Redirects (/admin/seo): same-site path redirects the middleware applies. The server refuses loops,
// chains longer than allowed, app areas and redirects that would hide a live page; this panel only
// shows its answer.

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Dropdown } from "@/components/forms/Dropdown";
import { Chip, Empty, Grid, Loading, Panel, dangerBtn, day, errorOf, field, labelCls, primaryBtn, quietBtn, seoApi, words } from "./shared";

interface Redirect {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  active: boolean;
  source: "MANUAL" | "SLUG_CHANGE" | "IMPORT";
  note: string | null;
  createdAt: string;
  updatedAt: string;
  chain: { fromPath: string; finalPath: string; hops: number; loop: boolean } | null;
}

const SIGNED_OUT = "Sign in with an admin account.";
const signedOut = (status: number) => status === 401 || status === 403;

const CODES = [
  { value: "301", label: "301 Moved permanently" },
  { value: "308", label: "308 Permanent (keeps method)" },
  { value: "302", label: "302 Found (temporary)" },
  { value: "307", label: "307 Temporary (keeps method)" },
];

function Alert({ children }: { children: string }) {
  return (
    <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
      {children}
    </p>
  );
}

function EditRow({ r, onDone, onCancel, notify }: { r: Redirect; onDone: () => void; onCancel: () => void; notify: (m: string) => void }) {
  const [toPath, setToPath] = useState(r.toPath);
  const [code, setCode] = useState(String(r.statusCode));
  const [active, setActive] = useState(r.active);
  const [note, setNote] = useState(r.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { ok, status, data } = await seoApi(`/redirects/${r.id}`, "PATCH", { toPath, statusCode: Number(code), active, note });
    setBusy(false);
    if (!ok) return setError(signedOut(status) ? SIGNED_OUT : errorOf(data, "Couldn't save the redirect."));
    notify(`Redirect from ${r.fromPath} was updated.`);
    onDone();
  }

  const p = `er-${r.id}`;
  return (
    <tr>
      <td colSpan={7} className="bg-obsidian-50/60 px-6 py-5">
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-4" noValidate aria-label={`Edit redirect from ${r.fromPath}`}>
          {error && (
            <div className="md:col-span-4">
              <Alert>{error}</Alert>
            </div>
          )}
          <p className="text-sm text-slate-700 md:col-span-4">
            From <code className="font-code">{r.fromPath}</code>
          </p>
          <div>
            <label htmlFor={`${p}-to`} className={labelCls}>
              To path
            </label>
            <input id={`${p}-to`} value={toPath} onChange={(e) => setToPath(e.target.value)} required className={field} />
          </div>
          <Dropdown id={`${p}-code`} label="Status code" value={code} onChange={setCode} options={CODES} />
          <div>
            <label htmlFor={`${p}-note`} className={labelCls}>
              Note
            </label>
            <input id={`${p}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={field} />
          </div>
          <div className="flex items-end pb-3">
            <input id={`${p}-active`} type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-ocean-600" />
            <label htmlFor={`${p}-active`} className="ml-2 text-sm text-slate-700">
              Active
            </label>
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-4">
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? "Saving…" : "Save redirect"}
            </button>
            <button type="button" onClick={onCancel} className={quietBtn}>
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function AddForm({ onDone, notify }: { onDone: () => void; notify: (m: string) => void }) {
  const [code, setCode] = useState("301");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setBusy(true);
    setError("");
    const { ok, status, data } = await seoApi("/redirects", "POST", {
      fromPath: f.fromPath.trim(),
      toPath: f.toPath.trim(),
      statusCode: Number(code),
      active,
      ...(f.note.trim() ? { note: f.note.trim() } : {}),
    });
    setBusy(false);
    if (!ok) return setError(signedOut(status) ? SIGNED_OUT : errorOf(data, "Couldn't add the redirect."));
    form.reset();
    setCode("301");
    setActive(true);
    notify(`Redirect from ${f.fromPath.trim()} was added.`);
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 border-t border-obsidian-900/[0.06] px-6 py-6 md:grid-cols-4" noValidate aria-labelledby="add-redirect-heading">
      <div className="md:col-span-4">
        <h3 id="add-redirect-heading" className="text-lg text-obsidian-900">
          Add a redirect
        </h3>
        <p id="add-redirect-help" className="mt-1 max-w-3xl text-sm text-slate-600">
          Same-site paths only, like /old-page → /new-page. The server refuses loops, chains longer than allowed, app areas (/admin, /api, /book…) and
          redirects that would hide a live page.
        </p>
      </div>
      {error && (
        <div className="md:col-span-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <div>
        <label htmlFor="nr-from" className={labelCls}>
          From path
        </label>
        <input id="nr-from" name="fromPath" required placeholder="/old-page" aria-describedby="add-redirect-help" className={field} />
      </div>
      <div>
        <label htmlFor="nr-to" className={labelCls}>
          To path
        </label>
        <input id="nr-to" name="toPath" required placeholder="/new-page" aria-describedby="add-redirect-help" className={field} />
      </div>
      <Dropdown id="nr-code" label="Status code" value={code} onChange={setCode} options={CODES} />
      <div>
        <label htmlFor="nr-note" className={labelCls}>
          Note (optional)
        </label>
        <input id="nr-note" name="note" maxLength={300} className={field} />
      </div>
      <div className="flex items-center">
        <input id="nr-active" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-ocean-600" />
        <label htmlFor="nr-active" className="ml-2 text-sm text-slate-700">
          Active
        </label>
      </div>
      <div className="md:col-span-4">
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? "Adding…" : "Add redirect"}
        </button>
      </div>
    </form>
  );
}

export function RedirectsPanel({ notify }: { notify: (m: string) => void }) {
  const [redirects, setRedirects] = useState<Redirect[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { ok, status, data } = await seoApi<{ redirects: Redirect[] }>("/redirects");
    if (ok) {
      setRedirects(data.redirects ?? []);
      setError("");
    } else {
      setRedirects([]);
      setError(signedOut(status) ? SIGNED_OUT : errorOf(data, "Couldn't load redirects."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(r: Redirect) {
    if (!window.confirm(`Delete the redirect from ${r.fromPath} to ${r.toPath}?`)) return;
    setBusyId(r.id);
    const { ok, status, data } = await seoApi(`/redirects/${r.id}`, "DELETE");
    setBusyId(null);
    if (!ok) return setError(signedOut(status) ? SIGNED_OUT : errorOf(data, "Couldn't delete the redirect."));
    setError("");
    notify(`Redirect from ${r.fromPath} was deleted.`);
    void load();
  }

  return (
    <Panel id="seo-redirects" title="Redirects" description="Permanent and temporary redirects between paths on this site. Slug changes add one automatically.">
      {error && (
        <div className="px-6 pt-5">
          <Alert>{error}</Alert>
        </div>
      )}
      {redirects === null ? (
        <Loading />
      ) : redirects.length === 0 ? (
        <Empty>No redirects yet.</Empty>
      ) : (
        <Grid label="Redirects" minWidth="min-w-[64rem]" head={[["From"], ["To"], ["Code"], ["Active"], ["Source"], ["Note"], ["", true]]}>
          {redirects.map((r) =>
            editing === r.id ? (
              <EditRow
                key={r.id}
                r={r}
                notify={notify}
                onCancel={() => setEditing(null)}
                onDone={() => {
                  setEditing(null);
                  void load();
                }}
              />
            ) : (
              <tr key={r.id} className="align-top">
                <td className="px-6 py-4">
                  <code className="font-code text-sm">{r.fromPath}</code>
                  <span className="block text-sm text-slate-600">Added {day(r.createdAt)}</span>
                </td>
                <td className="px-6 py-4">
                  <code className="font-code text-sm">{r.toPath}</code>
                  {r.chain && r.chain.hops > 1 && (
                    <span className="mt-1 block text-sm text-slate-600">
                      Ends at <code className="font-code">{r.chain.finalPath}</code>
                    </span>
                  )}
                  <span className="mt-1 flex flex-wrap gap-1">
                    {r.chain?.loop && <Chip className="bg-red-50 text-red-800">Loop</Chip>}
                    {r.chain && !r.chain.loop && r.chain.hops > 1 && <Chip className="bg-summit-100 text-obsidian-900">Chain of {r.chain.hops}</Chip>}
                  </span>
                </td>
                <td className="px-6 py-4 tabular-nums">{r.statusCode}</td>
                <td className="px-6 py-4">{r.active ? <Chip className="bg-ocean-50 text-ocean-800">Active</Chip> : <Chip className="bg-obsidian-100 text-slate-700">Off</Chip>}</td>
                <td className="px-6 py-4 text-sm text-slate-700">{words(r.source)}</td>
                <td className="max-w-xs px-6 py-4 text-sm text-slate-700">{r.note || "–"}</td>
                <td className="px-6 py-4 text-right">
                  <span className="inline-flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => setEditing(r.id)} className={quietBtn} aria-label={`Edit redirect from ${r.fromPath}`}>
                      Edit
                    </button>
                    <button type="button" onClick={() => void remove(r)} disabled={busyId === r.id} className={dangerBtn} aria-label={`Delete redirect from ${r.fromPath}`}>
                      {busyId === r.id ? "Deleting…" : "Delete"}
                    </button>
                  </span>
                </td>
              </tr>
            ),
          )}
        </Grid>
      )}
      {!signedOutError(error) && <AddForm onDone={() => void load()} notify={notify} />}
    </Panel>
  );
}

const signedOutError = (error: string) => error === SIGNED_OUT;
