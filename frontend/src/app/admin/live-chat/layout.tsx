import type { Metadata } from "next";

// The page is a client component, so its title is set here (WCAG 2.4.2).
export const metadata: Metadata = {
  title: "Live chat | Vista Chase Admin",
  description: "Answer guests who asked the AI concierge for a live agent.",
  robots: { index: false, follow: false },
};

export default function LiveChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
