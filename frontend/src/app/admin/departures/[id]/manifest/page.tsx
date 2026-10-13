"use client";

// Printable passenger manifest for one departure (driver or guide): every travelling booking in
// pickup order with contact, party, pickup, add-ons, requests and payment due. "Print" prints only
// the manifest (A4 landscape); "Download CSV" uses the server's CSV export. Viewing and exporting
// are recorded in the audit log by the server.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";
import { Chip, Loading, adminApi, errorOf, isDenied, primaryBtn, quietBtn } from "@/components/admin/staff/shared";

interface Passenger {
  bookingId: string;
  bookingReference: string;
  status: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string;
  adults: number;
  children: number;
  infants: number;
  seats: number;
  pickupStop: string;
  pickupAddress: string | null;
  pickupTime: string;
  addOns: string[];
  specialRequests: string | null;
  paymentDue: boolean;
  isBoarded: boolean;
}

interface Manifest {
  departureId: string;
  experience: string;
  date: string;
  departureTime: string | null;
  returnTime: string | null;
  status: string;
  capacityTotal: number;
  totals: { bookings: number; adults: number; children: number; infants: number; seats: number; boarded: number };
  passengers: Passenger[];
}

// Print only the manifest: at every level from <html> down, hide each sibling that doesn't hold
// it (site header, announcement strip, footer, voice button, skip link). Rendered only on this
// page, so the rest of the site prints as before.
const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 10mm; }
  html, body { background: white !important; }
  *:has(#vc-manifest) > :not(:has(#vc-manifest)):not(#vc-manifest) { display: none !important; }
  *:has(#vc-manifest) { overflow: visible !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; }
  .astryx-app-shell-header, .vc-announce, .vc-scroll-progress { display: none !important; }
  #vc-manifest tr { break-inside: avoid; }
  #vc-manifest thead { display: table-header-group; }
}
`;

/** "Tue, Oct 13, 2026" for a YYYY-MM-DD departure date. */
function dayLabel(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function DepartureManifestPage() {
  const { id } = useParams<{ id: string }>();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    void adminApi<{ manifest: Manifest }>(`/departures/${encodeURIComponent(id)}/manifest`).then((res) => {
      if (isDenied(res.status)) return setState("denied");
      if (!res.ok || !res.data.manifest) {
        setError(res.status === 404 ? "This departure doesn't exist." : errorOf(res.data, "Couldn't load the manifest. Try again in a moment."));
        return setState("error");
      }
      setManifest(res.data.manifest);
      setState("ok");
    });
  }, [id]);

  const m = manifest;
  const totals = m?.totals;

  return (
    <div id="vc-manifest" className="min-h-screen bg-obsidian-50 text-obsidian-900 print:min-h-0 print:bg-white">
      <style>{PRINT_CSS}</style>
      <div className="print:hidden">
        <AdminHeader current="/admin/departures" eyebrow="Staff · Departures" title="Manifest" subtitle="Passengers travelling on this departure, in pickup order." />
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-page py-8 sm:py-10 print:max-w-none print:space-y-3 print:p-0">
        <p className="print:hidden">
          <Link href="/admin/departures" className="text-sm text-ocean-700 underline underline-offset-2">
            Back to departures
          </Link>
        </p>

        {state === "denied" && <StaffSignIn body="Sign in with an admin, operator or dispatch account to see manifests." />}
        {state === "error" && (
          <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
            {error}
          </p>
        )}
        {state === "loading" && (
          <div className="overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-obsidian-900/[0.07]">
            <Loading />
          </div>
        )}

        {m && totals && (
          <section aria-labelledby="manifest-heading" className="overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-obsidian-900/[0.07] print:overflow-visible print:rounded-none print:ring-0">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-obsidian-900/[0.06] px-6 py-5 print:px-0 print:py-2">
              <div>
                <p className="hidden text-xs uppercase tracking-[0.2em] text-slate-700 print:block">Vista Chase · Passenger manifest</p>
                <h2 id="manifest-heading" className="text-xl text-obsidian-900 print:text-lg">
                  {m.experience}
                </h2>
                <p className="mt-1 text-base text-slate-700 print:text-sm">
                  {dayLabel(m.date)} · Departs {m.departureTime ?? "–"}
                  {m.returnTime && ` · Back ${m.returnTime}`}
                  {m.status === "CANCELLED" && " · Off sale"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 print:hidden">
                <button type="button" className={primaryBtn} onClick={() => window.print()}>
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Print
                </button>
                <a href={`/api/admin/departures/${encodeURIComponent(m.departureId)}/manifest?format=csv`} download className={quietBtn}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download CSV
                </a>
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-px border-b border-obsidian-900/[0.06] bg-obsidian-900/[0.06] sm:grid-cols-6 print:grid-cols-6">
              {(
                [
                  ["Bookings", totals.bookings],
                  ["Adults", totals.adults],
                  ["Children", totals.children],
                  ["Infants", totals.infants],
                  ["Seats", `${totals.seats} of ${m.capacityTotal}`],
                  ["Boarded", `${totals.boarded} of ${totals.bookings}`],
                ] as [string, string | number][]
              ).map(([label, value]) => (
                <div key={label} className="bg-white px-6 py-3 print:px-2 print:py-1">
                  <dt className="text-sm text-slate-600 print:text-xs">{label}</dt>
                  <dd className="text-2xl font-light tabular-nums text-obsidian-900 print:text-base">{value}</dd>
                </div>
              ))}
            </dl>

            {m.passengers.length === 0 ? (
              <p className="px-6 py-12 text-center text-base text-slate-600">No one is booked on this departure yet.</p>
            ) : (
              <div className="overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ocean-600 print:overflow-visible" tabIndex={0} role="region" aria-label="Passengers">
                <table className="w-full min-w-[72rem] text-left text-base print:min-w-0 print:text-xs">
                  <thead className="bg-obsidian-50/70 text-sm text-slate-600 print:bg-white print:text-xs print:text-slate-700">
                    <tr className="print:border-b print:border-slate-400">
                      {["Pickup", "Pickup stop", "Reference", "Guest", "Phone", "Party (A/C/I)", "Add-ons", "Special requests", "Payment", "Boarded"].map((h) => (
                        <th key={h} scope="col" className="px-4 py-3 font-normal print:px-1 print:py-1">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-obsidian-900/[0.06] print:divide-slate-300">
                    {m.passengers.map((p) => (
                      <tr key={p.bookingId} className="align-top">
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums print:px-1 print:py-1">{p.pickupTime || "–"}</td>
                        <td className="px-4 py-3 print:px-1 print:py-1">
                          <span className="block">{p.pickupStop}</span>
                          {p.pickupAddress && <span className="block text-sm text-slate-600 print:text-xs">{p.pickupAddress}</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-sm print:px-1 print:py-1 print:text-xs">{p.bookingReference}</td>
                        <td className="px-4 py-3 print:px-1 print:py-1">{p.customerName}</td>
                        <td className="whitespace-nowrap px-4 py-3 print:px-1 print:py-1">
                          {p.customerPhone ? (
                            <a href={`tel:${p.customerPhone.replace(/[^\d+]/g, "")}`} className="text-ocean-700 underline underline-offset-2 print:text-obsidian-900 print:no-underline">
                              {p.customerPhone}
                            </a>
                          ) : (
                            "–"
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums print:px-1 print:py-1">
                          {p.adults} / {p.children} / {p.infants}
                        </td>
                        <td className="px-4 py-3 text-sm print:px-1 print:py-1 print:text-xs">{p.addOns.length ? p.addOns.join(", ") : "–"}</td>
                        <td className="max-w-[16rem] px-4 py-3 text-sm print:max-w-none print:px-1 print:py-1 print:text-xs">{p.specialRequests || "–"}</td>
                        <td className="px-4 py-3 print:px-1 print:py-1">{p.paymentDue ? <Chip className="bg-summit-100 text-obsidian-900 print:px-1 print:py-0 print:text-xs print:ring-1 print:ring-slate-500">Payment due</Chip> : "–"}</td>
                        <td className="px-4 py-3 print:px-1 print:py-1">
                          <input
                            type="checkbox"
                            checked={p.isBoarded}
                            readOnly
                            disabled
                            aria-label={`${p.customerName} boarded`}
                            className="h-5 w-5 accent-ocean-600 print:h-4 print:w-4"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
