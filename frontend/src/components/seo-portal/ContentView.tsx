"use client";

// Tour and destination copy and photos (components/admin/content), moved here from the admin area
// so SEO staff never open /admin. SEO managers and editors change it; viewers read it.

import { useCallback, useState } from "react";
import { ContentWorkspace } from "@/components/admin/content/ContentEditor";
import { PortalHeading } from "@/components/seo-portal/PortalShell";

export function ContentView() {
  const [denied, setDenied] = useState(false);
  const onDenied = useCallback(() => setDenied(true), []);
  return (
    <div className="space-y-6">
      <PortalHeading
        title="Tour & destination copy"
        intro="The words and photos on tour and destination pages. Prices, dates and booking settings stay with the operations team; search titles and descriptions are under Pages & metadata."
      />
      {denied ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
          Your account can&apos;t open page copy. Ask an admin for an SEO manager, editor or viewer role.
        </p>
      ) : (
        <ContentWorkspace onDenied={onDenied} />
      )}
    </div>
  );
}
