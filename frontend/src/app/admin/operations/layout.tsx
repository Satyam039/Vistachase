import type { Metadata } from "next";

// The page is a client component, so its title and description are set here (WCAG 2.4.2).
export const metadata: Metadata = {
  title: "Operations | Vista Chase Admin",
  description: "Vista Chase daily operations runs.",
  robots: { index: false, follow: false },
};

export default function AdminOperationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
