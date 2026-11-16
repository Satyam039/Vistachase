"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  LogOut,
  Mail,
  Phone,
  ShieldAlert,
  Trash2,
  User,
} from "lucide-react";
import { AUTH_FIELD } from "@/components/forms/AuthShell";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  emailVerified: boolean;
  pendingEmail: string | null;
  createdAt: string;
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Personal Info Form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Email Change Form
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Delete Account Form
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const res = await fetch("/api/account/profile");
        const data = await res.json();
        if (!res.ok || !data.success) {
          router.replace("/login");
          return;
        }
        setProfile(data.user);
        setName(data.user.name || "");
        setPhone(data.user.phone || "");
      } catch {
        setProfileMsg({ type: "error", text: "Failed to load account profile." });
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setProfileMsg({ type: "error", text: data.error || "Failed to update profile." });
      } else {
        setProfile(data.user);
        setProfileMsg({
          type: "success",
          text: "Profile updated successfully. A confirmation email has been sent if your phone number changed.",
        });
      }
    } catch {
      setProfileMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailMsg(null);
    setEmailSaving(true);
    try {
      const res = await fetch("/api/account/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail, password: emailPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setEmailMsg({ type: "error", text: data.error || "Failed to request email change." });
      } else {
        setEmailMsg({ type: "success", text: data.message });
        setNewEmail("");
        setEmailPassword("");
        if (profile) {
          setProfile({ ...profile, pendingEmail: newEmail });
        }
      }
    } catch {
      setEmailMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError("");
    setDeleting(true);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setDeleteError(data.error || "Failed to delete account.");
        setDeleting(false);
      } else {
        window.location.assign("/");
      }
    } catch {
      setDeleteError("Network error. Please try again.");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading your profile…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      {/* Header Band */}
      <section className="relative isolate overflow-hidden bg-obsidian-950 text-white">
        <Image
          src="/media/photos/moraine-lake-perfect-reflection.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover opacity-50"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ocean-950 via-ocean-950/45 to-ocean-950/20" />
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-page pb-12 pt-14 sm:pb-16 sm:pt-20 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/account/trips"
              className="mb-3 inline-flex items-center gap-1.5 text-sm uppercase tracking-[0.22em] text-summit-300 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Back to My Trips
            </Link>
            <h1 className="text-4xl font-light tracking-tight text-white sm:text-5xl lg:text-6xl">Account Settings</h1>
            <p className="mt-3 max-w-xl text-lg font-light text-white/85">
              Manage your personal information, contact email, phone number, and security.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/account/trips"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm text-white hover:bg-white/10"
            >
              My trips & vouchers
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm text-white hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      </section>

      {/* Main Form Content */}
      <div className="mx-auto max-w-4xl px-page py-10 sm:py-14 space-y-10">
        {/* Section 1: Personal Information */}
        <div className="rounded-none bg-white p-6 ring-1 ring-obsidian-900/[0.07] sm:p-8">
          <div className="flex items-center gap-3 border-b border-obsidian-900/[0.07] pb-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-ocean-50 text-ocean-700">
              <User className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-light text-obsidian-900 sm:text-2xl">Personal Information</h2>
              <p className="text-sm text-slate-600">Update your name and primary contact details.</p>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="mt-6 space-y-5">
            {profileMsg && (
              <p
                role="alert"
                className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                  profileMsg.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                }`}
              >
                {profileMsg.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                {profileMsg.text}
              </p>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Full Name</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First and last name"
                className={AUTH_FIELD}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Phone Number</span>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (403) 555-0199"
                  className={`${AUTH_FIELD} pl-10`}
                />
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <span className="mt-1.5 block text-xs text-slate-500">
                Our guides and drivers use this number for morning pickups and tour coordination.
              </span>
            </label>

            <div className="pt-2">
              <button
                type="submit"
                disabled={profileSaving}
                className="golden-summit-btn inline-flex h-11 items-center justify-center rounded-full px-6 text-sm disabled:opacity-60"
              >
                {profileSaving ? "Saving changes…" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>

        {/* Section 2: Change Registered Email Address */}
        <div className="rounded-none bg-white p-6 ring-1 ring-obsidian-900/[0.07] sm:p-8">
          <div className="flex items-center gap-3 border-b border-obsidian-900/[0.07] pb-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-ocean-50 text-ocean-700">
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-light text-obsidian-900 sm:text-2xl">Change Registered Email Address</h2>
              <p className="text-sm text-slate-600">
                Update your account email address. A confirmation link will be sent to verify the new email.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-obsidian-900/[0.05]">
              <span className="text-xs uppercase tracking-wider text-slate-500">Current Registered Email</span>
              <p className="mt-1 flex items-center gap-2 font-medium text-obsidian-900">
                {profile?.email}
                {profile?.emailVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 ring-1 ring-emerald-200">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Verified
                  </span>
                )}
              </p>
            </div>

            {profile?.pendingEmail && (
              <div role="status" className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
                <Clock className="h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <p className="font-semibold">Email change pending verification</p>
                  <p className="mt-0.5 text-xs text-amber-800">
                    We sent a verification link to <strong>{profile.pendingEmail}</strong>. Please check your inbox and click the link to complete the update.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleChangeEmail} className="space-y-5">
              {emailMsg && (
                <p
                  role="alert"
                  className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                    emailMsg.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                  }`}
                >
                  {emailMsg.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  {emailMsg.text}
                </p>
              )}

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">New Email Address</span>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new.email@example.com"
                  className={AUTH_FIELD}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Current Password (to verify it&apos;s you)</span>
                <div className="relative">
                  <input
                    type={showEmailPassword ? "text" : "password"}
                    required
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    placeholder="Enter current password"
                    className={`${AUTH_FIELD} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmailPassword((s) => !s)}
                    aria-label={showEmailPassword ? "Hide password" : "Show password"}
                    className="absolute right-1.5 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 hover:bg-obsidian-50"
                  >
                    {showEmailPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={emailSaving}
                className="golden-summit-btn inline-flex h-11 items-center justify-center rounded-full px-6 text-sm disabled:opacity-60"
              >
                {emailSaving ? "Sending verification email…" : "Send Verification Link"}
              </button>
            </form>
          </div>
        </div>

        {/* Section 3: Delete Account Permanently */}
        <div className="rounded-none border border-red-200 bg-red-50/40 p-6 sm:p-8">
          <div className="flex items-center gap-3 border-b border-red-200/80 pb-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-light text-red-950 sm:text-2xl">Delete Account Permanently</h2>
              <p className="text-sm text-red-900/80">
                Permanently close your Vista Chase account and delete your personal information.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <p className="text-sm text-slate-700 leading-relaxed">
              Once deleted, your login credentials will be permanently erased. Past bookings and vouchers remain securely
              recorded for tour operation and tax purposes, but will no longer be linked to an online user profile.
            </p>

            <button
              type="button"
              onClick={() => {
                setDeleteModalOpen(true);
                setDeleteError("");
                setDeletePassword("");
              }}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-red-300 bg-white px-5 text-sm font-medium text-red-700 transition hover:bg-red-600 hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
              Delete Account Permanently
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {deleteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/70 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-obsidian-900/10 sm:p-8">
            <div className="flex items-center gap-3 text-red-700">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                <Trash2 className="h-5 w-5" />
              </span>
              <h3 className="text-xl font-medium text-obsidian-900">Confirm Account Deletion</h3>
            </div>

            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              This action cannot be undone. Please enter your account password to confirm permanent deletion.
            </p>

            <form onSubmit={handleDeleteAccount} className="mt-6 space-y-4">
              {deleteError && (
                <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {deleteError}
                </p>
              )}

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
                <div className="relative">
                  <input
                    type={showDeletePassword ? "text" : "password"}
                    required
                    autoFocus
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter your password"
                    className={`${AUTH_FIELD} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword((s) => !s)}
                    className="absolute right-1.5 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 hover:bg-obsidian-50"
                  >
                    {showDeletePassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </label>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="h-11 rounded-full border border-slate-300 px-5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting || !deletePassword}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-red-600 px-6 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? "Deleting…" : "Permanently Delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
