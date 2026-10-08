"use client";

// Full-screen AI concierge: the same conversation as the floating panel (ConciergeChat), given
// the whole content area below the site header, like ChatGPT / Claude / Gemini chat screens.

import { ConciergeChat } from "@/components/voice/ConciergeChat";

export default function ConciergePage() {
  return (
    <div className="h-[calc(100svh-var(--vc-header-h,80px))] min-h-[32rem] bg-white">
      <ConciergeChat variant="page" />
    </div>
  );
}
