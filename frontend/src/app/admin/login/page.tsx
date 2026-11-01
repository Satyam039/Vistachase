"use client";

// Staff sign in for the admin portal, separate from the guests' /login. Only admin, operator and
// dispatcher accounts get in (PortalSignIn signs anyone else straight out again).

import { PortalSignIn } from "@/components/layout/PortalSignIn";
import { portalFor, safeNextFor } from "@/lib/portals";

export default function AdminLoginPage() {
  return (
    <PortalSignIn
      title="Admin Portal Sign In"
      intro="Platform administration, fleet operations, departures and dispatch."
      help="Forgot your password? Ask an admin for a new password link (Staff → Password link)."
      check={async (role) =>
        portalFor(role) === "admin"
          ? { go: safeNextFor(role, new URLSearchParams(window.location.search).get("next")) ?? "/admin" }
          : { error: "This isn't a staff account. Use your admin, operator or dispatcher sign-in." }
      }
      demo={{ label: "fill the demo admin", email: "admin@vistachase.com", password: "VistaChaseAdmin2026!" }}
    />
  );
}
