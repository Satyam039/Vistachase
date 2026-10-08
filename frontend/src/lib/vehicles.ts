// The vehicle a tour runs in, for the product page's Pickup section. Built only from what the
// tour itself says (category, vehicle options, inclusions, exclusions) and the fleet described on
// the About page: the executive van is a Mercedes-Benz Sprinter (shared tours, shuttles, larger
// private groups); private groups of up to 6 can take a luxury SUV. Photos are from the Vista
// Chase photo library (backend/media). Tickets have no vehicle: guests meet at the attraction.

import type { TourWithAvailability } from "@/lib/api/types";

export interface VehiclePhoto {
  src: string;
  alt: string;
}

export interface VehicleInfo {
  name: string;
  model?: string;
  seats?: number;
  notes: string[];
  photos: VehiclePhoto[];
  /** Shown under the photo when it is an example rather than the exact vehicle. */
  caption?: string;
}

const VAN_PHOTOS: VehiclePhoto[] = [
  { src: "/media/photos/vista-chase-sprinter-canmore.webp", alt: "Vista Chase branded Mercedes Sprinter van in Canmore below the Three Sisters" },
  { src: "/media/photos/sprinter-cabin-leather-seats.webp", alt: "Leather passenger seats inside a Mercedes Sprinter" },
];
const SUV_PHOTOS: VehiclePhoto[] = [{ src: "/media/photos/cadillac-escalade-mountains.webp", alt: "Black Cadillac Escalade on a mountain road at dusk" }];

const mentions = (items: string[], re: RegExp) => items.some((i) => re.test(i));

export function vehiclesFor(tour: TourWithAvailability): VehicleInfo[] {
  if (tour.category === "TICKET") return [];
  const heated = mentions(tour.inclusions, /heated/i);
  const winterTires = mentions(tour.inclusions, /winter tires/i);

  if (tour.vehicleOptions.length > 0) {
    const escalade = mentions(tour.exclusions, /escalade/i);
    return tour.vehicleOptions.map((option) => {
      const isSuv = /suv/i.test(option.label);
      const notes = ["Private: your group only, with your own guide-driver"];
      if (isSuv && heated) notes.push(winterTires ? "Heated, with winter tires" : "Heated");
      if (isSuv && escalade) notes.push("Cadillac Escalade upgrade available on request");
      return isSuv
        ? { name: option.label, seats: option.seats, notes, photos: SUV_PHOTOS, caption: "Pictured: a Cadillac Escalade from our fleet; SUV models vary." }
        : { name: option.label, model: "Mercedes-Benz Sprinter", seats: option.seats, notes, photos: VAN_PHOTOS };
    });
  }

  const notes: string[] = [];
  if (tour.category === "SHARED") notes.push(`Small group: no more than ${tour.maxGroupSize} guests`);
  if (mentions(tour.inclusions, /suv/i)) notes.push("Smaller departures may travel in an SUV");
  if (heated) notes.push("Heated for winter");
  return [{ name: "Executive van", model: "Mercedes-Benz Sprinter", notes, photos: VAN_PHOTOS }];
}
