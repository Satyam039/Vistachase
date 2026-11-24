"use client";

// Full-screen AI concierge: the same conversation as the floating panel (ConciergeChat), given
// the whole content area below the site header, like ChatGPT / Claude / Gemini chat screens.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ConciergeChat } from "@/components/voice/ConciergeChat";

function ConciergePageContent() {
  const searchParams = useSearchParams();
  const enquiry = searchParams.get("enquiry");
  const prompt = searchParams.get("prompt");

  let initialPrompt: string | undefined = prompt || undefined;
  if (enquiry === "banff-elite") {
    initialPrompt = "I would like to request a personalised tour enquiry with Banff Elite.";
  }

  return <ConciergeChat variant="page" initialPrompt={initialPrompt} />;
}

export default function ConciergePage() {
  return (
    <div className="h-full min-h-0 w-full flex-1 flex flex-col bg-white overflow-hidden">
      <Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-obsidian-500">Loading concierge…</div>}>
        <ConciergePageContent />
      </Suspense>
    </div>
  );
}
