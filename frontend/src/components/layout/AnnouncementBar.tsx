"use client";

// Site-wide announcement strip (GetYourGuide / Viator style): one slim line above the header that
// scrolls away with the page (it is not part of the sticky header), short copy on phones, one link
// and a close button. Closing is remembered on this device: a tiny script in the root layout
// (ANNOUNCE_SCRIPT in lib/announcement.ts) marks <html> before first paint, so a closed bar never flashes back on reload.

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Info, X } from "lucide-react";
import { ANNOUNCEMENT } from "@/lib/announcement";

export function AnnouncementBar() {
  const [closed, setClosed] = useState(false);
  if (closed) return null;

  const close = () => {
    try {
      localStorage.setItem(ANNOUNCEMENT.storageKey, ANNOUNCEMENT.id);
    } catch {
      /* private mode: closes for this page view only */
    }
    document.documentElement.setAttribute("data-announce-closed", "");
    setClosed(true);
    // Keep keyboard users in place: continue from the site header's first control.
    document.querySelector<HTMLElement>(".astryx-app-shell-header button, .astryx-app-shell-header a")?.focus();
  };

  return (
    <aside aria-label="Announcement" className="vc-announce relative bg-ocean-950 text-white">
      <div className="mx-auto flex min-h-11 max-w-7xl items-center gap-3 py-0.5 pl-4 pr-1 text-sm lg:pl-9 lg:pr-5">
        <Info className="hidden h-4 w-4 shrink-0 text-summit-400 sm:block" aria-hidden="true" />
        <p className="min-w-0 flex-1 leading-snug text-white">
          <span className="sm:hidden">No private cars to Moraine Lake.</span>
          <span className="hidden sm:inline">
            Moraine Lake Road is closed to private vehicles.{" "}
            <span className="hidden text-white/75 xl:inline">Vista Chase shuttles and tours still have guaranteed access.</span>
            <span className="text-white/75 xl:hidden">Our shuttles still go.</span>
          </span>{" "}
          <Link href="/pickup-finder" className="inline-flex items-center gap-1 whitespace-nowrap text-summit-300 underline decoration-summit-300/50 underline-offset-4 hover:decoration-summit-300">
            <span className="sm:hidden">Pickups</span>
            <span className="hidden sm:inline">Find your hotel pickup</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </p>
        <button
          type="button"
          onClick={close}
          aria-label="Close announcement"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-summit-400"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
