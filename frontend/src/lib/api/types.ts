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

export interface TourFact {
  label: string;
  value: string;
}

export interface TourStop {
  name: string;
  text: string;
}

/** One heading block inside a detail tab (copy imported from the live product page). */
export interface TourSection {
  heading: string;
  body: string[];
  items: string[];
  steps: { time: string; text: string }[];
  stops: TourStop[];
  note: string | null;
}

export interface TourTab {
  label: string;
  sections: TourSection[];
}

export interface TourFaq {
  question: string;
  answer: string;
}

export interface VehicleOption {
  id: string;
  label: string;
  seats: number;
}

/** A background clip served by the backend (backend/media/videos). */
export interface PageVideo {
  id: string;
  src: string;
  /** 1080p encode for large screens (hero clips only). */
  srcHd: string | null;
  poster: string;
  title: string;
  alt: string;
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
  /** Clips of the places the tour visits, best match first. */
  videos: PageVideo[];
  basePrice: number;
  currency: string;
  minGroupSize: number;
  maxGroupSize: number;
  isFeatured: boolean;
  rating: number;
  reviewCount: number;
  /** Bokun experience ID from the product mapping table; null until Vista Chase provides it. */
  bokunId: string | null;
  bookingMode: "BOKUN" | "ENQUIRY";
  /** PERSON: price per guest. GROUP: price per vehicle / private group. */
  priceUnit: "PERSON" | "GROUP";
  facts: TourFact[];
  tabs: TourTab[];
  faqs: TourFaq[];
  crossSells: string[];
  vehicleOptions: VehicleOption[];
  metaTitle: string | null;
  metaDescription: string | null;
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
  /** Hero clip for the destination, when there is one. */
  heroVideo?: PageVideo | null;
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
  /** Not returned by the public reference lookup: live tracking opens only from the link sent to the guest. */
  trackingToken?: string | null;
  pickupCustomText: string | null;
  pickupTime?: string | null;
  adultsCount?: number;
  childrenCount?: number;
  infantsCount?: number;
  subtotal?: number;
  tax?: number;
  addOnsTotal?: number;
  pickupStop: {
    name: string;
    town: string;
    instructions: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  } | null;
  items: { id: string; name: string; price: number; quantity: number }[];
  tourDeparture: {
    date: string;
    departureTime: string;
    returnTime?: string | null;
    tour: { title: string; slug?: string; featuredImage?: string; durationHours?: number } | null;
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
