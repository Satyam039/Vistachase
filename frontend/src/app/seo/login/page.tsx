import type { Metadata } from "next";
import { Suspense } from "react";
import { SeoLogin } from "@/components/seo-portal/SeoLogin";

export const metadata: Metadata = { title: "Sign in" };

export default function SeoLoginPage() {
  return (
    <Suspense>
      <SeoLogin />
    </Suspense>
  );
}
