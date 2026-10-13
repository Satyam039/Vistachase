import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Departures | Vista Chase Admin",
  robots: { index: false, follow: false },
};

export default function AdminDeparturesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
