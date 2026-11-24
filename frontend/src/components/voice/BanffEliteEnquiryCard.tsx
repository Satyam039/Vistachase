"use client";

// Banff Elite Personalised Tour Enquiry Card
// Renders inside the AI concierge chat or standalone modal.
// Collects required contact details (name, email, phone with country code)
// and optional planning fields. Guests can submit contact details only.

import { useState } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Sparkles, AlertCircle, Car, Shield } from "lucide-react";
import { PhoneField } from "@/components/forms/PhoneField";
import { dialCode } from "@/lib/countries";

export interface BanffEliteEnquiryData {
  name?: string;
  email?: string;
  phone?: string;
  guests?: number | string;
  travelDates?: string;
  tourDays?: number | string;
  placesOfInterest?: string;
  preferredVehicle?: string;
  paceAndRequests?: string;
}

export function BanffEliteEnquiryCard({
  initialData,
  onSubmitSuccess,
}: {
  initialData?: BanffEliteEnquiryData;
  onSubmitSuccess?: (data: BanffEliteEnquiryData) => void;
}) {
  const [name, setName] = useState(initialData?.name || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [country, setCountry] = useState("CA");
  const [phoneRaw, setPhoneRaw] = useState(initialData?.phone ? initialData.phone.replace(/^\+\d+\s*/, "") : "");
  const [guests, setGuests] = useState(initialData?.guests ? String(initialData.guests) : "");
  const [travelDates, setTravelDates] = useState(initialData?.travelDates || "");
  const [tourDays, setTourDays] = useState(initialData?.tourDays ? String(initialData.tourDays) : "");
  const [placesOfInterest, setPlacesOfInterest] = useState(initialData?.placesOfInterest || "");
  const [preferredVehicle, setPreferredVehicle] = useState(initialData?.preferredVehicle || "help me choose");
  const [paceAndRequests, setPaceAndRequests] = useState(initialData?.paceAndRequests || "");

  const [showOptional, setShowOptional] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const fullPhone = () => {
    const raw = phoneRaw.trim();
    if (!raw) return "";
    if (raw.startsWith("+")) return raw;
    const prefix = dialCode(country);
    return `${prefix} ${raw}`;
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) {
      errs.name = "Please enter your main contact name.";
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Please enter a valid email address.";
    }
    const phone = fullPhone();
    if (!phone || phone.replace(/\D/g, "").length < 7) {
      errs.phone = "Please enter a valid phone number including country code.";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!validate()) return;

    setLoading(true);
    const phone = fullPhone();

    const payload = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      guests: guests.trim() ? parseInt(guests.trim(), 10) || guests.trim() : undefined,
      travelDates: travelDates.trim() || undefined,
      tourDays: tourDays.trim() ? parseInt(tourDays.trim(), 10) || tourDays.trim() : undefined,
      placesOfInterest: placesOfInterest.trim() || undefined,
      preferredVehicle: preferredVehicle || undefined,
      paceAndRequests: paceAndRequests.trim() || undefined,
      idempotencyKey: `be_${email.trim()}_${Date.now()}`,
    };

    try {
      const res = await fetch("/api/enquiries/banff-elite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        const msg = data.message || "Your enquiry has been sent. The Banff Elite team will contact you within 24 hours.";
        setSuccessMsg(msg);
        onSubmitSuccess?.(payload);
      } else {
        const msg = data?.error || "Your enquiry couldn’t be sent. Please try again or email support@banffelite.com.";
        setErrorMsg(msg);
      }
    } catch (err) {
      console.error("[BanffEliteEnquiry] Request failed:", err);
      setErrorMsg("Your enquiry couldn’t be sent. Please try again or email support@banffelite.com.");
    } finally {
      setLoading(false);
    }
  };

  if (successMsg) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-obsidian-900 shadow-sm" aria-live="polite">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-950">Enquiry Sent</p>
            <p className="mt-1 text-sm leading-relaxed text-emerald-900">{successMsg}</p>
            <p className="mt-3 text-xs text-emerald-800/80">
              A copy has been forwarded to support@banffelite.com and support@vistachase.com.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-obsidian-900/10 bg-white p-5 text-obsidian-900 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-summit-100 text-summit-800">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <h4 className="text-base font-medium text-obsidian-950">Banff Elite Personalised Tour Enquiry</h4>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">
        Banff Elite is Vista Chase’s sister company for personalised tour itineraries. Choose a luxury SUV or luxury van, with options priced according to your vehicle and tour requirements.
      </p>
      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-obsidian-50 px-3 py-1.5 text-xs text-slate-700">
        <Shield className="h-3.5 w-3.5 text-ocean-600 shrink-0" aria-hidden="true" />
        <span>Tours only; hotels and restaurants are not arranged.</span>
      </div>

      {errorMsg && (
        <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
          <p>{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3.5" noValidate>
        {/* Required: Name */}
        <div>
          <label htmlFor="be-name" className="block text-xs font-medium text-obsidian-900">
            Main contact name <span className="text-rose-600">*</span>
          </label>
          <input
            id="be-name"
            type="text"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) setFieldErrors((f) => ({ ...f, name: "" }));
            }}
            placeholder="e.g. John Smith"
            className={`mt-1 block h-9 w-full rounded-lg border bg-white px-3 text-xs text-obsidian-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-summit-500 ${
              fieldErrors.name ? "border-rose-400" : "border-slate-300"
            }`}
          />
          {fieldErrors.name && <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.name}</p>}
        </div>

        {/* Required: Email */}
        <div>
          <label htmlFor="be-email" className="block text-xs font-medium text-obsidian-900">
            Email address <span className="text-rose-600">*</span>
          </label>
          <input
            id="be-email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: "" }));
            }}
            placeholder="e.g. john@example.com"
            className={`mt-1 block h-9 w-full rounded-lg border bg-white px-3 text-xs text-obsidian-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-summit-500 ${
              fieldErrors.email ? "border-rose-400" : "border-slate-300"
            }`}
          />
          {fieldErrors.email && <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.email}</p>}
        </div>

        {/* Required: Phone with Country Code */}
        <div>
          <PhoneField
            label="Phone number (with country code)"
            country={country}
            onCountryChange={setCountry}
            value={phoneRaw}
            onChange={(val) => {
              setPhoneRaw(val);
              if (fieldErrors.phone) setFieldErrors((f) => ({ ...f, phone: "" }));
            }}
            error={fieldErrors.phone}
            heightClass="h-9"
          />
          <p className="mt-1 text-[11px] text-slate-500">Includes country code for consultation call / WhatsApp.</p>
        </div>

        {/* Optional Toggle */}
        <div className="border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowOptional(!showOptional)}
            className="flex w-full items-center justify-between text-left text-xs font-medium text-ocean-700 hover:text-ocean-900 transition-colors"
            aria-expanded={showOptional}
          >
            <span>Optional trip planning details</span>
            {showOptional ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
          </button>
          <p className="mt-0.5 text-[11px] text-slate-500">
            You can submit contact details only without completing the planning questions.
          </p>

          {showOptional && (
            <div className="mt-3 space-y-3 rounded-xl bg-obsidian-50/70 p-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="be-guests" className="block text-[11px] font-medium text-obsidian-900">
                    Number of guests
                  </label>
                  <input
                    id="be-guests"
                    type="number"
                    min="1"
                    max="50"
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                    placeholder="e.g. 4"
                    className="mt-1 block h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-obsidian-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-summit-500"
                  />
                </div>
                <div>
                  <label htmlFor="be-days" className="block text-[11px] font-medium text-obsidian-900">
                    Tour days
                  </label>
                  <input
                    id="be-days"
                    type="number"
                    min="1"
                    max="30"
                    value={tourDays}
                    onChange={(e) => setTourDays(e.target.value)}
                    placeholder="e.g. 3"
                    className="mt-1 block h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-obsidian-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-summit-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="be-dates" className="block text-[11px] font-medium text-obsidian-900">
                  Travel dates or timeframe
                </label>
                <input
                  id="be-dates"
                  type="text"
                  value={travelDates}
                  onChange={(e) => setTravelDates(e.target.value)}
                  placeholder="e.g. July 10–14, 2027 or mid-summer"
                  className="mt-1 block h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-obsidian-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-summit-500"
                />
              </div>

              <div>
                <span className="block text-[11px] font-medium text-obsidian-900">Preferred vehicle</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(["luxury SUV", "luxury van", "help me choose"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPreferredVehicle(v)}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] transition-all ${
                        preferredVehicle === v
                          ? "bg-obsidian-900 text-white font-medium shadow-sm"
                          : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <Car className="h-3 w-3" aria-hidden="true" />
                      <span>{v}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  Vehicle options have different prices; quote provided after consultation.
                </p>
              </div>

              <div>
                <label htmlFor="be-places" className="block text-[11px] font-medium text-obsidian-900">
                  Places and experiences of interest
                </label>
                <textarea
                  id="be-places"
                  rows={2}
                  value={placesOfInterest}
                  onChange={(e) => setPlacesOfInterest(e.target.value)}
                  placeholder="e.g. Moraine Lake sunrise, helicopter tour, photography stops..."
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-obsidian-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-summit-500"
                />
              </div>

              <div>
                <label htmlFor="be-requests" className="block text-[11px] font-medium text-obsidian-900">
                  Preferred pace and additional requests
                </label>
                <textarea
                  id="be-requests"
                  rows={2}
                  value={paceAndRequests}
                  onChange={(e) => setPaceAndRequests(e.target.value)}
                  placeholder="e.g. relaxed pace with kids, mobility assistance..."
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-obsidian-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-summit-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="golden-summit-btn inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-5 text-xs uppercase tracking-[0.12em] font-medium disabled:opacity-50"
          >
            {loading ? (
              <span>Sending enquiry…</span>
            ) : (
              <>
                <span>Submit Enquiry</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
