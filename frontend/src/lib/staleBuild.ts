// After a deploy (or a rebuild on the server without a restart) a tab that was already open asks
// for page code that no longer exists, and the page fails with a "chunk" error. Only a full reload
// fixes that: "Try again" (router.refresh + reset) keeps the old code. The error pages reload once
// on their own; the timestamp stops a reload loop if the server itself is broken.

const KEY = "vc-stale-build-reload";
const LOOP_GUARD_MS = 30_000;

export function isStaleBuildError(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | null;
  const text = `${e?.name ?? ""} ${e?.message ?? ""}`;
  return /ChunkLoadError|Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Failed to find Server Action|missing required error components/i.test(text);
}

/** Reloads the page from the server unless it already did so in the last 30 seconds. */
export function reloadOnceForNewVersion(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < LOOP_GUARD_MS) return false;
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Storage blocked: reload anyway; a broken server shows the error page again.
  }
  window.location.reload();
  return true;
}
