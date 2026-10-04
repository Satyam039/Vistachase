import type { Metadata } from "next";

// The page is a client component, so its title and description are set here (WCAG 2.4.2).
export const metadata: Metadata = {
  title: "Create an Account | Vista Chase",
  description: "Create a Vista Chase account to manage your bookings.",
  robots: { index: false, follow: false },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
