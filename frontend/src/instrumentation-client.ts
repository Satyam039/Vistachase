// Browser start-up hook: loads client-side error tracking (sentry.client.config.ts).
// Only when NEXT_PUBLIC_SENTRY_DSN is set (inlined at build time), and as its own chunk: without
// a DSN the Sentry SDK (~80 kB of script) isn't shipped to visitors at all, and with one it no
// longer delays the first render of every page.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void import("../sentry.client.config");
}
