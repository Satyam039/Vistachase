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
  testAccount?: boolean;
  seatSync: boolean;
  counts: Record<string, number>;
  problems: Problem[];
  lastSeatSync: SeatSync | null;
}

interface ProductCheck {
  activities: { id: string; title: string }[];
  products: { slug: string; bokunId: string | null; found: boolean; title: string | null }[];
}

const MANAGERS = ["ADMIN", "OPERATOR"];

/**
 * The connected account's Bókun products next to the website products linked to them. A test
 * account has its own product IDs: pick the matching one for each tour and copy the
 * BOKUN_PRODUCT_OVERRIDES line into the server's backend/.env (docs/BOKUN.md "Test account").
 */
function ProductsPanel({ notify }: { notify: (m: string) => void }) {
  const [check, setCheck] = useState<ProductCheck | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const res = await adminApi<ProductCheck>("/bokun/products");
    setLoading(false);
    if (!res.ok) return notify(errorOf(res.data, "Couldn't read the products from Bókun."));
    setCheck(res.data);
    setPicked(Object.fromEntries(res.data.products.filter((p) => p.found && p.bokunId).map((p) => [p.slug, p.bokunId as string])));
  };

  const overrides = check
    ? check.products
        .filter((p) => picked[p.slug] && picked[p.slug] !== p.bokunId)
        .map((p) => `${p.slug}:${picked[p.slug]}`)
        .join(",")
    : "";
  const missing = check?.products.filter((p) => !p.found).length ?? 0;

  return (
    <Panel
      id="bokun-products"
      title="Products"
      description={
        check
          ? `${check.activities.length} product(s) in this Bókun account. ${missing === 0 ? "Every website tour is linked to one of them." : `${missing} website tour(s) point at a Bókun ID this account doesn't have, so their bookings can't reach Bókun.`}`
          : "Check that each website tour points at a product in the connected Bókun account."
      }
      actions={
        <button type="button" className={quietBtn} disabled={loading} onClick={() => void load()}>
          {loading ? "Reading…" : check ? "Check again" : "Check products"}
        </button>
      }
    >
      {check && (
        <>
          <Grid label="Website tours and their Bókun product" head={[["Website tour"], ["Bókun ID now"], ["In this account"], ["Use Bókun product"]]}>
            {check.products.map((p) => (
              <tr key={p.slug} className="align-top">
                <td className="px-6 py-4 text-sm font-medium">{p.slug}</td>
                <td className="px-6 py-4 text-sm">{p.bokunId ?? "–"}</td>
                <td className="px-6 py-4">
                  {p.found ? <Chip className="bg-emerald-50 text-emerald-800">Yes: {p.title}</Chip> : <Chip className="bg-red-50 text-red-800">Not found</Chip>}
                </td>
                <td className="px-6 py-4">
                  <select
                    aria-label={`Bókun product for ${p.slug}`}
                    className="w-full max-w-xs border border-slate-300 bg-white px-2 py-1 text-sm"
                    value={picked[p.slug] ?? ""}
                    onChange={(e) => setPicked((prev) => ({ ...prev, [p.slug]: e.target.value }))}
                  >
                    <option value="">Choose…</option>
                    {check.activities.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title || "(no title)"} ({a.id})
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </Grid>
          <div className="space-y-2 px-6 py-5 text-sm text-slate-700">
            {overrides ? (
              <>
                <p>Add this line to the server&apos;s backend/.env, then restart the API (pm2 restart vistachase-backend --update-env) and press Retry on the stopped bookings:</p>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all bg-slate-50 p-3 text-xs">BOKUN_PRODUCT_OVERRIDES={overrides}</pre>
                <button
                  type="button"
                  className={quietBtn}
                  onClick={() => {
                    void navigator.clipboard?.writeText(`BOKUN_PRODUCT_OVERRIDES=${overrides}`);
                    notify("Copied.");
                  }}
                >
                  Copy line
                </button>
              </>
            ) : (
              <p>Pick a Bókun product for each tour that says &quot;Not found&quot; and the .env line to add appears here.</p>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

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
              Connected to {state.apiUrl}
              {state.testAccount ? " (a Bókun test account)" : ""}. Every confirmed booking is also created in Bókun and cancellations follow.{" "}
              {state.seatSync
                ? "Bókun's seats are read into the calendar every 15 minutes."
                : state.testAccount
                  ? "Seat sync is off for a test account, so its test seats never change the real calendar (BOKUN_AVAILABILITY_SYNC=true turns it on)."
                  : "Seat sync is off (BOKUN_AVAILABILITY_SYNC=false)."}
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

      {state.connected && <ProductsPanel notify={notify} />}

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
