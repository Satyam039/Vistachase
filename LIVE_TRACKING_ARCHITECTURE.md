# 🛰️ Live GPS Shuttle Tracking Architecture • Vista Chase

> **Reference**: `Vista Chase Revamp Roadmap.pdf` & `VISTACHASE_PREMIUM_BOOKING_REQUIREMENTS.md`

---

## 1. Architecture & Privacy Principles

The Live GPS Shuttle Tracking system gives travelers real-time clarity on their upcoming morning pickup, completely resolving traveler anxiety (*"Where is my morning shuttle?"*).

```
          Vehicle Telematics / GPS Ping
                        │
                        ▼
               ILiveTrackingProvider
           (Mock / Samsara / Driver App)
                        │
                        ▼
            TrackingSession (64-char Hex)
                        │
         ┌──────────────┴──────────────┐
         ▼                             ▼
   /api/track/:token            /track/[token]
(Cache-Control: no-store)    (Next.js Mobile Live Page)
```

### Privacy & Security Guarantees:
1. **Zero Financial Data**: No credit cards, CVVs, transaction IDs, or payment histories are ever transmitted in tracking payloads.
2. **Unguessable Tokens**: Tokens are 64-character cryptographically random hex strings (`crypto.randomBytes(32)`). They cannot be brute-forced and do not leak sequential database IDs or booking reference numbers.
3. **Time-Limited Sessions**: Sessions activate 2 hours prior to scheduled departure and expire automatically 3 hours after tour completion.
4. **Driver Privacy**: Only verified public profile information (First name, photo, ratings, professional bio) is shown to guests; private phone numbers and personal details are protected behind dispatch concierges.

---

## 2. Customer Telemetry Payload

```typescript
export interface TrackingTelemetry {
  sessionToken: string;
  bookingReference: string;
  customerName: string;
  tourName: string;
  departureDate: string;
  departureTime: string;
  pickupStopName: string;
  pickupAddress: string;
  pickupInstructions: string;
  pickupTime: string;
  vehicleName: string;
  licensePlate: string; // "ALBERTA • 7VC-894"
  driverName: string;   // "Marc"
  driverPhoto: string;
  status: "PREPARING" | "ON_THE_WAY" | "ARRIVING_SOON" | "SHUTTLE_IS_HERE" | "IN_TRANSIT" | "COMPLETED";
  statusLabel: string;
  statusDescription: string;
  estimatedArrivalMinutes: number;
  vehicleCoordinates: {
    latitude: number;
    longitude: number;
    heading: number; // 0 - 360 degrees
    speedKmh: number;
    updatedAt: string;
  };
  destinationCoordinates: {
    latitude: number;
    longitude: number;
  };
  routeWaypoints: Array<{
    name: string;
    latitude: number;
    longitude: number;
    isPassed: boolean;
    isCurrent: boolean;
  }>;
  isTrackingActive: boolean;
}
```

---

## 3. Canadian Rockies Topographic Simulation

In development and staging, `MockLiveTrackingProvider` simulates realistic movement along the Trans-Canada Highway 1 and Bow Valley Parkway corridor connecting:
1. Canmore Fleet Depot (`51.0858, -115.3484`)
2. Banff East Park Gate (`51.1611, -115.5089`)
3. Fairmont Banff Springs Hotel (`51.1645, -115.5619`)
4. Moose Hotel & Suites (Banff Ave) (`51.1812, -115.5714`)
5. Banff Caribou Lodge (`51.1872, -115.5683`)
6. Bow Valley Parkway & Castle Mountain (`51.2708, -115.9234`)
7. Lake Louise Village Depot (`51.4254, -116.1773`)
8. Fairmont Chateau Lake Louise (`51.4177, -116.2168`)
9. Moraine Lake & Valley of Ten Peaks (`51.3271, -116.1822`)

---

## 4. WhatsApp T-60 Automated Dispatch

Exactly **60 minutes prior to departure**, Vista Chase executes an automated idempotent notification dispatch:
1. Queries today's departures departing within 60 minutes.
2. Checks `WhatsAppNotification` table using unique key `bookingId_type`.
3. If already sent, skips cleanly to prevent duplicate guest alerts.
4. If not sent, dispatches official template through `IWhatsAppProvider` (`ConsoleWhatsAppProvider` in dev; `TwilioWhatsAppProvider` / `MetaCloudWhatsAppProvider` in production).
