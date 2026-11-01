"use client";

// Manage booking on the voucher page (owner, 2026-11-01), opened from the confirmation email's
// "Manage booking" button (#manage). The lead guest's name and phone change straight away; a new
// date is a request our team confirms (seats, price difference), as backend
// modules/bookings/manage-booking.ts explains.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, UserRound } from "lucide-react";

const input =
  "mt-1 block h-11 w-full rounded-none border border-slate-300 bg-white px-3 text-base text-obsidian-900 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/30";
const button =
  "inline-flex h-11 items-center justify-center rounded-none bg-ocean-700 px-5 text-sm font-medium text-white hover:bg-ocean-800 disabled:cursor-not-allowed disabled:opacity-60";

async function post(path: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; changed?: boolean };
    return res.ok && data.success ? { ok: true as const, data } : { ok: false as const, error: data.error || "That didn't work. Please try again or call us." };
  } catch {
    return { ok: false as const, error: "We couldn't reach Vista Chase. Check your connection and try again." };
  }
}

export function ManageBooking({
  bookingReference,
  token,
  customerName,
  customerPhone,
  currentDate,
}: {
  bookingReference: string;
  token?: string;
  customerName: string;
  customerPhone?: string | null;
  currentDate: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(customerName);
  const [phone, setPhone] = useState(customerPhone ?? "");
  const [detailsState, setDetailsState] = useState<{ busy?: boolean; done?: string; error?: string }>({});

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const [newDate, setNewDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [note, setNote] = useState("");
  const [changeState, setChangeState] = useState<{ busy?: boolean; done?: boolean; error?: string }>({});

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setDetailsState({ busy: true });
    const body: Record<string, unknown> = { bookingReference, t: token };
    if (name.trim() && name.trim() !== customerName) body.customerName = name.trim();
    if (phone.trim() && phone.trim() !== (customerPhone ?? "")) body.customerPhone = phone.trim();
    const result = await post("/api/bookings/manage/details", body);
    if (!result.ok) return setDetailsState({ error: result.error });
    setDetailsState({ done: result.data.changed ? "Saved. Your voucher now shows the new details." : "Nothing to change." });
    router.refresh();
  };

  const requestChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) return setChangeState({ error: "Choose the new date." });
    setChangeState({ busy: true });
    const result = await post("/api/bookings/manage/change-date", { bookingReference, t: token, newDate, preferredTime, note });
    setChangeState(result.ok ? { done: true } : { error: result.error });
  };

  return (
    <section id="manage" aria-labelledby="manage-heading" className="scroll-mt-28 rounded-none bg-white p-6 ring-1 ring-obsidian-900/[0.07] sm:p-7 print:hidden">
      <h2 id="manage-heading" className="text-lg text-obsidian-900">
        Manage booking
      </h2>

      <form onSubmit={saveDetails} className="mt-4 space-y-3" noValidate>
        <p className="flex items-center gap-2 text-sm font-medium text-obsidian-900">
          <UserRound className="h-4 w-4 text-ocean-600" aria-hidden="true" />
          Lead guest
        </p>
        <label className="block text-sm text-slate-700">
          Full name
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={100} required />
        </label>
        <label className="block text-sm text-slate-700">
          Phone (we call this number on the day)
          <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" maxLength={30} />
        </label>
        <button type="submit" className={button} disabled={detailsState.busy}>
          {detailsState.busy ? "Saving…" : "Save details"}
        </button>
        {detailsState.done && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {detailsState.done}
          </p>
        )}
        {detailsState.error && (
          <p role="alert" className="text-sm text-red-700">
            {detailsState.error}
          </p>
        )}
      </form>

      <div className="my-6 border-t border-obsidian-900/[0.08]" />

      {changeState.done ? (
        <p role="status" className="flex items-start gap-2 bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Request sent. Your booking stays as it is until our team confirms the new date, usually within one business day. We&apos;ve emailed you a copy.
        </p>
      ) : (
        <form onSubmit={requestChange} className="space-y-3" noValidate>
          <p className="flex items-center gap-2 text-sm font-medium text-obsidian-900">
            <CalendarClock className="h-4 w-4 text-ocean-600" aria-hidden="true" />
            Change date or time
          </p>
          <p className="text-xs leading-relaxed text-slate-600">
            Booked for {currentDate}. Ask for another date and our team confirms seats and any price difference before anything changes.
          </p>
          <label className="block text-sm text-slate-700">
            New date
            <input type="date" className={input} min={tomorrow} value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
          </label>
          <label className="block text-sm text-slate-700">
            Preferred time (optional)
            <input className={input} value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} maxLength={40} placeholder="e.g. morning, 7:30 AM" />
          </label>
          <label className="block text-sm text-slate-700">
            Anything else (optional)
            <textarea
              className={`${input} h-auto min-h-[5rem] py-2`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
          </label>
          <button type="submit" className={button} disabled={changeState.busy}>
            {changeState.busy ? "Sending…" : "Request new date"}
          </button>
          {changeState.error && (
            <p role="alert" className="text-sm text-red-700">
              {changeState.error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
