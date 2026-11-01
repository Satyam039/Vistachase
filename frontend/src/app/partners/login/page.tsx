"use client";

// Partner sign in, inside the partner portal frame. Only partner (and admin) accounts get through;
// PortalSignIn signs anyone else straight out again.

import Link from "next/link";
import { PortalSignIn } from "@/components/layout/PortalSignIn";

export default function PartnerLoginPage() {
  return (
    <PortalSignIn
      title="Partner sign in"
      intro="Your links, referred bookings and earnings."
      help={
        <>
          Not a partner yet?{" "}
          <Link href="/partners#apply" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-900">
            Apply to the partner program
          </Link>
        </>
      }
      check={async (role) =>
        role === "AFFILIATE"
          ? { go: "/partners/dashboard" }
          : role === "ADMIN"
            ? { go: "/admin/partners" }
            : { error: "This isn't a partner account. Apply to the partner program first." }
      }
    />
  );
}
