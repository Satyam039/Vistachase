"use client";

// Spam checks shared by the enquiry form and account signup (owner, 2026-11-11/12: fake enquiries and
// bot signups). The backend checks the same things (backend modules/enquiries/spam.ts).

import { useEffect, useRef, useState } from "react";

/** Optional Cloudflare Turnstile (spam check); the backend needs TURNSTILE_SECRET_KEY to match. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void }) => string;
      reset: (id?: string) => void;
    };
  }
}

/** Fetches the signed form token (spam check: a person had the form open for a few seconds). */
export function useFormToken() {
  const [token, setToken] = useState("");
  const load = () =>
    fetch("/api/enquiries/form-token", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { token?: string }) => setToken(j.token ?? ""))
      .catch(() => setToken(""));
  useEffect(() => {
    load();
    // A token lasts a day: refresh it while the page stays open.
    const timer = window.setInterval(load, 6 * 60 * 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return { token, reload: load };
}

/** Renders the Turnstile widget when a site key is set; gives back its token. */
export function useTurnstile(ref: React.RefObject<HTMLDivElement | null>) {
  const [token, setToken] = useState("");
  const widget = useRef<string | null>(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !ref.current) return;
    const el = ref.current;
    const render = () => {
      if (!window.turnstile || widget.current) return;
      widget.current = window.turnstile.render(el, { sitekey: TURNSTILE_SITE_KEY, callback: setToken, "expired-callback": () => setToken("") });
    };
    if (window.turnstile) return render();
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [ref]);
  return {
    token,
    reset: () => {
      setToken("");
      if (widget.current) window.turnstile?.reset(widget.current);
    },
  };
}
