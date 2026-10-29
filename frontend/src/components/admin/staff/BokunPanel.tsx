"use client";

// Bókun (docs/BOKUN.md): whether the site is connected, bookings on their way to Bókun or stuck,
// and the latest seat sync. Managers can sync now, send upcoming bookings made before Bókun was
// connected, and retry a booking after checking it in Bókun.

import { useCallback, useEffect, useState } from "react";
import { Chip, Empty, Grid, Loading, Panel, Stat, adminApi, errorOf, primaryBtn, quietBtn, when } from "@/components/admin/staff/shared";

interface Problem {
  id: string;
  operation: "CREATE" | "CANCEL";
  status: "FAILED" | "RETRYABLE_FAILURE";
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string;
  updatedAt: string;
  booking: { id: string; bookingReference: string; customerName: string; status: string };
}

interface SeatSync {
  at: string;
  status: string;
  details: { updated?: number; unchanged?: number; notInBokun?: string[]; errors?: string[]; from?: string; to?: string } | null;
}

interface BokunState {
  connected: boolean;
  apiUrl: string;
  seatSync: boolean;
  counts: Record<string, number>;
  problems: Problem[];
  lastSeatSync: SeatSync | null;
}

const MANAGERS = ["ADMIN", "OPERATOR"];

export function BokunPanel({ notify, role }: { notify: (m: string) => void; role: string }) {
  const [state, setState] = useState<BokunState | null>(null);
  const [busy, setBusy] = useState("");
  const isManager = MANAGERS.includes(role);

  const load = useCallback(async () => {
    const res = await adminApi<BokunState>("/bokun");
    if (res.ok) setState(res.data);
    else notify(errorOf(res.data, "Couldn't load the Bókun status."));
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (key: string, path: string, done: (data: Record<string, unknown>) => string) => {
    setBusy(key);
    const res = await adminApi<Record<string, unknown>>(path, "POST");
    setBusy("");
    notify(res.ok ? done(res.data) : errorOf(res.data, "That didn't work. Try again in a moment."));
    void load();
  };

  if (!state) return <Loading />;
  const waiting = (state.counts.PENDING ?? 0) + (state.counts.RETRYABLE_FAILURE ?? 0) + (state.counts.IN_PROGRESS ?? 0);
  const failed = state.counts.FAILED ?? 0;
  const sync = state.lastSeatSync?.details;

  return (
    <div className="space-y-6">
      <Panel
        id="bokun-connection"
        title="Bókun"
        description={
          state.connected ? (
            <>
              Connected to {state.apiUrl}. Every confirmed booking is also created in Bókun and cancellations follow.{" "}
              {state.seatSync ? "Bókun's seats are read into the calendar every 15 minutes." : "Seat sync is off (BOKUN_AVAILABILITY_SYNC=false)."}
            </>
          ) : (
            <>Not connected. Add BOKUN_ACCESS_KEY and BOKUN_SECRET_KEY to the server&apos;s backend/.env and restart the API. Bookings stay on the website only until then.</>
          )
        }
        actions={
          isManager && state.connected ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={primaryBtn}
                disabled={busy !== ""}
                onClick={() => act("sync", "/bokun/sync", () => "Synced with Bókun.")}
              >
                {busy === "sync" ? "Syncing…" : "Sync now"}
              </button>
              <button
                type="button"
                className={quietBtn}
                disabled={busy !== ""}
                onClick={() => act("upcoming", "/bokun/queue-upcoming", (d) => `${Number(d.queued ?? 0)} upcoming booking(s) sent to Bókun.`)}
              >
                {busy === "upcoming" ? "Sending…" : "Send upcoming bookings"}
              </button>
            </div>
          ) : null
        }
      >
        <div className="grid gap-4 p-6 sm:grid-cols-3">
          <Stat label="In Bókun" value={state.counts.SUCCEEDED ?? 0} tone="good" />
          <Stat label="On the way" value={waiting} hint="Sent within a few minutes" />
          <Stat label="Need attention" value={failed} tone={failed > 0 ? "bad" : undefined} hint="Also listed under Flags" />
        </div>
      </Panel>

      <Panel id="bokun-problems" title="Bookings not in Bókun yet" description="Retrying ones go again on their own. Stopped ones need a person: check the booking in Bókun first, then press Retry or fix it in Bókun and resolve its flag.">
        {state.problems.length === 0 ? (
          <Empty>Nothing waiting.</Empty>
        ) : (
          <Grid label="Bookings not in Bókun yet" head={[["Booking"], ["Change"], ["State"], ["What happened"], ["", true]]}>
            {state.problems.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="px-6 py-4">
                  <span className="block font-medium">{p.booking.bookingReference}</span>
                  <span className="block text-sm text-slate-600">{p.booking.customerName}</span>
                </td>
                <td className="px-6 py-4 text-sm">{p.operation === "CREATE" ? "Add booking" : "Cancel booking"}</td>
                <td className="px-6 py-4">
                  {p.status === "FAILED" ? (
                    <Chip className="bg-red-50 text-red-800">Stopped</Chip>
                  ) : (
                    <Chip className="bg-summit-100 text-obsidian-900">Retrying {when(p.nextAttemptAt)}</Chip>
                  )}
                </td>
                <td className="max-w-md px-6 py-4 text-sm text-slate-700">{p.lastError ?? "–"}</td>
                <td className="px-6 py-4 text-right">
                  {isManager && p.status === "FAILED" && (
                    <button
                      type="button"
                      className={quietBtn}
                      disabled={busy !== ""}
                      onClick={() => act(p.id, `/bokun/retry/${p.booking.id}`, () => `${p.booking.bookingReference} sent to Bókun again.`)}
                    >
                      {busy === p.id ? "Retrying…" : "Retry"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Grid>
        )}
      </Panel>

      <Panel
        id="bokun-seats"
        title="Seat sync"
        description={
          state.lastSeatSync
            ? `Last run ${when(state.lastSeatSync.at)} (${state.lastSeatSync.status.toLowerCase()}): ${sync?.updated ?? 0} departure(s) updated, ${sync?.unchanged ?? 0} unchanged.`
            : "Not run yet."
        }
      >
        {sync && (sync.errors?.length || sync.notInBokun?.length) ? (
          <div className="space-y-4 px-6 py-5 text-sm text-slate-700">
            {sync.errors && sync.errors.length > 0 && (
              <div>
                <p className="font-medium text-red-800">Errors</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {sync.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            {sync.notInBokun && sync.notInBokun.length > 0 && (
              <div>
                <p className="font-medium">Website departures Bókun doesn&apos;t offer (bookings on them can&apos;t reach Bókun)</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {sync.notInBokun.slice(0, 15).map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
                {sync.notInBokun.length > 15 && <p className="mt-1">and {sync.notInBokun.length - 15} more.</p>}
              </div>
            )}
          </div>
        ) : (
          <Empty>{state.lastSeatSync ? "Every website departure matched a Bókun start time." : "Runs once Bókun is connected."}</Empty>
        )}
      </Panel>
    </div>
  );
}
