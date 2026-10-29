// Activity tickets the guest books directly with the operator (Banff Jasper Collection by Pursuit),
// through Vista Chase's agency links (agency 5009093). Links and preferred times are the owner's
// (2026-10-29). A ticket product listed here shows a "Book tickets" button instead of the enquiry
// form; a ticket missing here keeps the request form.

const GLACIER_ADVENTURE_URL =
  "https://bookings.banffjaspercollection.com/RKY/activities/details/1/ICE-BTC-BA-GA/Attraction?WebLink=5JMNSDKc4w3ABB1JC90edA%3d%3d&agencyNumber=5009093&wlid=1812&lob=Glacier+Adventure#/select-ticket/book-adventure";

export interface ActivityTicket {
  /** Operator booking page for this ticket (opens in a new tab). */
  url: string;
  /** The time slot we recommend, shown next to the button. */
  preferredTime?: string;
  /** Why that slot, or how the ticket compares, in one line. */
  note?: string;
}

export const ACTIVITY_TICKETS: Record<string, ActivityTicket> = {
  "banff-gondola-tickets": {
    url: "https://bookings.banffjaspercollection.com/RKY/activities/details/1/YBA-BTC-BA-BGR/Attraction?WebLink=%2fQCx2XCHrDMbzHLvNWJ5IA%3d%3d&agencyNumber=5009093&wlid=1808&lob=Banff+Gondola#/select-ticket/book-adventure",
    preferredTime: "9:00 AM",
  },
  "lake-minnewanka-cruise-tickets": {
    url: "https://bookings.banffjaspercollection.com/RKY/activities/details/1/YBA-BTC-BA-BLC/Attraction?WebLink=UIL4QpnESxfATEyJJVwTVg%3d%3d&agencyNumber=5009093&wlid=1810&lob=Banff+Lake+Cruise#/select-ticket/book-adventure",
    preferredTime: "2:00 to 4:00 PM",
  },
  "columbia-icefield-adventure-tickets": {
    url: GLACIER_ADVENTURE_URL,
    preferredTime: "3:30 PM",
    note: "The 3:30 PM slot usually saves a few dollars.",
  },
  // No stand-alone Skywalk link was given: the Glacier Adventure ticket includes the Skywalk.
  "columbia-icefield-skywalk-tickets": {
    url: GLACIER_ADVENTURE_URL,
    preferredTime: "3:30 PM",
    note: "The Skywalk is booked as part of the Glacier Adventure (Ice Explorer + Skywalk). The 3:30 PM slot usually saves a few dollars.",
  },
  "ice-odyssey-tickets": {
    url: "https://bookings.banffjaspercollection.com/RKY/activities/details/1/ICE-BTC-BA-IO/Attraction?WebLink=TrJgkm9fFeCfISdNV4i2Sw%3d%3d&agencyNumber=5009093&wlid=1811&lob=Glacier+Adventure#/select-ticket/book-adventure",
    preferredTime: "3:30 PM",
    note: "The business-class glacier experience: more private, with extra time on the ice.",
  },
  "maligne-lake-cruise-tickets": {
    url: "https://bookings.banffjaspercollection.com/RKY/activities/details/1/YJA-BTC-BA-MLC/Attraction?WebLink=rAP7e7CLsF7jalx7WLOBHg%3d%3d&agencyNumber=5009093&wlid=1813&lob=Maligne+Lake+Cruise#/select-ticket/book-adventure",
    preferredTime: "9:00 to 10:00 AM (early morning)",
  },
  // Off sale since the Google Doc removed it (REMOVED_TOUR_SLUGS); the link is ready if it returns.
  "open-top-touring-tickets": {
    url: "https://bookings.banffjaspercollection.com/RKY/activities/details/1/OTT/Tour?WebLink=uubnJjGflj%2bbRwHputmpwg%3d%3d&agencyNumber=5009093&wlid=1809#/select-ticket/book-adventure",
  },
};

/** The operator booking link for a ticket product, if it has one. */
export function activityTicket(slug: string, category?: string | null): ActivityTicket | undefined {
  return category === "TICKET" ? ACTIVITY_TICKETS[slug] : undefined;
}
