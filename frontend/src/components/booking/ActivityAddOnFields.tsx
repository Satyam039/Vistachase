"use client";

// Activity add-ons at checkout (owner's doc, 2026-11-04): tick boxes for the activities on this
// tour's itinerary. Nothing is charged online; the team confirms the price using the guest numbers
// and ages chosen above (lib/activityAddOns.ts).

import { Ticket } from "lucide-react";
import { QuantityInput } from "@/components/forms/QuantityInput";
import {
  ACTIVITY_ADD_ONS,
  ACTIVITY_ADD_ON_PRICE_NOTE,
  ACTIVITY_ADD_ONS_NOTE,
  ACTIVITY_AGE_BANDS,
  type ActivityAddOnId,
  type ActivityGuests,
} from "@/lib/activityAddOns";

/**
 * "Add-on activities" tick box for private tours (owner, 2026-11-09), styled like the airport transfer
 * one. Once ticked, the guest says who joins the activities: adults, children and infants, each with
 * its age range (owner, 2026-11-11), so the team can price the tickets.
 */
export function ActivityAddOnToggle({
  checked,
  onChange,
  guests,
  onGuestsChange,
  maxGuests = 13,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Who joins the activities; the age pickers show only when this is given. */
  guests?: ActivityGuests;
  onGuestsChange?: (guests: ActivityGuests) => void;
  /** The party size: the three counts together can't be more. */
  maxGuests?: number;
}) {
  const showGuests = checked && guests && onGuestsChange;
  const used = guests ? guests.adults + guests.children + guests.infants : 0;
  const set = (key: keyof ActivityGuests) => (value: number) => guests && onGuestsChange?.({ ...guests, [key]: value });
  return (
    <div className={`rounded-2xl border bg-white text-sm ${checked ? "border-ocean-500 ring-1 ring-ocean-500" : "border-slate-200"}`}>
      <label className="flex cursor-pointer items-start gap-3 p-4">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-ocean-700" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-medium text-obsidian-900">
            <Ticket className="h-4 w-4 text-ocean-700" aria-hidden="true" />
            Add-on activities
          </span>
          <span className="mt-0.5 block text-xs text-slate-600">{ACTIVITY_ADD_ONS_NOTE}</span>
        </span>
      </label>
      {showGuests && (
        <fieldset className="space-y-3 border-t border-slate-200 px-4 pb-4 pt-3">
          <legend className="sr-only">Who joins the activities</legend>
          <p className="text-xs text-slate-600" aria-hidden="true">
            Who joins the activities?
          </p>
          {ACTIVITY_AGE_BANDS.map((band) => (
            <QuantityInput
              key={band.key}
              label={band.label}
              description={band.ages}
              value={guests[band.key]}
              onChange={set(band.key)}
              min={0}
              max={Math.max(guests[band.key], guests[band.key] + maxGuests - used)}
            />
          ))}
          {used === 0 && (
            <p role="alert" className="text-xs text-red-700">
              Add at least one guest for the activities.
            </p>
          )}
        </fieldset>
      )}
    </div>
  );
}

export function ActivityAddOnFields({
  offered,
  value,
  onChange,
}: {
  offered: ActivityAddOnId[];
  value: ActivityAddOnId[];
  onChange: (value: ActivityAddOnId[]) => void;
}) {
  if (offered.length === 0) return null;
  const toggle = (id: ActivityAddOnId, on: boolean) => onChange(on ? [...value.filter((v) => v !== id), id] : value.filter((v) => v !== id));
  return (
    <fieldset className="space-y-2">
      <legend className="flex items-center gap-1.5 text-sm font-medium text-obsidian-900">
        <Ticket className="h-4 w-4 text-ocean-700" aria-hidden="true" />
        Activity add-ons
      </legend>
      <p className="text-xs text-slate-600">
        {ACTIVITY_ADD_ON_PRICE_NOTE}, based on the guests and ages above. Nothing extra is charged now.
      </p>
      {offered.map((id) => {
        const checked = value.includes(id);
        return (
          <label
            key={id}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl border bg-white p-4 text-sm ${checked ? "border-ocean-500 ring-1 ring-ocean-500" : "border-slate-200"}`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 accent-ocean-700"
              checked={checked}
              onChange={(e) => toggle(id, e.target.checked)}
            />
            <span className="font-medium text-obsidian-900">Add {ACTIVITY_ADD_ONS[id]}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
