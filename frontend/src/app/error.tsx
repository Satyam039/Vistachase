"use client";

// Shown when a page can't load its data (usually the booking system answering slowly for a
// moment). Same look as the 404 page; "Try again" re-renders the page on the server.

import { useEffect, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Phone, RotateCw } from "lucide-react";

export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  const retry = () => {
    startRetry(() => {
      router.refresh();
      reset();
    });
  };

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
        </div>
      </section>
    </div>
  );
}
