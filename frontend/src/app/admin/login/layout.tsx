import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Portal Sign In | Vista Chase",
  description: "Secure sign-in for Vista Chase administrators, operators and dispatchers.",
  robots: { index: false, follow: false },
};

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
