"use client";

// Activity add-ons at checkout (owner's doc, 2026-11-04): tick boxes for the activities on this
// tour's itinerary. Nothing is charged online; the team confirms the price using the guest numbers
// and ages chosen above (lib/activityAddOns.ts).

import { Ticket } from "lucide-react";
import { QuantityInput } from "@/components/forms/QuantityInput";
import { ActivityInfo } from "@/components/booking/ActivityInfo";
import {
  ACTIVITY_ADD_ONS,
  ACTIVITY_ADD_ON_PRICE_NOTE,
  ACTIVITY_ADD_ONS_NOTE,
  ACTIVITY_AGE_BANDS,
  COMBINED_ADD_ON,
  activityGuestCount,
  packageActivityPrice,
  type ActivityAddOnId,
  type ActivityGuests,
  type PackageActivity,
  type PackageActivityChoice,
  type PackageActivityPrices,
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
  label = "Add-on activities",
  note = ACTIVITY_ADD_ONS_NOTE,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Who joins the activities; the age pickers show only when this is given. */
  guests?: ActivityGuests;
  onGuestsChange?: (guests: ActivityGuests) => void;
  /** The party size: the three counts together can't be more. */
  maxGuests?: number;
  label?: string;
  note?: string;
  /** Shown under the note once ticked, in place of the guest pickers (the package activity list). */
  children?: React.ReactNode;
}) {
  const showGuests = checked && guests && onGuestsChange;
  const used = guests ? guests.adults + guests.children + guests.infants : 0;
  // The party is full (everyone starts as an adult): adding a child or infant moves one guest out of
  // the adults, so the + buttons keep working (owner, 2026-11-11: "add nhi ho pa rha").
  const set = (key: keyof ActivityGuests) => (value: number) => {
    if (!guests || !onGuestsChange) return;
    const next = { ...guests, [key]: value };
    const over = next.adults + next.children + next.infants - maxGuests;
    if (over > 0 && key !== "adults") next.adults = Math.max(0, next.adults - over);
    onGuestsChange(next);
  };
  const maxFor = (key: keyof ActivityGuests) =>
    key === "adults"
      ? Math.max(guests![key], guests![key] + maxGuests - used)
      : Math.max(guests![key], guests![key] + maxGuests - used + guests!.adults);
  return (
    <div className={`rounded-2xl border bg-white text-sm ${checked ? "border-ocean-500 ring-1 ring-ocean-500" : "border-slate-200"}`}>
      <label className="flex cursor-pointer items-start gap-3 p-4">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-ocean-700" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-medium text-obsidian-900">
            <Ticket className="h-4 w-4 text-ocean-700" aria-hidden="true" />
            {label}
          </span>
          <span className="mt-0.5 block text-xs text-slate-600">{note}</span>
        </span>
      </label>
      {checked && children && <div className="border-t border-slate-200 px-4 pb-4 pt-3">{children}</div>}
      {showGuests && !children && (
        <fieldset className="space-y-3 border-t border-slate-200 px-4 pb-4 pt-3">
          <legend className="sr-only">Who joins the activities</legend>
          <p className="text-xs text-slate-600" aria-hidden="true">
            Who joins the activities? Up to {maxGuests} {maxGuests === 1 ? "guest" : "guests"}, your party size.
          </p>
          {ACTIVITY_AGE_BANDS.map((band) => (
            <QuantityInput
              key={band.key}
              label={band.label}
              description={band.ages}
              value={guests[band.key]}
              onChange={set(band.key)}
              min={0}
              max={maxFor(band.key)}
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

/**
 * Private Columbia Icefield Adventure (owner, 2026-11-24): Ice Explorer + Skywalk as one combined
 * optional experience. The guest says how many in the group join (1 to the group size); it can't be
 * requested on winter dates; it is recorded for staff as a ticket request, invoiced separately.
 */
export function CombinedAddOnControl({
  checked,
  onChange,
  participants,
  onParticipantsChange,
  maxGuests,
  available,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  participants: number;
  onParticipantsChange: (n: number) => void;
  /** The group size: participants can't be more. */
  maxGuests: number;
  /** False on winter dates (October 11 – May 31), or before a summer date is chosen. */
  available: boolean;
}) {
  const on = checked && available;
  const count = Math.max(1, Math.min(participants, maxGuests));
  return (
    <div
      className={`rounded-2xl border bg-white text-sm ${on ? "border-ocean-500 ring-1 ring-ocean-500" : "border-slate-200"} ${available ? "" : "bg-slate-50"}`}
      data-testid="combined-add-on"
    >
      <label className={`flex items-start gap-3 p-4 ${available ? "cursor-pointer" : "cursor-not-allowed"}`}>
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-ocean-700"
          checked={on}
          disabled={!available}
          aria-describedby="combined-add-on-note"
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-medium text-obsidian-900">
            <Ticket className="h-4 w-4 shrink-0 text-ocean-700" aria-hidden="true" />
            {COMBINED_ADD_ON.title}
          </span>
          <span id="combined-add-on-note" className="mt-0.5 block text-xs text-slate-600">
            {available ? COMBINED_ADD_ON.body : COMBINED_ADD_ON.winter}
          </span>
        </span>
      </label>
      {on && (
        <div className="space-y-2 border-t border-slate-200 px-4 pb-4 pt-3">
          <QuantityInput
            label="Participating guests"
            description={`Up to ${maxGuests} ${maxGuests === 1 ? "guest" : "guests"}, your group size`}
            value={count}
            onChange={onParticipantsChange}
            min={1}
            max={maxGuests}
          />
          <p className="rounded-xl bg-summit-100 px-3 py-2 text-xs text-obsidian-900 ring-1 ring-summit-300">
            <span className="font-medium">Ticket request</span> · {COMBINED_ADD_ON.request}
          </p>
        </div>
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

/** Adults, children and infants for one activity, within the party size (same rule as the toggle above). */
function GuestBands({ guests, onChange, maxGuests, idPrefix }: { guests: ActivityGuests; onChange: (g: ActivityGuests) => void; maxGuests: number; idPrefix: string }) {
  const used = activityGuestCount(guests);
  const set = (key: keyof ActivityGuests) => (value: number) => {
    const next = { ...guests, [key]: value };
    const over = activityGuestCount(next) - maxGuests;
    if (over > 0 && key !== "adults") next.adults = Math.max(0, next.adults - over);
    onChange(next);
  };
  const maxFor = (key: keyof ActivityGuests) =>
    key === "adults" ? Math.max(guests[key], guests[key] + maxGuests - used) : Math.max(guests[key], guests[key] + maxGuests - used + guests.adults);
  return (
    <div className="grid gap-3 sm:grid-cols-3" id={`${idPrefix}-guests`}>
      {ACTIVITY_AGE_BANDS.map((band) => (
        <QuantityInput key={band.key} label={band.label} description={band.ages} value={guests[band.key]} onChange={set(band.key)} min={0} max={maxFor(band.key)} />
      ))}
    </div>
  );
}

/**
 * The private journeys' optional activities (owner, 2026-11-18): a tick box for each activity the
 * journey offers, and once ticked, how many adults, children and infants join it.
 */
const priceLine = (dollars: number | null) =>
  dollars != null
    ? `CAD $${dollars.toLocaleString("en-CA", { minimumFractionDigits: dollars % 1 ? 2 : 0 })}, added to your total`
    : "Price confirmed by our team before your trip (not charged now)";

export function PackageActivityPicker({
  activities,
  value,
  onChange,
  partySize,
  prices,
}: {
  activities: PackageActivity[];
  value: PackageActivityChoice;
  onChange: (value: PackageActivityChoice) => void;
  /** The party size: no activity can have more guests. */
  partySize: number;
  /** The server's per-person prices; an activity without one is priced by our team. */
  prices: PackageActivityPrices | null;
}) {
  if (activities.length === 0) return null;
  const toggle = (id: string, on: boolean) => {
    const next = { ...value };
    if (on) next[id] = { adults: Math.max(1, partySize), children: 0, infants: 0 };
    else delete next[id];
    onChange(next);
  };
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-obsidian-900">Choose your activities</legend>
      <p className="text-xs text-slate-600">Tick each activity you&apos;d like, then tell us how many people join it. Up to {partySize} {partySize === 1 ? "guest" : "guests"}, your party size.</p>
      {activities.map((a) => {
        const guests = value[a.id];
        return (
          <div key={a.id} className={`rounded-xl border ${guests ? "border-ocean-500 ring-1 ring-ocean-500" : "border-slate-200"}`}>
            <div className="flex items-start gap-1 pr-2">
              <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-start gap-3 p-3">
                <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-ocean-700" checked={Boolean(guests)} onChange={(e) => toggle(a.id, e.target.checked)} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-obsidian-900">{a.name}</span>
                  <span className="block text-xs text-slate-600">{a.detail}</span>
                </span>
              </label>
              <span className="pt-2">
                <ActivityInfo activity={a} />
              </span>
            </div>
            {guests && (
              <div className="space-y-2 border-t border-slate-200 px-3 pb-3 pt-2">
                <p className="text-xs text-slate-600">Who joins the {a.name}?</p>
                <GuestBands guests={guests} onChange={(g) => onChange({ ...value, [a.id]: g })} maxGuests={partySize} idPrefix={`activity-${a.id}`} />
                <p className="text-xs text-obsidian-900">{priceLine(packageActivityPrice(prices, a.id, guests))}</p>
                {activityGuestCount(guests) === 0 && (
                  <p role="alert" className="text-xs text-red-700">
                    Add at least one guest for this activity, or untick it.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
