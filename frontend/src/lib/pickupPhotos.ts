// Photos for pickup points, all from backend/media and checked by eye. Only two hotels have a
// photo of the building itself; every other stop shows its town and is labelled as an area photo
// so a guest never mistakes a street scene for their hotel.

export interface PickupPhoto {
  src: string;
  alt: string;
  /** "hotel": the pickup point itself. "area": the town the stop is in. */
  kind: "hotel" | "area";
  /** Short label shown on area photos. */
  place: string;
}

const HOTELS: [RegExp, PickupPhoto][] = [
  [/banff springs/i, { src: "/media/photos/fairmont-banff-springs.webp", alt: "The Fairmont Banff Springs Hotel above the Bow Valley in winter", kind: "hotel", place: "Fairmont Banff Springs" }],
  [/chateau lake louise/i, { src: "/media/photos/lake-louise-chateau-view.webp", alt: "The Fairmont Chateau Lake Louise across the turquoise lake", kind: "hotel", place: "Fairmont Chateau Lake Louise" }],
];

// Several real photos per town, used in turn so neighbouring cards don't repeat one image.
const TOWNS: Record<string, PickupPhoto[]> = {
  Banff: [
    { src: "/media/site/tour-image.webp", alt: "Banff Avenue at dusk below Cascade Mountain", kind: "area", place: "Banff Avenue" },
    { src: "/media/site/photo-e87732b97ba2.webp", alt: "Banff townsite lit up at dusk below Cascade Mountain", kind: "area", place: "Banff townsite" },
    { src: "/media/photos/vermilion-lakes-mount-rundle.webp", alt: "Vermilion Lakes below Mount Rundle on the edge of Banff", kind: "area", place: "Vermilion Lakes, Banff" },
  ],
  Canmore: [
    { src: "/media/photos/three-sisters-canmore.webp", alt: "The Three Sisters peaks above Canmore", kind: "area", place: "Three Sisters, Canmore" },
    { src: "/media/site/three-sisters-canmore.webp", alt: "The Three Sisters reflected in the Bow River at Canmore in winter", kind: "area", place: "Bow River, Canmore" },
  ],
  "Lake Louise": [{ src: "/media/videos/lake-louise-summer-poster.webp", alt: "The lakeshore path at Lake Louise", kind: "area", place: "Lake Louise" }],
};

/** `turn`: the stop's position among its town's stops (in the full list), so photos alternate. */
export function pickupPhoto(name: string, town: string, turn = 0): PickupPhoto | null {
  const hotel = HOTELS.find(([re]) => re.test(name))?.[1];
  if (hotel) return hotel;
  const list = TOWNS[town];
  return list ? list[turn % list.length] : null;
}
