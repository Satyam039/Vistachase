export interface PickupLocation {
  id: string;
  name: string;
  address: string;
  town: "Banff" | "Canmore" | "Lake Louise" | "Calgary";
  latitude: number;
  longitude: number;
  isHotel: boolean;
  instructions: string;
  shuttleLines: string[];
}

export interface IMapsProvider {
  searchPickups(query: string, town?: string): Promise<PickupLocation[]>;
  getPickupById(id: string): Promise<PickupLocation | null>;
  getAllPickups(): Promise<PickupLocation[]>;
}

export const ROCKIES_PICKUP_LOCATIONS: PickupLocation[] = [
  {
    id: "fairmont-banff-springs",
    name: "Fairmont Banff Springs Hotel",
    address: "405 Spray Ave, Banff, AB T1L 1J4",
    town: "Banff",
    latitude: 51.1648,
    longitude: -115.5619,
    isHotel: true,
    instructions: "Wait outside the Main Motor Court / Conference Entrance 10 minutes prior.",
    shuttleLines: ["Sunrise Moraine Express", "Lake Louise Connector", "Banff Highlights Tour"],
  },
  {
    id: "banff-caribou-lodge",
    name: "Banff Caribou Lodge & Spa",
    address: "552 Banff Ave, Banff, AB T1L 1A9",
    town: "Banff",
    latitude: 51.1894,
    longitude: -115.5658,
    isHotel: true,
    instructions: "Pickup directly at main driveway entrance under the cedar canopy.",
    shuttleLines: ["Sunrise Moraine Express", "Golden Hour Explorer", "Banff Highlights Tour", "Private SUV"],
  },
  {
    id: "moose-hotel-banff",
    name: "Moose Hotel & Suites",
    address: "345 Banff Ave, Banff, AB T1L 1H8",
    town: "Banff",
    latitude: 51.1818,
    longitude: -115.5702,
    isHotel: true,
    instructions: "Front lobby entrance on Banff Ave.",
    shuttleLines: ["Sunrise Moraine Express", "Golden Hour Explorer", "Banff Highlights Tour"],
  },
  {
    id: "rimrock-resort",
    name: "The Rimrock Resort Hotel",
    address: "300 Mountain Ave, Banff, AB T1L 1J2",
    town: "Banff",
    latitude: 51.1492,
    longitude: -115.5583,
    isHotel: true,
    instructions: "Main valet area outside front lobby doors.",
    shuttleLines: ["Sunrise Moraine Express", "Banff Highlights Tour", "Private SUV"],
  },
  {
    id: "banff-train-station",
    name: "Banff Train Station Public Parking Lot",
    address: "327 Railway Ave, Banff, AB T1L 1A1",
    town: "Banff",
    latitude: 51.1798,
    longitude: -115.5786,
    isHotel: false,
    instructions: "Free full-day parking available; shuttle arrives at Bus Bay #3.",
    shuttleLines: ["Sunrise Moraine Express", "Golden Hour Explorer", "Lake Louise Connector"],
  },
  {
    id: "coast-canmore-hotel",
    name: "Coast Canmore Hotel & Conference Centre",
    address: "511 Bow Valley Trail, Canmore, AB T1W 1N7",
    town: "Canmore",
    latitude: 51.0921,
    longitude: -115.3523,
    isHotel: true,
    instructions: "Pickup at the Conference Centre main entrance circle.",
    shuttleLines: ["Sunrise Moraine Express", "Golden Hour Explorer", "Multi-Day Tour"],
  },
  {
    id: "canmore-north-clifton",
    name: "The Malcolm Hotel by CLIQUE",
    address: "321 Spring Creek Dr, Canmore, AB T1W 0K3",
    town: "Canmore",
    latitude: 51.0872,
    longitude: -115.3567,
    isHotel: true,
    instructions: "Porte-cochère directly outside the Malcolm front desk.",
    shuttleLines: ["Sunrise Moraine Express", "Golden Hour Explorer", "Private SUV"],
  },
  {
    id: "lake-louise-inn",
    name: "Lake Louise Inn",
    address: "210 Village Rd, Lake Louise, AB T0L 1E0",
    town: "Lake Louise",
    latitude: 51.4241,
    longitude: -116.1772,
    isHotel: true,
    instructions: "Wait in the main lobby 5 minutes before scheduled departure.",
    shuttleLines: ["Sunrise Moraine Express", "Lake Louise Connector"],
  },
  {
    id: "fairmont-chateau-lake-louise",
    name: "Fairmont Chateau Lake Louise",
    address: "111 Lake Louise Dr, Lake Louise, AB T0L 1E0",
    town: "Lake Louise",
    latitude: 51.4178,
    longitude: -116.2168,
    isHotel: true,
    instructions: "Main entrance turnaround near the Bell Captain desk.",
    shuttleLines: ["Sunrise Moraine Express", "Moraine-Louise Connector", "Private SUV"],
  },
];

class MockMapsProvider implements IMapsProvider {
  async searchPickups(query: string, town?: string): Promise<PickupLocation[]> {
    const q = query.toLowerCase().trim();
    return ROCKIES_PICKUP_LOCATIONS.filter((loc) => {
      const matchTown = town ? loc.town.toLowerCase() === town.toLowerCase() : true;
      const matchQuery =
        !q ||
        loc.name.toLowerCase().includes(q) ||
        loc.address.toLowerCase().includes(q) ||
        loc.town.toLowerCase().includes(q);
      return matchTown && matchQuery;
    });
  }

  async getPickupById(id: string): Promise<PickupLocation | null> {
    return ROCKIES_PICKUP_LOCATIONS.find((loc) => loc.id === id) || null;
  }

  async getAllPickups(): Promise<PickupLocation[]> {
    return ROCKIES_PICKUP_LOCATIONS;
  }
}

let mapsInstance: IMapsProvider | null = null;

export function getMapsProvider(): IMapsProvider {
  if (mapsInstance) return mapsInstance;
  mapsInstance = new MockMapsProvider();
  return mapsInstance;
}
