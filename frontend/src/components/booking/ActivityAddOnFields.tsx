"use client";

// Activity add-ons at checkout (owner's doc, 2026-11-04): tick boxes for the activities on this
// tour's itinerary. Nothing is charged online; the team confirms the price using the guest numbers
// and ages chosen above (lib/activityAddOns.ts).

import { Ticket } from "lucide-react";
import { ACTIVITY_ADD_ONS, ACTIVITY_ADD_ON_PRICE_NOTE, type ActivityAddOnId } from "@/lib/activityAddOns";

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
