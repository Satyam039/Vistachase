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
    <aside aria-label="Announcement" className="vc-announce relative bg-obsidian-950 text-white">
      {/* Owner's wording (doc, 2026-10-28): one short line in small type. */}
      <div className="mx-auto flex min-h-9 max-w-7xl items-center gap-2.5 pl-4 pr-1 text-xs sm:text-[0.8125rem] lg:pl-9 lg:pr-5">
        <Info className="hidden h-3.5 w-3.5 shrink-0 text-summit-400 sm:block" aria-hidden="true" />
        <p className="min-w-0 flex-1 py-1 leading-snug text-white/90">
          Moraine Lake Road is closed to private cars<span className="hidden sm:inline">; Lake Louise parking is limited. Book ahead.</span>
          <span className="sm:hidden">.</span>{" "}
          <Link href="/shuttles#departures" className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-summit-300 underline decoration-summit-300/50 underline-offset-4 hover:decoration-summit-300">
            View Departures
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </p>
        <button
          type="button"
          onClick={close}
          aria-label="Close announcement"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-summit-400"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
