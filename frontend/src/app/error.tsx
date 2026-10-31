"use client";

// Shown when a page can't load its data (usually the booking system answering slowly for a
// moment) or fails in the browser. Same look as the 404 page.
//
// After a deploy, a tab opened earlier still points at the previous build's script files, which no
// longer exist: the next client-side navigation fails with a chunk-load error. That is fixed by a
// full reload, so it happens once automatically. "Try again" re-renders on the server for server
// errors (they carry a digest) and reloads the page for errors raised in the browser. The small
// reference line (digest, else the error type) helps staff report what went wrong.

import { useEffect, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Phone, RotateCw } from "lucide-react";

const STALE_BUILD = /ChunkLoadError|Loading (CSS )?chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;
const RELOADED_KEY = "vc-error-reloaded";

const isStaleBuild = (error: Error) => STALE_BUILD.test(`${error?.name ?? ""} ${error?.message ?? ""}`);

export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();

  useEffect(() => {
    console.error(error);
    if (!isStaleBuild(error)) return;
    // One automatic reload per page per minute, so a real outage can't loop.
    try {
      const last = Number(sessionStorage.getItem(RELOADED_KEY) ?? 0);
      if (Date.now() - last < 60_000) return;
      sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
    } catch {
      // Storage blocked: still reload once; the page will show this screen if it fails again.
    }
    window.location.reload();
  }, [error]);

  const retry = () => {
    if (!error.digest) {
      window.location.reload();
      return;
    }
    startRetry(() => {
      router.refresh();
      reset();
    });
  };
  const reference = error.digest ?? (error.name && error.name !== "Error" ? error.name : null);

  return (
    <div className="bg-obsidian-50">
      <section className="relative isolate overflow-hidden bg-obsidian-950">
        <Image src="/media/photos/moraine-lake-classic.webp" alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-60" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ocean-950 via-ocean-950/40 to-ocean-950/20" aria-hidden="true" />
        <div className="mx-auto flex max-w-5xl flex-col items-center px-page pb-14 pt-20 text-center sm:pb-20 sm:pt-28">
          <h1 className="mx-auto max-w-2xl text-4xl font-light tracking-tight text-white sm:text-5xl">We couldn&apos;t load this page</h1>
          <p role="alert" className="mx-auto mt-4 max-w-xl text-lg font-light leading-relaxed text-white/85">
            Our booking system is taking longer than usual to answer. Please try again in a moment, or call us and
            we&apos;ll book it for you.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={retry}
              disabled={isRetrying}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-base text-obsidian-900 shadow-lg hover:bg-obsidian-50 disabled:opacity-70"
            >
              <RotateCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} aria-hidden="true" />
              {isRetrying ? "Trying again…" : "Try again"}
            </button>
            <a href="tel:+18257349456" className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-base text-white ring-1 ring-white/40 hover:bg-white/10">
              <Phone className="h-4 w-4" aria-hidden="true" />
              +1 825-734-9456
            </a>
          </div>
          <p className="mt-6 text-sm text-white/75">
            Lines open 6 a.m. – 9 p.m. Mountain Time ·{" "}
            <Link href="/" className="underline underline-offset-4 hover:text-white">
              Home page
            </Link>
          </p>
          {reference && <p className="mt-3 font-mono text-xs text-white/75">Reference: {reference}</p>}
        </div>
      </section>
    </div>
  );
}
