// The partner program lives at /affiliates (one page since Nov 2026). The redirect is also in
// BUILT_IN_REDIRECTS (backend seo.redirects.ts), which the middleware applies first; this is the
// fallback. /partners/login and /partners/dashboard are unchanged.

import { permanentRedirect } from "next/navigation";

export default function PartnersPage() {
  permanentRedirect("/affiliates");
}
