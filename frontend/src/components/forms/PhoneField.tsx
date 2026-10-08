"use client";

// Phone number with its country first: a flag + calling-code selector (native <select>, so phones
// get their own picker and typing a country name jumps to it) beside the number field. The two
// share one label; the parent gets the country code and the local number separately and joins
// them as "+44 7700 900123". Sized and laid out like the Astryx TextInput beside it.

import { useId, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { dialCode, phoneCountries } from "@/lib/countries";

export function PhoneField({
  label,
  description,
  country,
  onCountryChange,
  value,
  onChange,
  error,
}: {
  label: string;
  description?: string;
  country: string;
  onCountryChange: (code: string) => void;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const id = useId();
  const { top, rest } = useMemo(() => phoneCountries(), []);
  const flag = [...top, ...rest].find((c) => c.code === country)?.flag ?? "";
  const describedBy = [description && `${id}-desc`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={`${id}-number`} className="text-sm text-obsidian-900">
        {label}
      </label>
      {description && (
        <p id={`${id}-desc`} className="text-sm text-slate-600">
          {description}
        </p>
      )}
      <div
        className={`flex h-8 items-stretch overflow-hidden rounded-lg border bg-white focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-ocean-600 ${
          error ? "border-red-600" : "border-[rgb(131_131_138)]"
        }`}
      >
        <div className="relative flex shrink-0 items-center border-r border-obsidian-900/10 bg-obsidian-50">
          {/* What the closed select shows: flag and code. The select itself sits on top, invisible. */}
          <span className="pointer-events-none flex items-center gap-1.5 pl-3 pr-7 text-base text-obsidian-900" aria-hidden="true">
            <span className="text-lg leading-none">{flag}</span>+{dialCode(country)}
          </span>
          <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-slate-500" aria-hidden="true" />
          <select
            aria-label="Country calling code"
            value={country}
            onChange={(e) => onCountryChange(e.target.value)}
            autoComplete="tel-country-code"
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {top.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name} (+{c.dial})
              </option>
            ))}
            <option disabled>──────────</option>
            {rest.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name} (+{c.dial})
              </option>
            ))}
          </select>
        </div>
        <input
          id={`${id}-number`}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Mobile number"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="w-0 min-w-0 flex-1 bg-transparent px-3 text-base text-obsidian-900 outline-none placeholder:text-slate-400"
        />
      </div>
      {error && (
        <p id={`${id}-err`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
