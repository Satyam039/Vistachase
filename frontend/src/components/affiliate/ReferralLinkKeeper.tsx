"use client";

// Keeps a partner's ?ref=<code> in the address bar while the guest browses the public site, so a
// partner link like /banff-highlights-tour?ref=ABCPRIVATE still shows the code after the guest
// clicks to another page. Credit for bookings comes from the vc_ref cookie (see middleware.ts);
// this only keeps the visible address consistent. It rewrites the address in place (no reload,
// no new history entry), and does nothing when no partner link was opened in the last 30 days.

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { refFromCookies, withRef } from "@/lib/referral";

function Keeper() {
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search?.toString() ?? "";

  useEffect(() => {
    const next = withRef(window.location.href, refFromCookies(document.cookie));
    // Next.js (14.1+) syncs native replaceState with its router, so this is safe in the App Router.
    if (next) window.history.replaceState(window.history.state, "", next);
  }, [pathname, query]);

  return null;
}

export function ReferralLinkKeeper() {
  return (
    <Suspense fallback={null}>
      <Keeper />
    </Suspense>
  );
}
