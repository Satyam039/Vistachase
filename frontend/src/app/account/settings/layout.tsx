import type { Metadata } from "next";

// The page is a client component, so its title and description are set here (WCAG 2.4.2).
export const metadata: Metadata = {
  title: "My Account | Vista Chase",
  description: "Manage your name, email, phone number, password and account.",
  robots: { index: false, follow: false },
};

export default function AccountSettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
