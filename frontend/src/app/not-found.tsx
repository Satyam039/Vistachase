import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found | Vista Chase",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-page py-24">
      <p className="text-xs font-bold uppercase tracking-widest text-ocean-600">Error 404</p>
      <h1 className="text-3xl font-bold text-obsidian-900 sm:text-4xl">We couldn&apos;t find that page</h1>
      <p className="text-base text-slate-600">
        The link may be out of date, or the page may have moved. Our tours, shuttles and destinations are a click away.
      </p>
      <div className="flex flex-wrap gap-3 pt-2">
        <Link href="/" className="rounded-md px-6 py-3 text-sm font-bold golden-summit-btn">
          Go to the home page
        </Link>
        <Link
          href="/search"
          className="rounded-md border border-slate-300 px-6 py-3 text-sm font-semibold text-obsidian-900 hover:bg-slate-100"
        >
          Search tours
        </Link>
      </div>
    </div>
  );
}
