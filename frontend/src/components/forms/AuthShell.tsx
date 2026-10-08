// Shared layout for sign-in and sign-up (Airbnb / Booking.com style): a brand photo panel with
// what an account gives you, beside the form. On phones the photo becomes a short banner.

import Image from "next/image";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

const PERKS = ["All your bookings and vouchers in one place", "Pickup times as soon as they're set", "Free cancellation up to 72 hours before", "Review your guide after the tour"];

export function AuthShell({
  title,
  intro,
  children,
  footer,
  panelTitle = "Your Rockies trip, in one place.",
  perks = PERKS,
  guestLink = true,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  panelTitle?: string;
  perks?: string[];
  guestLink?: boolean;
}) {
  return (
    <div className="grid min-h-[calc(100svh-var(--vc-header-h,80px))] bg-obsidian-50 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Brand panel */}
      <aside className="relative isolate flex min-h-[14rem] flex-col justify-end overflow-hidden bg-ocean-950 p-8 text-white sm:p-12">
        <Image src="/media/photos/moraine-lake-rockpile-couple.webp" alt="" fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="-z-10 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ocean-950 via-ocean-950/40 to-ocean-950/70" />
        <Image src="/media/brand/logo-white.png" alt="" width={140} height={63} className="mb-auto h-14 w-auto" />
        <div className="hidden lg:block">
          <p className="text-3xl font-light leading-tight text-white">{panelTitle}</p>
          <ul className="mt-6 space-y-3">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-base text-white/85">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-summit-400" aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form */}
      <div className="flex items-center justify-center px-page py-12 sm:py-16">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl">{title}</h1>
          <p className="mt-2 text-base text-slate-600">{intro}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-8 border-t border-obsidian-900/[0.08] pt-6 text-sm text-slate-600">{footer}</div>
          {guestLink && (
          <p className="mt-4 text-sm text-slate-600">
            Booked as a guest?{" "}
            <Link href="/account/trips" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-900">
              Find your booking with its reference
            </Link>
            .
          </p>
          )}
        </div>
      </div>
    </div>
  );
}

export const AUTH_FIELD =
  "h-12 w-full rounded-xl border border-obsidian-900/10 bg-white px-4 text-base text-obsidian-900 placeholder:text-slate-400 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/30";
