import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Vista Chase Tours Ltd.",
  description: "Learn how Vista Chase collects, protects, and handles customer booking details and personal information.",
  alternates: {
    canonical: "/privacy-policy",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 shadow-card space-y-6 text-slate-800 text-sm leading-relaxed">
        <h1 className="text-3xl font-bold font-display text-forest-950 border-b pb-4">
          Privacy Policy
        </h1>
        <p className="text-xs text-slate-500">Effective Date: October 2026</p>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-forest-900">1. Information We Collect</h2>
          <p>
            When booking a tour or shuttle, Vista Chase collects your name, email address, phone number, and pickup hotel location. This information is exclusively used to coordinate your transportation, issue digital boarding passes, and send operational trip updates.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-forest-900">2. Payment Security &amp; Voice Concierge Safety</h2>
          <p>
            All payment card transactions are processed securely through PCI-DSS Level 1 certified gateways. <strong>Our AI Voice Concierge strictly never collects or records credit card numbers.</strong> All bookings initiated via voice are held as temporary reservations and completed through our secure encrypted web portal.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-forest-900">3. Third-Party Sharing</h2>
          <p>
            We do not sell, rent, or trade your personal information. Information is only shared with authorized Parks Canada dispatch personnel when legally mandated for commercial wilderness access permits.
          </p>
        </section>
      </div>
    </div>
  );
}
