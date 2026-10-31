"use client";

// Messages: contact-form enquiries, tour requests and "Chat with a live agent" hand-offs from the
// AI concierge (with the conversation), newest first. Staff reply by email (the guest's address
// is a mailto link) and mark each one Replied or Closed. Reads /api/admin/enquiries.

import { useCallback, useEffect, useState } from "react";
import { Chip, Empty, Loading, Panel, adminApi, errorOf, isDenied, quietBtn, when } from "@/components/admin/staff/shared";

interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  tourSlug: string | null;
  guests: number | null;
  date: string | null;
  message: string;
  status: "NEW" | "REPLIED" | "CLOSED";
  createdAt: string;
}

const STATUS_STYLE: Record<Enquiry["status"], string> = {
  NEW: "bg-summit-100 text-obsidian-900",
  REPLIED: "bg-emerald-50 text-emerald-800",
  CLOSED: "bg-obsidian-100 text-slate-700",
};

const isHandoff = (e: Enquiry) => e.message.startsWith("Live agent request from the AI concierge");

export function MessagesPanel({ onDenied }: { onDenied: () => void }) {
  const [status, setStatus] = useState<"" | Enquiry["status"]>("NEW");
  const [items, setItems] = useState<Enquiry[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems(null);
    const r = await adminApi<{ enquiries: Enquiry[] }>(`/enquiries${status ? `?status=${status}` : ""}`);
    if (isDenied(r.status)) return onDenied();
    if (!r.ok) {
      setError(errorOf(r.data, "Couldn't load messages."));
      setItems([]);
      return;
    }
    setError("");
    setItems(r.data.enquiries);
  }, [status, onDenied]);

  useEffect(() => {
    load();
  }, [load]);

  const mark = async (id: string, next: Enquiry["status"]) => {
    setBusy(id);
    const r = await adminApi(`/enquiries/${id}`, "PATCH", { status: next });
    setBusy(null);
    if (!r.ok) return setError(errorOf(r.data, "Couldn't update that message."));
    setItems((prev) => (status && status !== next ? prev?.filter((e) => e.id !== id) : prev?.map((e) => (e.id === id ? { ...e, status: next } : e))) ?? null);
  };

  return (
    <Panel
      id="messages"
      title="Messages"
      description="Contact form, tour requests and live agent requests from the AI concierge. Reply by email, then mark them."
      actions={
        <label className="flex items-center gap-2 text-sm text-slate-700">
          Show
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-10 rounded-xl border border-obsidian-900/15 bg-white px-3 text-sm text-obsidian-900">
            <option value="NEW">New</option>
            <option value="REPLIED">Replied</option>
            <option value="CLOSED">Closed</option>
            <option value="">All</option>
          </select>
        </label>
      }
    >
      {error && (
        <p role="alert" className="mx-6 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {items === null ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty>No messages here.</Empty>
      ) : (
        <ul className="divide-y divide-obsidian-900/[0.06]">
          {items.map((e) => (
            <li key={e.id} className="px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-base text-obsidian-900">
                    {e.name}
                    {isHandoff(e) && <Chip className="bg-ocean-50 text-ocean-800">Live agent request</Chip>}
                    <Chip className={STATUS_STYLE[e.status]}>{e.status.toLowerCase()}</Chip>
                  </p>
                  <p className="mt-1 break-words text-sm text-slate-600">
                    <a href={`mailto:${e.email}`} className="text-ocean-700 underline-offset-2 hover:underline">
                      {e.email}
                    </a>
                    {e.phone ? ` · ${e.phone}` : ""}
                    {e.tourSlug ? ` · ${e.tourSlug}` : ""}
                    {e.guests ? ` · ${e.guests} guests` : ""}
                    {e.date ? ` · ${e.date.slice(0, 10)}` : ""}
                    {` · ${when(e.createdAt)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {e.status !== "REPLIED" && (
                    <button type="button" disabled={busy === e.id} onClick={() => mark(e.id, "REPLIED")} className={quietBtn}>
                      Mark replied
                    </button>
                  )}
                  {e.status !== "CLOSED" && (
                    <button type="button" disabled={busy === e.id} onClick={() => mark(e.id, "CLOSED")} className={quietBtn}>
                      Close
                    </button>
                  )}
                </div>
              </div>
              <details className="mt-3" open={e.status === "NEW"}>
                <summary className="cursor-pointer text-sm text-ocean-700">Message</summary>
                <p className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words bg-obsidian-50 p-3 text-sm leading-relaxed text-obsidian-900">{e.message}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
