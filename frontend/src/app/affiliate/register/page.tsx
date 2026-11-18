"use client";

import Link from "next/link";
import { ArrowLeft, BadgePercent, CheckCircle2, ShieldCheck } from "lucide-react";
import { PartnerApplyForm } from "@/components/partners/PartnerApplyForm";
import { BrandMark } from "@/components/brand/BrandMark";

export default function AffiliateRegisterPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-page">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <Link href="/affiliate" className="inline-flex items-center gap-2 mb-4">
            <BrandMark size={40} variant="dark" />
          </Link>
          <h1 className="text-3xl font-light text-slate-900">Apply to the Partner Program</h1>
          <p className="mt-2 text-sm text-slate-600">
            Vista Chase Partner Application. For travel agencies, advisors, tour operators, hotels and affiliates: tell us about your business and where to pay your commission.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <PartnerApplyForm />
        </div>

        <div className="mt-6 text-center text-sm text-slate-600">
          Already have an approved partner account?{" "}
          <Link href="/affiliate/login" className="font-medium text-ocean-700 underline underline-offset-2 hover:text-ocean-900">
            Sign in to Affiliate Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
