// Response shapes returned by the Vista Chase backend API (backend/src/routes)

export interface DepartureAvailability {
  id: string;
  date: string;
  departureTime: string;
  returnTime: string | null;
  capacityTotal: number;
  capacityBooked: number;
  capacityHeld: number;
  seatsAvailable: number;
  price: number;
  currency: string;
  status: string;
}

export interface TourWithAvailability {
  id: string;
  slug: string;
  title: string;
  category: string;
  durationHours: number;
  summary: string;
  description: string;
  inclusions: string[];
  exclusions: string[];
  highlights: string[];
  whatToBring: string[];
  featuredImage: string;
  galleryImages: string[];
  basePrice: number;
  currency: string;
  minGroupSize: number;
  maxGroupSize: number;
  isFeatured: boolean;
  rating: number;
  reviewCount: number;
  destination: {
    id: string;
    slug: string;
    name: string;
  };
  departures: DepartureAvailability[];
}

export interface ShuttleWithDepartures {
  id: string;
  slug: string;
  name: string;
  origin: string;
  destination: string;
  isReturn: boolean;
  description: string;
  notes: string | null;
  departures: DepartureAvailability[];
}

export interface DestinationSummary {
  id: string;
  slug: string;
  name: string;
  province: string;
  region: string;
  description: string;
  heroImage: string;
  isFeatured: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  tours: { id: string; title: string; slug: string; basePrice: number }[];
}

export interface DestinationDetail extends Omit<DestinationSummary, "tours"> {
  tours: {
    id: string;
    slug: string;
    title: string;
    category: string;
    durationHours: number;
    summary: string;
    featuredImage: string;
    basePrice: number;
    currency: string;
    maxGroupSize: number;
    departures: { id: string; date: string; departureTime: string; price: number }[];
  }[];
}

export interface CheckoutData {
  departure: {
    id: string;
    date: string;
    departureTime: string;
    returnTime: string | null;
    capacityTotal: number;
    capacityBooked: number;
    capacityHeld: number;
    seatsAvailable: number;
    price: number;
    currency: string;
    tour: {
      id: string;
      title: string;
      slug: string;
      durationHours: number;
      featuredImage: string;
      category: string;
      maxGroupSize: number;
    } | null;
    shuttleRoute: { id: string; name: string; slug: string; origin: string; destination: string } | null;
  };
  stops: {
    id: string;
    name: string;
    town: string;
    address: string;
    instructions: string;
  }[];
}

export interface BookingDetail {
  id: string;
  bookingReference: string;
  voucherCode: string;
  customerName: string;
  customerEmail: string;
  totalSeats: number;
  totalAmount: number;
  currency: string;
  status: string;
  qrCodeUrl: string | null;
  pickupCustomText: string | null;
  pickupStop: { name: string; town: string; instructions: string } | null;
  items: { id: string; name: string; price: number; quantity: number }[];
  tourDeparture: {
    date: string;
    departureTime: string;
    tour: { title: string } | null;
    shuttleRoute: { name: string } | null;
  };
}

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
