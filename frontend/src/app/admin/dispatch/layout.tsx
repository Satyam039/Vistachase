import type { Metadata } from "next";

// The page is a client component, so its title and description are set here (WCAG 2.4.2).
export const metadata: Metadata = {
  title: "Dispatch Board | Vista Chase Admin",
  description: "Daily dispatch board for Vista Chase operations.",
  robots: { index: false, follow: false },
};

export default function AdminDispatchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
