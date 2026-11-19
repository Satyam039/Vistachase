"use client";

// Partner dashboard → Products (owner, 2026-11-18): every product with the partner's own link.
// Each link is the product's real page address plus ?ref=<code>, so it opens that product (not
// the home page) and the address stays the product's; the site stores the code for 30 days
// (src/middleware.ts) and credits bookings made in that time. Opening a link here opens a new tab,
// so the partner stays in the portal.
//
// Banff activity tickets are left out: they are booked on the operator's own site, so a referral
// can't be credited.

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Check, Copy, ExternalLink } from "lucide-react";
import { docTitleAndSummary } from "@/lib/tourContent";
import { TWO_DAY_PACKAGE } from "@/lib/sharedTours";
import { PRIVATE_PACKAGES } from "@/lib/privateTours";

interface ApiTour {
  slug: string;
  title: string;
  category: string;
  featuredImage?: string | null;
  basePrice?: number;
}

interface Product {
  path: string;
  title: string;
  image?: string | null;
}

const GROUPS: { id: string; title: string }[] = [
  { id: "SHARED", title: "Shared tours" },
  { id: "PRIVATE", title: "Private tours" },
  { id: "MULTIDAY", title: "Multi-day tours" },
  { id: "SHUTTLE", title: "Shuttles" },
  { id: "PAGES", title: "Collection pages" },
];

/** Multi-day packages that have their own pages (not catalog rows). */
const PACKAGES: Product[] = [
  { path: TWO_DAY_PACKAGE.href, title: TWO_DAY_PACKAGE.title, image: TWO_DAY_PACKAGE.images[0]?.src },
  { path: "/two-day-rockies-explorer/private", title: PRIVATE_PACKAGES.two.title, image: "/media/photos/moraine-lake-classic.webp" },
  { path: `/${PRIVATE_PACKAGES.three.slug}`, title: PRIVATE_PACKAGES.three.title, image: "/media/photos/athabasca-glacier.webp" },
  { path: `/${PRIVATE_PACKAGES.four.slug}`, title: PRIVATE_PACKAGES.four.title, image: "/media/photos/athabasca-glacier.webp" },
];

const PAGES: Product[] = [
  { path: "/", title: "Home page" },
  { path: "/shared-tours", title: "All shared tours" },
  { path: "/private-tours", title: "All private tours" },
  { path: "/multi-day-tour-package-for-banff", title: "All multi-day tours" },
  { path: "/shuttles", title: "Moraine Lake & Lake Louise shuttles" },
];

export function PartnerProducts({ code }: { code: string }) {
  const [tours, setTours] = useState<ApiTour[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState("https://www.vistachase.com");

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/tours")
      .then((r) => r.json())
      .then((d) => setTours(d.tours ?? []))
      .catch(() => setTours([]));
  }, []);

  const groups = useMemo(() => {
    const by: Record<string, Product[]> = { SHARED: [], PRIVATE: [], MULTIDAY: [...PACKAGES], SHUTTLE: [], PAGES };
    for (const t of tours ?? []) {
      if (!(t.category in by) || t.category === "PAGES") continue;
      by[t.category].push({ path: `/${t.slug}`, title: docTitleAndSummary(t.slug)?.title ?? t.title, image: t.featuredImage });
    }
    return GROUPS.map((g) => ({ ...g, products: by[g.id] ?? [] })).filter((g) => g.products.length);
  }, [tours]);

  const linkFor = (path: string) => `${origin}${path}?ref=${encodeURIComponent(code)}`;

  async function copy(path: string) {
    try {
      await navigator.clipboard.writeText(linkFor(path));
      setCopied(path);
      window.setTimeout(() => setCopied((c) => (c === path ? null : c)), 2500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-light text-slate-900">Products</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Your own link for every tour. Each link opens that product&apos;s page with your code <span className="font-mono">{code}</span> attached, and
          bookings made within 30 days are credited to you. Copy a link to share it, or open it to see what guests see.
        </p>
      </div>

      {tours === null ? (
        <p className="text-sm text-slate-600">Loading products…</p>
      ) : (
        groups.map((g) => (
          <div key={g.id} className="space-y-3">
            <h2 className="text-lg font-light text-slate-900">{g.title}</h2>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {g.products.map((p) => (
                <li key={p.path} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    {p.image ? (
                      <Image src={p.image} alt="" width={96} height={64} className="h-16 w-24 shrink-0 object-cover" />
                    ) : (
                      <span className="h-16 w-24 shrink-0 bg-obsidian-100" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      <p className="text-base text-slate-900">{p.title}</p>
                      <p className="truncate font-mono text-xs text-slate-600">{linkFor(p.path)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => copy(p.path)}
                      className="golden-summit-btn inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm"
                    >
                      {copied === p.path ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                      {copied === p.path ? "Copied" : "Copy link"}
                      <span className="sr-only"> for {p.title}</span>
                    </button>
                    <a
                      href={linkFor(p.path)}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 px-5 text-sm text-slate-800 hover:bg-slate-50"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Open
                      <span className="sr-only"> {p.title} (new tab)</span>
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <p aria-live="polite" className="sr-only">
        {copied ? "Link copied" : ""}
      </p>
    </section>
  );
}
