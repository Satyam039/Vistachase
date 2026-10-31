"use client";

// Staff pages that fail show what went wrong (message and server reference) instead of the
// guest page's "booking system is slow", so staff can report it and the server log can be
// searched for the reference. Old page code from before a deploy reloads once on its own.

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { isStaleBuildError, reloadOnceForNewVersion } from "@/lib/staleBuild";

export default function AdminError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = isStaleBuildError(error);

  useEffect(() => {
    console.error(error);
    if (stale) reloadOnceForNewVersion();
  }, [error, stale]);

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <div className="mx-auto max-w-3xl px-page py-16 sm:py-24">
        <p className="text-sm uppercase tracking-[0.18em] text-ocean-700">Staff</p>
        <h1 className="mt-3 text-4xl font-light tracking-tight">This page didn&apos;t load</h1>
        <p role="alert" className="mt-4 text-lg font-light leading-relaxed text-slate-700">
          {stale
            ? "The site was updated while this tab was open. Reload to get the new version."
            : "Reload the page. If it fails again, send the details below to whoever looks after the server."}
        </p>
        <div className="mt-6 rounded-2xl bg-white px-5 py-4 text-sm ring-1 ring-obsidian-900/10">
          <p className="break-words font-mono text-obsidian-900">{error.message || "Unknown error"}</p>
          {error.digest && (
            <p className="mt-2 text-slate-600">
              Server reference: <span className="font-mono">{error.digest}</span> (search the frontend log for it:{" "}
              <span className="font-mono">pm2 logs vistachase-frontend</span>)
            </p>
          )}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-obsidian-900 px-6 text-base text-white hover:bg-obsidian-800"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Reload page
          </button>
          <Link href="/admin" className="inline-flex h-12 items-center rounded-full px-5 text-base ring-1 ring-obsidian-900/20 hover:bg-white">
            Admin overview
          </Link>
        </div>
      </div>
    </div>
  );
}
