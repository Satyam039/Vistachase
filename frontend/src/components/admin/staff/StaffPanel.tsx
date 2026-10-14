"use client";

// Staff (admins only): everyone with a staff role, changing a role or removing staff access, and
// adding staff: an existing site account gets the role; a new person gets an account and a
// one-time link to choose their own password (no admin ever sets or sees a password). Role
// changes apply on the person's next request.

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Dropdown } from "@/components/forms/Dropdown";
import { Chip, Empty, Grid, Loading, Panel, adminApi, errorOf, field, isDenied, labelCls, primaryBtn, quietBtn, when, words } from "@/components/admin/staff/shared";

type StaffRole = "ADMIN" | "OPERATOR" | "DISPATCHER" | "SEO_MANAGER" | "EDITOR" | "VIEWER";

interface StaffMember {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: StaffRole;
  lockedUntil: string | null;
  createdAt: string;
  pendingInvite?: boolean;
  linkExpires?: string | null;
}

interface SetupLink {
  name: string;
  link: string;
  emailed: boolean;
  expires: string;
}

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "OPERATOR", label: "Operator" },
  { value: "DISPATCHER", label: "Dispatcher" },
  { value: "SEO_MANAGER", label: "SEO manager" },
  { value: "EDITOR", label: "Editor" },
  { value: "VIEWER", label: "Viewer" },
];
const roleLabel = (role: string) => ROLE_OPTIONS.find((o) => o.value === role)?.label ?? words(role);
const ROW_OPTIONS = [...ROLE_OPTIONS, { value: "CUSTOMER", label: "Remove staff access" }];

const ROLE_STYLE: Record<string, string> = {
  ADMIN: "bg-ocean-50 text-ocean-800",
  OPERATOR: "bg-summit-100 text-obsidian-900",
  DISPATCHER: "bg-obsidian-100 text-slate-700",
  SEO_MANAGER: "bg-emerald-50 text-emerald-900",
  EDITOR: "bg-emerald-50 text-emerald-900",
  VIEWER: "bg-obsidian-100 text-slate-700",
};

const nameOf = (s: { name: string | null; email: string }) => s.name || s.email;

export function StaffPanel({ notify, onDenied }: { notify: (m: string) => void; onDenied: () => void }) {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [setup, setSetup] = useState<SetupLink | null>(null);
  const [emailConfigured, setEmailConfigured] = useState(false);

  const load = useCallback(async () => {
    const res = await adminApi<{ staff: StaffMember[]; emailConfigured?: boolean }>("/staff");
    if (isDenied(res.status)) return onDenied();
    if (!res.ok) return setError(errorOf(res.data, "Couldn't load staff."));
    setError("");
    setStaff(res.data.staff);
    setEmailConfigured(!!res.data.emailConfigured);
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

  async function newLink(member: StaffMember) {
    setSaving(member.id);
    const res = await adminApi<{ setupLink: string; emailed: boolean; linkExpires: string }>(`/staff/${member.id}/setup-link`, "POST");
    setSaving(null);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't create a link."));
    setError("");
    setSetup({ name: nameOf(member), link: res.data.setupLink, emailed: res.data.emailed, expires: res.data.linkExpires });
    await load();
  }

  return (
    <>
      {setup && <SetupLinkNotice setup={setup} onClose={() => setSetup(null)} />}
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
                    <Chip className={ROLE_STYLE[s.role] ?? "bg-obsidian-100 text-slate-700"}>{roleLabel(s.role)}</Chip>
                    {s.pendingInvite && <span className="mt-1 block text-sm text-slate-600">Invited, hasn&apos;t set a password</span>}
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
                        <button type="button" className={quietBtn} disabled={saving === s.id} onClick={() => newLink(s)}>
                          Password link
                          <span className="sr-only"> for {nameOf(s)}</span>
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

      <AddStaffForm notify={notify} onAdded={load} onLink={setSetup} emailConfigured={emailConfigured} />
      <RoleGuide />
    </>
  );
}

/** The one-time link, shown once. It is not stored anywhere the admin can see it again. */
function SetupLinkNotice({ setup, onClose }: { setup: SetupLink; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <section role="status" className="space-y-3 rounded-[1.75rem] bg-white p-6 ring-1 ring-ocean-200">
      <h2 className="text-xl text-obsidian-900">Password link for {setup.name}</h2>
      <p className="text-base text-slate-700">
        {setup.emailed ? "We emailed this link to them. " : "Email isn't set up yet, so send them this link yourself (a direct message, not a public channel). "}
        It lets them choose their own password, works once and expires {when(setup.expires)}. It won&apos;t be shown again; make a new one from the Staff list if it&apos;s lost.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input readOnly aria-label="One-time password link" className={`${field} font-mono text-sm`} value={setup.link} onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className={primaryBtn}
          onClick={() => {
            void navigator.clipboard?.writeText(setup.link).then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <button type="button" className={quietBtn} onClick={onClose}>
          Done
        </button>
      </div>
    </section>
  );
}

function AddStaffForm({
  notify,
  onAdded,
  onLink,
  emailConfigured,
}: {
  notify: (m: string) => void;
  onAdded: () => Promise<void>;
  onLink: (s: SetupLink) => void;
  emailConfigured: boolean;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("SEO_MANAGER");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await adminApi<{ user: { email: string; name: string | null; role: string }; invited: boolean; setupLink?: string; emailed?: boolean; linkExpires?: string }>(
      "/staff",
      "POST",
      { email: email.trim(), role, ...(name.trim() ? { name: name.trim() } : {}) },
    );
    setBusy(false);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't add this person."));
    setError("");
    setEmail("");
    setName("");
    if (res.data.invited && res.data.setupLink) {
      onLink({ name: nameOf(res.data.user), link: res.data.setupLink, emailed: !!res.data.emailed, expires: res.data.linkExpires ?? "" });
      notify(`Account created for ${nameOf(res.data.user)} as ${roleLabel(res.data.user.role).toLowerCase()}. They can sign in once they choose a password.`);
    } else {
      notify(`Saved. ${nameOf(res.data.user)} is now ${roleLabel(res.data.user.role).toLowerCase()} and has access at once.`);
    }
    await onAdded();
  }

  return (
    <Panel
      id="staff-add"
      title="Add staff"
      description={
        <>
          For someone who already has a site account, the email is enough. For someone new, add their name too: we create the account and give you a
          one-time link for them to choose their own password{emailConfigured ? " (also emailed to them)" : ""}. People can also sign up at{" "}
          <Link href="/register" className="text-ocean-700 underline">
            /register
          </Link>{" "}
          first.
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 px-6 py-5 sm:grid-cols-[2fr_2fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="staff-add-email" className={labelCls}>
            Email
          </label>
          <input id="staff-add-email" type="email" required autoComplete="off" maxLength={254} className={field} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="staff-add-name" className={labelCls}>
            Name (new accounts)
          </label>
          <input id="staff-add-name" type="text" autoComplete="off" maxLength={80} className={field} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Dropdown id="staff-add-role" label="Role" value={role} onChange={(v) => setRole(v as StaffRole)} options={ROLE_OPTIONS} />
        <button type="submit" className={primaryBtn} disabled={busy}>
          {busy ? "Adding…" : "Add staff"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-700 sm:col-span-4">
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
    ["SEO manager", "The SEO workspace (keywords, page metadata, publishing, redirects, audits, llms.txt) and tour and destination copy. No bookings, payments, partners or staff."],
    ["Editor", "Tour and destination copy, and the words and images of SEO pages and guides. Can't change indexing, URLs, publishing, keywords or redirects."],
    ["Viewer", "Read-only access to the SEO workspace and content."],
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
