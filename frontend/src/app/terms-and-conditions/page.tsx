import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions | Vista Chase Tours Ltd.",
  description: "Terms and conditions of service, booking policies, and passenger guidelines for Vista Chase Canadian Rockies tours.",
  alternates: {
    canonical: "/terms-and-conditions",
  },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 shadow-card space-y-6 text-slate-800 text-sm leading-relaxed">
        <h1 className="text-3xl font-bold font-display text-forest-950 border-b pb-4">
          Terms &amp; Conditions
        </h1>
        <p className="text-xs text-slate-500">Last updated: October 2026</p>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-forest-900">1. Booking &amp; Payment Confirmation</h2>
          <p>
            All bookings with Vista Chase Tours Ltd. require full payment or an authorized reservation hold. Upon confirmation, a unique booking reference and digital boarding voucher will be issued. Passengers must present their digital voucher or reference number upon boarding.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-forest-900">2. Cancellation &amp; Refund Policy</h2>
          <p>
            Cancellations made 48 hours or more before scheduled departure will receive a 100% full refund. Cancellations made within 48 hours are non-refundable. For private SUV charters, 72 hours advance notice is required for a full refund.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-forest-900">3. Punctuality &amp; Hotel Pickups</h2>
          <p>
            Passengers are required to be present at their assigned hotel pickup location 10 minutes prior to scheduled departure. To adhere to strict Parks Canada commercial entry schedules, shuttle vehicles cannot wait past departure time.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-forest-900">4. Parks Canada Pass Requirement</h2>
          <p>
            All individuals entering Banff, Jasper, or Yoho National Parks are legally required to hold a valid Parks Canada Pass. Park passes are not included in base tour fares unless explicitly purchased as an add-on.
          </p>
        </section>
      </div>
    </div>
  );
}
