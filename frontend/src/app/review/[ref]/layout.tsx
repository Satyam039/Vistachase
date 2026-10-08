import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Review Your Trip | Vista Chase",
  description: "Tell us how your day with Vista Chase went.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
