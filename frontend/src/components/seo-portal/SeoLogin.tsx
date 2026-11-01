"use client";

// Sign in to the SEO portal. Uses the site's own login (POST /api/auth/login: rate limited, locks
// after repeated failures, sets the HttpOnly session cookie), then checks the account may use the
// portal. Accounts without an SEO role are signed straight back out. There is no sign-up here:
// accounts are created by an admin (Admin → Staff → invite).

import { useSearchParams } from "next/navigation";
import { PortalFrame } from "@/components/layout/PortalFrame";
import { PortalSignIn } from "@/components/layout/PortalSignIn";

/** Only same-portal paths are followed after sign-in. */
function safeNext(next: string | null) {
  return next && /^\/seo(\/[A-Za-z0-9/_-]*)?$/.test(next) && !next.startsWith("/seo/login") ? next : "/seo";
}

export function SeoLogin() {
  const params = useSearchParams();
  return (
    <PortalFrame kind="seo">
      <PortalSignIn
        title="SEO portal"
        intro="For the Vista Chase SEO team. Accounts are created by an admin."
        notice={params.get("expired") === "1" ? "Your session ended. Sign in again to carry on." : undefined}
        help="Forgot your password? Ask an admin for a new password link (Staff → Password link)."
        check={async () => {
          const me = await fetch("/api/seo/portal/me", { cache: "no-store" });
          return me.ok
            ? { go: safeNext(params.get("next")) }
            : { error: "This account doesn't have access to the SEO portal. Ask an admin to give you an SEO role." };
        }}
      />
    </PortalFrame>
  );
}
