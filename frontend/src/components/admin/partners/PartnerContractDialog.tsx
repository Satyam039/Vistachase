"use client";

// Admin → Partners: approve a partner with a commission staff choose by hand (owner, 2026-11-26: no
// automatic 10%), pick the products it applies to, preview the partner agreement drafted from the
// application, and send it. The same dialog sends a new agreement version to an active partner.
// The server builds the PDF, saves the commission rules and emails the partner
// (POST /api/affiliates/admin/:id/approve | /contract).

import { useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { ModalDialog } from "@/components/forms/ModalDialog";
import type { AdminPartner } from "@/components/admin/partners/PartnerAdminPanels";

interface Options {
  categories: { value: string; label: string }[];
  tours: { slug: string; title: string; category: string }[];
}

const field =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-obsidian-900 focus:border-ocean-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600";
const quietBtn = "inline-flex h-11 items-center rounded-full border border-obsidian-900/10 px-5 text-sm text-obsidian-900 hover:bg-obsidian-50 disabled:opacity-60";

/** Downloads a PDF the API answers with (a POST, so a plain link can't do it). */
export async function downloadPdf(url: string, filename: string, body?: unknown): Promise<string> {
  try {
    const res = await fetch(url, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.error || "Couldn't make the PDF.";
    }
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
    return "";
  } catch {
    return "We couldn't reach the server. Please try again.";
  }
}

export function PartnerContractDialog({
  partner,
  mode,
  onClose,
  onDone,
}: {
  partner: AdminPartner | null;
  mode: "approve" | "update";
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [options, setOptions] = useState<Options | null>(null);
  const [percent, setPercent] = useState("");
  const [all, setAll] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [tours, setTours] = useState<string[]>([]);
  const [extraTerms, setExtraTerms] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "preview" | "send">("");

  useEffect(() => {
    if (!partner) return;
    setError("");
    setPercent(mode === "update" && partner.contract ? String(partner.contract.commissionPercent) : "");
    setAll(true);
    setCategories([]);
    setTours([]);
    setExtraTerms("");
    if (!options) {
      fetch("/api/affiliates/admin/contract-products")
        .then((r) => r.json())
        .then((d) => setOptions({ categories: d.categories ?? [], tours: d.tours ?? [] }))
        .catch(() => setOptions({ categories: [], tours: [] }));
    }
  }, [partner, mode, options]);

  const byCategory = useMemo(() => {
    const groups = new Map<string, Options["tours"]>();
    for (const t of options?.tours ?? []) groups.set(t.category, [...(groups.get(t.category) ?? []), t]);
    return groups;
  }, [options]);

  const body = () => ({
    ...(percent.trim() !== "" ? { commissionPercent: Number(percent) } : {}),
    products: { all, categories: all ? [] : categories, tourSlugs: all ? [] : tours.filter((slug) => !categories.includes(options?.tours.find((t) => t.slug === slug)?.category ?? "")) },
    extraTerms: extraTerms.trim(),
  });

  if (!partner) return <ModalDialog open={false} onClose={onClose} title="" actions={null}>{null}</ModalDialog>;

  async function preview() {
    if (!partner) return;
    setBusy("preview");
    setError(await downloadPdf(`/api/affiliates/admin/${partner.id}/contract/preview`, `partner-agreement-draft-${partner.code}.pdf`, body()));
    setBusy("");
  }

  async function send() {
    if (!partner) return;
    const n = Number(percent);
    if (percent.trim() === "" || !Number.isFinite(n) || n < 0 || n > 50) return setError("Set the commission % (0 to 50).");
    if (!all && categories.length === 0 && tours.length === 0) return setError("Choose the products the commission applies to.");
    setBusy("send");
    setError("");
    try {
      const res = await fetch(`/api/affiliates/admin/${partner.id}/${mode === "approve" ? "approve" : "contract"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const first = data.fields ? Object.values(data.fields as Record<string, string[]>)[0]?.[0] : "";
        return setError(first || data.error || "Couldn't send the agreement.");
      }
      onDone(
        mode === "approve"
          ? `${partner.name} is approved. Agreement version ${data.version} was emailed to ${data.sentTo}.`
          : `Agreement version ${data.version} was emailed to ${data.sentTo}. The new commission applies to bookings paid from now on.`,
      );
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy("");
    }
  }

  const toggle = (list: string[], value: string, on: boolean) => (on ? (list.includes(value) ? list : [...list, value]) : list.filter((v) => v !== value));

  return (
    <ModalDialog
      open
      size="lg"
      onClose={onClose}
      title={mode === "approve" ? `Approve ${partner.name}` : `New agreement for ${partner.name}`}
      icon={
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-ocean-50 text-ocean-700">
          <FileText className="h-6 w-6" aria-hidden="true" />
        </span>
      }
      actions={
        <>
          <button type="button" onClick={onClose} className={quietBtn}>
            Cancel
          </button>
          <button type="button" onClick={preview} disabled={!!busy} className={quietBtn}>
            {busy === "preview" ? "Making PDF…" : "Preview agreement (PDF)"}
          </button>
          <button type="button" onClick={send} disabled={!!busy} className="inline-flex h-11 items-center rounded-full bg-ocean-600 px-5 text-sm text-white hover:bg-ocean-700 disabled:opacity-60">
            {busy === "send" ? "Sending…" : mode === "approve" ? "Approve and send agreement" : "Send new agreement"}
          </button>
        </>
      }
    >
      <p className="text-sm">
        The agreement is drafted from {partner.name}&apos;s application. Set the commission and the products it applies to, preview it, then send it: it is emailed as a PDF to{" "}
        <span className="text-obsidian-900">{partner.email}</span>
        {mode === "approve" ? " and the partner account becomes active." : ". Commission already earned doesn't change."}
      </p>

      <div className="space-y-1.5">
        <label htmlFor="contract-percent" className="text-sm text-slate-700">
          Commission % of the amount the guest pays
        </label>
        <input
          id="contract-percent"
          type="number"
          inputMode="decimal"
          min={0}
          max={50}
          step={0.5}
          required
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          placeholder="For example 12"
          className={field}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm text-slate-700">Applies to</legend>
        <label htmlFor="contract-all" className="flex items-center gap-2 text-sm text-obsidian-900">
          <input id="contract-all" type="radio" name="contract-scope" className="h-4 w-4 accent-ocean-600" checked={all} onChange={() => setAll(true)} />
          All products
        </label>
        <label htmlFor="contract-some" className="flex items-center gap-2 text-sm text-obsidian-900">
          <input id="contract-some" type="radio" name="contract-scope" className="h-4 w-4 accent-ocean-600" checked={!all} onChange={() => setAll(false)} />
          Only the products I choose (others earn no commission)
        </label>
        {!all && (
          <div className="max-h-72 space-y-3 overflow-y-auto rounded-2xl bg-obsidian-50 p-4">
            {!options ? (
              <p className="text-sm text-slate-600">Loading products…</p>
            ) : (
              options.categories.map((c) => {
                const whole = categories.includes(c.value);
                const list = byCategory.get(c.value) ?? [];
                return (
                  <div key={c.value} className="space-y-1.5">
                    <label htmlFor={`contract-cat-${c.value}`} className="flex items-center gap-2 text-sm text-obsidian-900">
                      <input
                        id={`contract-cat-${c.value}`}
                        type="checkbox"
                        className="h-4 w-4 accent-ocean-600"
                        checked={whole}
                        onChange={(e) => setCategories((l) => toggle(l, c.value, e.target.checked))}
                      />
                      All {c.label.toLowerCase()}
                    </label>
                    {list.length > 0 && (
                      <div className="ml-6 grid gap-1 sm:grid-cols-2">
                        {list.map((t) => (
                          <label key={t.slug} htmlFor={`contract-tour-${t.slug}`} className={`flex items-start gap-2 text-sm ${whole ? "text-slate-500" : "text-slate-700"}`}>
                            <input
                              id={`contract-tour-${t.slug}`}
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 accent-ocean-600"
                              disabled={whole}
                              checked={whole || tours.includes(t.slug)}
                              onChange={(e) => setTours((l) => toggle(l, t.slug, e.target.checked))}
                            />
                            {t.title}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="contract-extra" className="text-sm text-slate-700">
          Additional terms (optional)
        </label>
        <textarea id="contract-extra" rows={3} maxLength={3000} value={extraTerms} onChange={(e) => setExtraTerms(e.target.value)} className={field} />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </ModalDialog>
  );
}
