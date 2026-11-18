"use client";

// On a checkout page every link opens in a new tab, so the guest never leaves the checkout and
// loses what they entered (owner, 2026-11-18). Mounted on the checkout pages (/book and the package
// booking pages): it catches clicks on any link on the page (header, menu, footer, policy links)
// and opens it in a new tab instead. Phone, email and download links, links to a spot on the same
// page, and clicks with a modifier key (the browser's own new tab / window) are left alone.

import { useEffect } from "react";

export function CheckoutLinksInNewTab({ active = true }: { active?: boolean }) {
  useEffect(() => {
    if (!active) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const raw = link.getAttribute("href") ?? "";
      if (!raw || raw.startsWith("#") || /^(mailto|tel|sms|javascript):/i.test(raw)) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
      event.preventDefault();
      event.stopPropagation();
      window.open(url.href, "_blank", "noopener");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active]);
  return null;
}
