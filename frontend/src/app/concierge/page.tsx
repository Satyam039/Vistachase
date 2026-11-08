"use client";

// Full-screen AI concierge: the same conversation as the floating panel (ConciergeChat), given
// the whole content area below the site header, like ChatGPT / Claude / Gemini chat screens.

import { ConciergeChat } from "@/components/voice/ConciergeChat";

export default function ConciergePage() {
  return (
    <div className="h-full min-h-0 w-full flex-1 flex flex-col bg-white overflow-hidden">
      <ConciergeChat variant="page" />
    </div>
  );
}
