"use client";

import { Printer } from "lucide-react";

/** Prints the voucher (print styles hide the site chrome and the side actions). */
export function PrintButton({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <Printer className="h-4 w-4" aria-hidden="true" />
      Print voucher
    </button>
  );
}
