import { describe, expect, it } from "vitest";
import { activityAddOnsError, activityAddOnsFor, activityAddOnsNote } from "@/modules/bookings/activity-add-ons";

// Owner's doc (2026-11-04): add-ons only with the tours whose itinerary has the activity, summer only.
describe("activity add-ons", () => {
  it("offers each tour only the activities on its itinerary, in summer", () => {
    expect(activityAddOnsFor("banff-highlights-tour", "2027-07-01")).toEqual(["lake-minnewanka-cruise"]);
    expect(activityAddOnsFor("icefields-jasper-private-tour", "2027-07-01")).toEqual(["columbia-icefield-skywalk", "ice-explorer"]);
    expect(activityAddOnsFor("shared-tours-icefields-jasper", "2027-07-01")).toEqual([]);
    expect(activityAddOnsFor("banff-highlights-tour", "2027-01-15")).toEqual([]);
  });

  it("refuses add-ons the departure doesn't offer", () => {
    expect(activityAddOnsError(["lake-minnewanka-cruise"], "banff-highlights-tour", "2027-07-01")).toBeNull();
    expect(activityAddOnsError(["maligne-lake-cruise"], "banff-highlights-tour", "2027-07-01")).toMatch(/Maligne Lake Cruise/);
    expect(activityAddOnsError(["lake-minnewanka-cruise"], "banff-highlights-tour", "2027-12-01")).toMatch(/can't be added/);
  });

  it("tells staff what was asked for and who is coming", () => {
    expect(activityAddOnsNote(["lake-minnewanka-cruise"], { adults: 2, children: 1, infants: 1 })).toBe(
      "Activity add-ons requested: Lake Minnewanka Cruise for 2 adults (16–99), 1 youth (6–15), 1 infant (0–5) (price varies, to be confirmed by Vista Chase).",
    );
  });
});
