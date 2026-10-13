"use client";

// Staff (admins only): everyone with a staff role, changing a role or removing staff access, and
// giving an existing site account a staff role. Role changes apply on the person's next request.

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Dropdown } from "@/components/forms/Dropdown";
import { Chip, Empty, Grid, Loading, Panel, adminApi, errorOf, field, isDenied, labelCls, primaryBtn, quietBtn, when, words } from "@/components/admin/staff/shared";

type StaffRole = "ADMIN" | "OPERATOR" | "DISPATCHER";

interface StaffMember {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: StaffRole;
  lockedUntil: string | null;
  createdAt: string;
}

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "OPERATOR", label: "Operator" },
  { value: "DISPATCHER", label: "Dispatcher" },
];
const ROW_OPTIONS = [...ROLE_OPTIONS, { value: "CUSTOMER", label: "Remove staff access" }];

const ROLE_STYLE: Record<string, string> = {
  ADMIN: "bg-ocean-50 text-ocean-800",
  OPERATOR: "bg-summit-100 text-obsidian-900",
  DISPATCHER: "bg-obsidian-100 text-slate-700",
};

const nameOf = (s: { name: string | null; email: string }) => s.name || s.email;

export function StaffPanel({ notify, onDenied }: { notify: (m: string) => void; onDenied: () => void }) {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await adminApi<{ staff: StaffMember[] }>("/staff");
    if (isDenied(res.status)) return onDenied();
    if (!res.ok) return setError(errorOf(res.data, "Couldn't load staff."));
    setError("");
    setStaff(res.data.staff);
    setChoice({});
  }, [onDenied]);

  useEffect(() => {
    void load();
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user?: { id: string } }) => setMeId(d.user?.id ?? null))
      .catch(() => setMeId(null));
  }, [load]);

  async function save(member: StaffMember) {
    const role = choice[member.id];
    if (!role || role === member.role) return;
    setSaving(member.id);
    const res = await adminApi(`/staff/${member.id}`, "PATCH", { role });
    setSaving(null);
    if (!res.ok) {
      setError(errorOf(res.data, `Couldn't change ${nameOf(member)}'s access.`));
      return;
    }
    setError("");
    notify(`Saved. ${nameOf(member)}'s access changed at once; they don't need to sign out.`);
    await load();
  }

  return (
    <>
      <Panel id="staff-list" title="Staff" description="Everyone who can use the staff screens. Changes apply at once and are recorded in the audit log.">
        {error && (
          <p role="alert" className="mx-6 my-4 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
            {error}
          </p>
        )}
        {!staff ? (
          <Loading />
        ) : staff.length === 0 ? (
          <Empty>No staff accounts yet.</Empty>
        ) : (
          <Grid label="Staff" minWidth="min-w-[64rem]" head={[["Name"], ["Email"], ["Phone"], ["Role"], ["Added"], ["Access"]]}>
            {staff.map((s) => {
              const isMe = s.id === meId;
              const picked = choice[s.id] ?? s.role;
              return (
                <tr key={s.id} className="align-top hover:bg-obsidian-50/60">
                  <td className="px-6 py-4">
                    <span className="block text-obsidian-900">{s.name || "–"}</span>
                    {s.lockedUntil && new Date(s.lockedUntil) > new Date() && <span className="block text-sm text-red-700">Locked until {when(s.lockedUntil)}</span>}
                  </td>
                  <td className="break-all px-6 py-4 text-sm">{s.email}</td>
                  <td className="px-6 py-4 text-sm">{s.phone || <span className="text-slate-600">–</span>}</td>
                  <td className="px-6 py-4">
                    <Chip className={ROLE_STYLE[s.role] ?? "bg-obsidian-100 text-slate-700"}>{words(s.role)}</Chip>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{when(s.createdAt)}</td>
                  <td className="px-6 py-4">
                    {isMe ? (
                      <span className="text-sm text-slate-600">You</span>
                    ) : (
                      <div className="flex min-w-[18rem] items-end gap-2">
                        <Dropdown
                          id={`staff-role-${s.id}`}
                          label={`Access for ${nameOf(s)}`}
                          hideLabel
                          className="flex-1"
                          value={picked}
                          onChange={(v) => setChoice((c) => ({ ...c, [s.id]: v }))}
                          options={ROW_OPTIONS}
                        />
                        <button type="button" className={quietBtn} disabled={picked === s.role || saving === s.id} onClick={() => save(s)}>
                          {saving === s.id ? "Saving…" : "Save"}
                          <span className="sr-only"> access for {nameOf(s)}</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </Grid>
        )}
      </Panel>

      <AddStaffForm notify={notify} onAdded={load} />
      <RoleGuide />
    </>
  );
}

function AddStaffForm({ notify, onAdded }: { notify: (m: string) => void; onAdded: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("DISPATCHER");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await adminApi<{ user: { email: string; name: string | null; role: string } }>("/staff", "POST", { email: email.trim(), role });
    setBusy(false);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't add this person."));
    setError("");
    setEmail("");
    notify(`Saved. ${nameOf(res.data.user)} is now ${words(res.data.user.role).toLowerCase()} and has access at once.`);
    await onAdded();
  }

  return (
    <Panel
      id="staff-add"
      title="Add staff"
      description={
        <>
          They need an account on the site first (they can sign up at{" "}
          <Link href="/register" className="text-ocean-700 underline">
            /register
          </Link>
          ).
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 px-6 py-5 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="staff-add-email" className={labelCls}>
            Email
          </label>
          <input id="staff-add-email" type="email" required autoComplete="off" maxLength={254} className={field} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Dropdown id="staff-add-role" label="Role" value={role} onChange={(v) => setRole(v as StaffRole)} options={ROLE_OPTIONS} />
        <button type="submit" className={primaryBtn} disabled={busy}>
          {busy ? "Adding…" : "Add staff"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-700 sm:col-span-3">
            {error}
          </p>
        )}
      </form>
    </Panel>
  );
}

function RoleGuide() {
  const rows: [string, string][] = [
    ["Admin", "Everything, including staff, the audit log and refunds."],
    ["Operator", "Bookings, cancellations, Quick Book, departures and pickup stops."],
    ["Dispatcher", "Dispatch, check-in and read-only booking and departure screens."],
  ];
  return (
    <Panel id="staff-roles" title="What each role can do">
      <dl className="divide-y divide-obsidian-900/[0.06]">
        {rows.map(([role, text]) => (
          <div key={role} className="grid gap-1 px-6 py-4 sm:grid-cols-[10rem_1fr]">
            <dt className="text-obsidian-900">{role}</dt>
            <dd className="text-slate-700">{text}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
