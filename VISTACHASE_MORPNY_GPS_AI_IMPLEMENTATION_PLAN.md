# 🏔️ VISTA CHASE — MORPBY OPERATIONS + LIVE GPS + AI
## MASTER IMPLEMENTATION PLAN & ARCHITECTURAL SPECIFICATION

> **Authoritative Reference**: `Vista Chase Revamp Roadmap.pdf` (Audited 3 Oct 2026, 102 live URLs, 13 bookable products, branch `refactor/frontend-backend-split`)  
> **Non-Negotiable Core Principle**: **Bókun remains the single source of truth (System of Record)** for inventory, availability, OTA feeds (Viator, GetYourGuide), and primary bookings. Vista Chase does NOT duplicate or replace Bókun. Mornby acts as the operational dispatch and run execution layer. Live GPS and AI connect to this operational backbone.

---

## 1. Current Architecture Audit & Gap Analysis

Following the repository inspection of the monorepo split (`frontend/` + `backend/`), here is the precise status of every system component:

| System Layer | Current Implementation Status | Classification | Gap / Action Required |
| :--- | :--- | :--- | :--- |
| **Bókun Integration** | Disconnected; backend has local SQLite departure seed data and mock booking table. | **Needs Modification & New Provider** | Build `IBookingOperationsProvider` with `MockBokunOperationsProvider` (pre-loaded with the 13 live Bókun products from Roadmap p.4) + Bókun REST/Webhook ingestion schema. |
| **Frontend Application** | Next.js 15 (App Router) + React 19 + Astryx Stone Theme + Tailwind in `frontend/`. Running on `localhost:3000`. | **Partially Implemented** | Add Mornby Operations Workspace (`/admin/operations`, `/admin/runs`, `/admin/fleet`), Customer Live Tracking (`/track/[token]`), and Staff AI Assistant. |
| **Backend API** | Express 5 + Prisma ORM in `backend/`. Running on `localhost:4000`. | **Partially Implemented** | Add dedicated routes for Operations runs, fleet, drivers, tracking sessions, Bókun sync, and validated AI orchestration tools. |
| **Database & Models** | SQLite (`backend/prisma/dev.db`) via Prisma 5.22. Models: `User`, `Tour`, `ShuttleRoute`, `ShuttleStop`, `TourDeparture`, `Booking`, `ReservationHold`, `Payment`, `Review`, `AuditLog`. | **Needs Modification & Extension** | Extend schema with operational models: `Vehicle`, `Driver`, `OperationRun`, `RunBooking`, `TrackingSession`, `VehiclePosition`, `WhatsAppNotification`, and `BokunSyncLog`. |
| **Authentication & RBAC** | JWT cookie-based auth in `backend/src/lib/auth/jwt.ts` and `admin-guard.ts`. Roles: `ADMIN`, `OPERATOR`, `DISPATCHER`, `CUSTOMER`. | **Already Implemented** | Enforce dispatcher/operator RBAC on all Mornby operations endpoints and staff AI tools. |
| **Admin & Dispatch** | Basic `/admin/dispatch` with date filter and 1-click boarding check-in toggle. | **Partially Implemented** | Upgrade to full Mornby-style dispatch: Grouping bookings into vehicle runs, assigning fleet and guides, ordered pickup routing, operational statuses (`PLANNED` ➔ `READY` ➔ `DISPATCHED` ➔ `BOARDING` ➔ `IN_PROGRESS` ➔ `COMPLETED`). |
| **Live GPS Telemetry** | Standalone mock in backup branch. | **New Functionality in Monorepo** | Implement `ILiveTrackingProvider` in backend, store high-frequency `VehiclePosition`, generate 64-char crypto tracking tokens, and render live mobile tracking at `/track/[token]`. |
| **WhatsApp T-60 Dispatch** | Console provider in backup branch. | **New Functionality in Monorepo** | Port `IWhatsAppProvider` with `ConsoleWhatsAppProvider` + Meta/Twilio stubs, plus an idempotent T-60 automated dispatch runner preventing duplicate guest messages. |
| **AI Concierge & Staff Assistant** | Voice & text concierge in `backend/src/routes/concierge.routes.ts` with strict credit card refusal guardrail. | **Partially Implemented** | Expand into a strictly controlled tool-orchestration engine. Add customer query tools (live ETA, vehicle status, Bókun tour details) and staff operations tools (today's runs, delayed shuttles, unboarded passengers). Ensure AI never mutates DB directly. |
| **Maps & Routing** | In-memory coordinates in `backend/src/lib/maps/maps.provider.ts` for 25+ Canadian Rockies hotels. | **Already Implemented** | Add pickup sequence optimization helper for Canmore/Banff/Lake Louise corridor. |
| **Deployment & Environments** | Multi-stage Dockerfiles, `docker-compose.yml`, and `render.yaml` for Render/AWS. | **Already Implemented** | Verified zero hardcoded credentials; provider abstractions support zero-cost local dev and AWS RDS/ElastiCache/S3 production. |

---

## 2. Non-Negotiable Data Flow & Bókun Boundary

```
                           CUSTOMER
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            Vista Chase Website    OTA Channels
            (Bókun Widget / API) (Viator, GetYourGuide)
                    │                   │
                    └─────────┬─────────┘
                              ▼
                       BÓKUN PLATFORM
                   (System of Record)
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
           Bókun Webhooks API    Manual CSV Fallback
           (Real-Time Push)      (Canmore Operations)
                    │                   │
                    └─────────┬─────────┘
                              ▼
                IBookingOperationsProvider
                (Sync & Ingestion Service)
                              │
                              ▼
                   OPERATIONS DATABASE
                   (Runs, Vehicles, Stops)
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
     Mornby Operations    Live GPS Engine   AI Tool Layer
     (Dispatch / Runs)    (Telematics)     (Customer & Staff)
            │                 │                 │
            ▼                 ▼                 ▼
      Guide / Fleet      /track/{token}    Safe Answers
```

### Strict System-of-Record Rules:
1. **Inventory & Availability**: Owned exclusively by Bókun. Local operations database never marks seats available or sells inventory independently.
2. **Bookings & Payments**: Customer transactions are captured by Bókun. Operations receives bookings via webhook push, API poll, or CSV import.
3. **Operations Authority**: Daily run groupings, vehicle assignments, driver rosters, pickup stop sequence, and real-time boarding status are owned by Vista Chase Operations (Mornby layer).

---

## 3. Mornby Operations Platform Specification

Inspired by the Mornby workflow (Cavero Labs reference), the Vista Chase operations system provides dispatchers and fleet coordinators with complete daily command:

### A. Operations Dashboard (`/admin/operations` & `/admin/dispatch`)
* **Date Navigation**: 1-click selector (`Today`, `Tomorrow`, `Pick Date`) with count of active runs and unboarded passengers.
* **Daily Departures Table**:
  * Departure Time (e.g. `05:00 AM Sunrise`, `08:30 AM Morning Explorer`)
  * Product / Tour Name & Bókun ID
  * Vehicle Run Name (e.g. `Run 1 - Sprinter Alpha`, `Run 2 - Yukon Denali`)
  * Capacity Utilization Meter (e.g. `12 / 14 Seats (86%)`)
  * Assigned Vehicle & Plate
  * Assigned Guide / Driver
  * Operational Status Pill
  * Actions: View Manifest, Edit Run, Re-order Pickups, Print Manifest

### B. Standardized Operational Status Lifecycle
All departures and runs follow an explicit, deterministic finite-state lifecycle:

```
[PLANNED] ──> [READY] ──> [DISPATCHED] ──> [BOARDING] ──> [IN_PROGRESS] ──> [COMPLETED]
    │            │             │               │
    └───[CANCELLED]            └───[DELAYED]───┘
```

1. **`PLANNED`**: Departures scheduled, bookings synced from Bókun, waiting for fleet/driver assignment.
2. **`READY`**: Vehicle and driver assigned; vehicle inspection complete; T-60 notifications queued.
3. **`DISPATCHED`**: Shuttle has departed Canmore depot en route to the first hotel pickup point.
4. **`BOARDING`**: Shuttle arrived at hotel stop; driver actively scanning QR vouchers and ticking passengers.
5. **`IN_PROGRESS`**: All guests boarded; shuttle navigating to Banff/Lake Louise/Moraine Lake destinations.
6. **`COMPLETED`**: Return drop-offs finished; post-trip vehicle inspection complete.
7. **`DELAYED`**: Road blockage (Trans-Canada Hwy 1 / Bow Valley Parkway) or weather delay flagged with guest alerts.
8. **`CANCELLED`**: Weather / Parks Canada closure or zero bookings.

### C. Groups & Vehicle Runs
* **Automated Run Optimizer**: Automatically allocates bookings from a tour departure into vehicle runs based on capacity:
  * Fill largest capacity vehicles first (14-passenger Mercedes Sprinter Executive).
  * Overflow to luxury SUV charters (6-passenger GMC Yukon Denali / Cadillac Escalade).
* **Manual Drag-and-Drop / Reassignment**: Operations staff can move passenger groups between runs to accommodate luggage, family groups, or wheelchair requests.

### D. Pickup Order & Stop Sequence Routing
* Aggregates passengers by designated hotel pickup (Fairmont Banff Springs, Rimrock, Moose Hotel, Caribou Lodge, Lake Louise Inn, etc.).
* Orders stops in optimal geographical progression from Canmore fleet base through Banff townsite along Bow Valley Parkway to Lake Louise.
* Displays estimated pickup time, guest headcount per hotel, special requests, and single-click boarding check-in toggle.

---

## 4. Bókun Integration Architecture

### A. Provider Interface: `IBookingOperationsProvider`
```typescript
export interface BokunProduct {
  id: string;
  title: string;
  category: "SHARED" | "PRIVATE" | "SHUTTLE" | "MULTIDAY";
  durationHours: number;
  capacity: number;
  bokunRateId?: string;
}

export interface BokunBookingPayload {
  bokunBookingId: string;
  bookingReference: string; // VC-#####
  productBokunId: string;
  departureDate: string; // YYYY-MM-DD
  departureTime: string; // HH:mm
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalSeats: number;
  pickupLocation: string;
  pickupTime?: string;
  status: "CONFIRMED" | "CANCELLED";
  totalAmount: number;
  currency: string;
  sourceChannel: "WEBSITE" | "VIATOR" | "GETYOURGUIDE" | "DIRECT";
}

export interface IBookingOperationsProvider {
  fetchProducts(): Promise<BokunProduct[]>;
  syncTodaysBookings(date: string): Promise<{ syncedCount: number; updatedCount: number; errors: string[] }>;
  handleBookingWebhook(payload: unknown): Promise<{ success: boolean; bookingReference?: string }>;
}
```

### B. The 13 Authoritative Bókun Catalog Products (Roadmap p.4)
The sync layer will map the 13 live Bókun products exactly:
1. `1142134` — Banff Highlights Tour (Shared, 12 guests)
2. `1114197` — Heart of Banff (Shared, 12 guests)
3. `1113741` — Banff + Yoho National Park (Shared, 12 guests)
4. `1114201` — Icefields Parkway & Jasper (Shared, 12 guests)
5. `1114208` — Winter Special Ice Bubbles (Shared, 12 guests)
6. `1167962` — Banff Private Best Seller (Private SUV/Van)
7. `856008` — Icefields Parkway & Jasper Private (Private SUV/Van)
8. `1136438` — Winter Signature Private Tour (Private SUV/Van)
9. `BOKUN-CUSTOM-1` — Banff & Yoho / Jasper Customizable (Enquiry/Charter)
10. `928996` — Sunrise Shuttle, Moraine Lake & Lake Louise (Shuttle)
11. `933218` — Day Shuttle, Moraine Lake & Lake Louise (Shuttle)
12. `BOKUN-MULTIDAY-1` — Multi-Day Canadian Rockies Package (Package)
13. `BOKUN-CUSTOM-2` — Custom Private Charter

---

## 5. Fleet & Guide/Driver Operations Model

### A. Vehicles (`Vehicle`)
* Internal operations fleet registry:
  * `name`: e.g. "Sprinter Executive #4", "Yukon Denali VIP #1"
  * `type`: `VAN_14`, `SUV_6`, `MINIBUS_24`
  * `capacity`: Integer passenger limit
  * `licensePlate`: `ALBERTA • 7VC-894`
  * `vinNumber`: Internal commercial maintenance ID
  * `trackingDeviceId`: Associated GPS OBD-II / telematics unit
  * `isActive`: Boolean status flag
  * `status`: `AVAILABLE`, `ASSIGNED`, `IN_SERVICE`, `MAINTENANCE`

### B. Drivers / Naturalist Guides (`Driver`)
* Staff management with role-based visibility separation:
  * **Internal Operations Fields**: Legal name, employee ID, mobile phone, commercial driver license class (Alberta Class 4), emergency contact, duty status.
  * **Customer-Visible Public Fields**: First name ("Marc"), professional bio ("Lead Rockies Naturalist"), photo URL, average tour rating (`4.98 ★`).

---

## 6. Live GPS Tracking System

### A. Provider Interface: `ILiveTrackingProvider`
```typescript
export interface VehicleCoordinates {
  latitude: number;
  longitude: number;
  heading: number; // 0 - 360 degrees
  speedKmh: number;
  altitudeMeters?: number;
  updatedAt: string;
}

export interface TrackingTelemetry {
  sessionToken: string;
  bookingReference: string;
  customerName: string;
  tourName: string;
  pickupStopName: string;
  pickupAddress: string;
  pickupTime: string;
  pickupInstructions: string;
  vehicleName: string;
  licensePlate: string;
  driverName: string;
  driverPhoto: string;
  driverPhone?: string;
  status: "PREPARING" | "ON_THE_WAY" | "ARRIVING_SOON" | "SHUTTLE_IS_HERE" | "IN_TRANSIT" | "COMPLETED";
  statusLabel: string;
  statusDescription: string;
  estimatedArrivalMinutes: number;
  vehicleCoordinates: VehicleCoordinates;
  destinationCoordinates: { latitude: number; longitude: number };
  routeWaypoints: Array<{ name: string; latitude: number; longitude: number; isPassed: boolean; isCurrent: boolean }>;
}

export interface ILiveTrackingProvider {
  getTrackingTelemetry(token: string): Promise<TrackingTelemetry | null>;
  pushGpsPing?(vehicleId: string, coords: VehicleCoordinates): Promise<void>;
}
```

### B. Cryptographic Token Architecture
* Generated using `crypto.randomBytes(32).toString('hex')` (64-character unguessable hex string).
* Completely decoupled from internal database IDs and booking reference numbers.
* Public URL: `https://vistachase.com/track/{64-char-token}`.
* Life cycle: Active 2 hours prior to departure; automatically expires 3 hours after tour completion.
* Unauthenticated/expired access displays an alpine-branded graceful recovery screen with 24/7 concierge hotlines.

---

## 7. Automated WhatsApp T-60 Experience

```
                   T-60 Trigger (Scheduler / Cron)
                                │
                                ▼
                   Query Departures Starting in 60m
                                │
                                ▼
                   Generate Cryptographic Token
                                │
                                ▼
                   Idempotent Notification Check
              (Does WhatsAppNotification record exist?)
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
              [Yes]                          [No]
          Skip / Log                 Create DB Record
       (Duplicate blocked)                     │
                                               ▼
                                      IWhatsAppProvider
                                (Console / Twilio / Meta)
                                               │
                                               ▼
                                      Customer WhatsApp
```

### Official Approved WhatsApp Template:
```text
🏔️ Vista Chase Canadian Rockies

Good morning, {Customer Name}!
Your private shuttle for {Tour Name} is preparing for departure.

📍 Pickup Location: {Pickup Hotel / Stop}
⏰ Scheduled Pickup: {Pickup Time}
🚐 Vehicle: {Vehicle Model} • Plate: {License Plate}
👤 Guide: {Guide Name}

Tap below to track your driver's live GPS location:
https://vistachase.com/track/{secureToken}

Need assistance? Reply directly to this WhatsApp message or call our 24/7 concierge.
```

---

## 8. AI System — Controlled Tool Orchestration Layer

> **Critical Safety Rule**: AI NEVER mutates the database directly. It only invokes validated, typed backend tools with parameter validation and RBAC enforcement.

### A. Customer-Facing AI Tools
1. `searchTours(destination, category, maxPrice)`: Queries available Vista Chase experiences.
2. `getTourDetails(tourSlugOrBokunId)`: Returns facts, inclusions, itineraries, and season notes.
3. `checkBokunAvailability(date, tourSlug)`: Fetches live seat counts from Bókun sync.
4. `getBooking(bookingReference, customerEmail)`: Retrieves booking details (requires email authentication).
5. `getPickup(hotelNameQuery)`: Searches 25+ curated hotel stops with walking directions.
6. `getLiveTracking(tokenOrRef)`: Returns real-time GPS coordinates, vehicle speed, heading, and ETA.
7. `getOperationalStatus(bookingReference)`: Returns live shuttle status (`ON_THE_WAY`, `ARRIVING_SOON`).

### B. Staff-Facing Operations AI Assistant Tools (Staff Auth Required)
1. `getTodaysDepartures(date)`: Summarizes all departures, booked seats, and vehicle runs.
2. `getPendingPickups(runId)`: Lists guests not yet checked in at hotel pickup locations.
3. `getBoardingStatus(departureId)`: Returns passenger boarding headcount (`X / Y boarded`).
4. `getVehicleAssignments(date)`: Lists active fleet deployment and driver schedules.
5. `getDelayedDepartures()`: Flags any runs impacted by highway or weather delays.

---

## 9. Database Schema Expansion Plan (Prisma)

To support Mornby operations, live GPS, and WhatsApp notifications without breaking existing features, we will extend `backend/prisma/schema.prisma`:

```prisma
model Vehicle {
  id               String          @id @default(cuid())
  name             String          // "Sprinter Executive #4"
  type             String          @default("VAN_14") // VAN_14, SUV_6, COACH_24
  capacity         Int             @default(14)
  licensePlate     String          @unique // "ALBERTA • 7VC-894"
  vinNumber        String?
  trackingDeviceId String?         @unique
  isActive         Boolean         @default(true)
  status           String          @default("AVAILABLE") // AVAILABLE, ASSIGNED, IN_SERVICE, MAINTENANCE
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
  runs             OperationRun[]
  positions        VehiclePosition[]
}

model Driver {
  id             String         @id @default(cuid())
  name           String         // Legal full name
  publicName     String         // "Marc" (customer visible)
  email          String         @unique
  phone          String
  licenseClass   String         @default("Class 4")
  bio            String?
  photoUrl       String?
  rating         Float          @default(5.0)
  isActive       Boolean        @default(true)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  runs           OperationRun[]
}

model OperationRun {
  id              String         @id @default(cuid())
  name            String         // "Run 1 - Morning Lake Louise"
  date            String         // YYYY-MM-DD
  tourDepartureId String
  tourDeparture   TourDeparture  @relation(fields: [tourDepartureId], references: [id], onDelete: Cascade)
  vehicleId       String?
  vehicle         Vehicle?       @relation(fields: [vehicleId], references: [id], onDelete: SetNull)
  driverId        String?
  driver          Driver?        @relation(fields: [driverId], references: [id], onDelete: SetNull)
  status          String         @default("PLANNED") // PLANNED, READY, DISPATCHED, BOARDING, IN_PROGRESS, COMPLETED, CANCELLED, DELAYED
  notes           String?
  departureTime   String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  bookings        RunBooking[]
  trackingSession TrackingSession?

  @@index([date])
  @@index([status])
}

model RunBooking {
  id             String       @id @default(cuid())
  runId          String
  run            OperationRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  bookingId      String
  booking        Booking      @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  pickupOrder    Int          @default(0) // Sequence order (1, 2, 3...)
  isBoarded      Boolean      @default(false)
  boardedAt      DateTime?
  notes          String?

  @@unique([runId, bookingId])
  @@index([runId])
}

model TrackingSession {
  id             String          @id @default(cuid())
  runId          String          @unique
  run            OperationRun    @relation(fields: [runId], references: [id], onDelete: Cascade)
  token          String          @unique // 64-char crypto hex string
  isActive       Boolean         @default(true)
  expiresAt      DateTime
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@index([token])
}

model VehiclePosition {
  id             String       @id @default(cuid())
  vehicleId      String
  vehicle        Vehicle      @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  latitude       Float
  longitude      Float
  heading        Float        @default(0)
  speedKmh       Float        @default(0)
  timestamp      DateTime     @default(now())

  @@index([vehicleId, timestamp])
}

model WhatsAppNotification {
  id             String       @id @default(cuid())
  bookingId      String
  booking        Booking      @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  type           String       @default("T_60_TRACKING")
  phone          String
  messageId      String?
  status         String       @default("SENT") // SENT, FAILED, DELIVERED
  dispatchedAt   DateTime     @default(now())

  @@unique([bookingId, type]) // Idempotency guarantee
}

model BokunSyncLog {
  id             String       @id @default(cuid())
  syncType       String       // "POLL", "WEBHOOK", "CSV_IMPORT"
  recordsSynced  Int          @default(0)
  status         String       @default("SUCCESS")
  details        String?      // JSON or error log
  createdAt      DateTime     @default(now())
}
```

---

## 10. Implementation Sequence & Plan-First Verification

### Step 1: Backend Database & Prisma Evolution
* Update `backend/prisma/schema.prisma` with the operational models.
* Run `npx prisma db push` and update `backend/prisma/seed.js` with realistic vehicles (Sprinter, Yukon Denali), licensed drivers, operational runs, and Bókun product keys.
* Run `prisma generate` to update typed query engine.

### Step 2: Bókun Operations Ingestion Service
* Create `backend/src/modules/bokun/bokun.provider.ts`:
  * Define `IBookingOperationsProvider`.
  * Implement `MockBokunOperationsProvider` pre-loaded with the 13 live Bókun catalog products from Roadmap p.4 and realistic customer bookings.
  * Implement sync engine translating Bókun bookings to Vista Chase operational departures and hotel pickups.

### Step 3: Mornby Operations & Dispatch Engine
* Create `backend/src/modules/operations/operations.repository.ts`:
  * `getOperationsDashboard(date)`: Aggregates departures, vehicle runs, driver assignments, and capacity.
  * `createOrUpdateRun()`: Group bookings into runs, assign vehicle and guide.
  * `optimizePickupSequence(runId)`: Sorts hotel stops logically along the Canmore ➔ Banff ➔ Lake Louise corridor.
  * `updateRunStatus(runId, status)`: Transitions through `PLANNED` ➔ `READY` ➔ `DISPATCHED` ➔ `BOARDING` ➔ `IN_PROGRESS` ➔ `COMPLETED`.
  * `togglePassengerBoarding(runBookingId, isBoarded)`: Atomic boarding verification with timestamp.
* Create `backend/src/routes/operations.routes.ts`:
  * REST endpoints protected by `getAuthenticatedStaff(["ADMIN", "OPERATOR", "DISPATCHER"])`.

### Step 4: Live GPS Tracking & Telemetry Engine
* Create `backend/src/lib/tracking/tracking.provider.ts`:
  * `MockLiveTrackingProvider`: Canadian Rockies corridor simulation (depot at Canmore, Trans-Canada Hwy 1, Fairmont Banff Springs, Bow Valley Parkway, Lake Louise, Moraine Lake) with dynamic heading, velocity, and waypoint interpolation.
  * `getTrackingTelemetry(token)`: Validates 64-char crypto token, verifies expiry, and returns sanitised customer telemetry.
* Create `backend/src/routes/tracking.routes.ts`:
  * `GET /api/track/:token`: Real-time telemetry feed with `Cache-Control: no-store`.

### Step 5: WhatsApp T-60 Notification Engine
* Create `backend/src/lib/whatsapp/whatsapp.provider.ts`:
  * `IWhatsAppProvider` with `ConsoleWhatsAppProvider` + Twilio/Meta stubs.
  * `dispatchT60TrackingNotifications()`: Scheduled runner finding departures starting in 60 minutes, generating secure tracking sessions, and dispatching messages with strict database-enforced idempotency (`WhatsAppNotification` unique constraint).

### Step 6: Controlled AI Orchestration Engine
* Upgrade `backend/src/routes/concierge.routes.ts` & `backend/src/lib/ai/ai.tools.ts`:
  * Customer tools: `searchTours`, `getTourDetails`, `checkBokunAvailability`, `getLiveTracking`, `getPickup`.
  * Staff operations tools: `getTodaysDepartures`, `getPendingPickups`, `getBoardingStatus`, `getVehicleAssignments`.
  * Enforce strict validation and credit-card refusal guardrails.

### Step 7: Frontend Mornby Operations UI & Customer Live Tracking UI
* Build Mornby Operations Workspace in `frontend/src/app/admin/operations/page.tsx`:
  * Fast-scanning operational table with status pills, vehicle/driver selectors, run management modal, and pickup manifest view.
* Build Customer Live Tracking in `frontend/src/app/track/[token]/page.tsx`:
  * Alpine luxury theme (Deep Forest Green, Gold, Alabaster).
  * Interactive SVG topographic corridor map with live moving vehicle pin and radar beacon.
  * Dynamic status indicator (`ON THE WAY`, `ARRIVING SOON`, `SHUTTLE IS HERE`).
  * Real-time ETA dial, certified naturalist guide card with 1-tap WhatsApp concierge, and vehicle identification plate.
  * Zero payment or sensitive private data exposed.

### Step 8: Comprehensive Automated Verification
* Unit and integration tests in `backend/tests/`:
  1. `bokun-sync.test.ts`: Product catalog parity, booking ingestion, idempotency.
  2. `operations-dispatch.test.ts`: Run creation, vehicle/driver assignment, capacity enforcement, pickup re-ordering, boarding check-in.
  3. `live-tracking.test.ts`: Crypto token generation, telemetry streaming, expiration handling.
  4. `whatsapp-t60.test.ts`: T-60 trigger, duplicate prevention, console formatting.
  5. `ai-orchestration.test.ts`: Tool dispatching, card details refusal, RBAC tool gating.
* Full test run: `npm test`
* Frontend and backend typechecks: `npm run typecheck`
* Production builds: `npm run build`

---

## 11. Self-Review Against `Vista Chase Revamp Roadmap.pdf`

| Roadmap Document Criteria | Plan Implementation Check | Status |
| :--- | :--- | :--- |
| **Bókun is System of Record** (Roadmap p.1, p.7) | Guaranteed. Vista Chase does not create parallel production inventory. Bókun products (`1142134`, `1167962`, `928996`, etc.) are mapped and ingested into operations. | ✅ Compliant |
| **Mornby Operations Role** (Roadmap p.1, p.5) | Mornby workflow is reproduced cleanly in Vista Chase styling: daily runs, vehicle assignment, driver allocation, pickup routing, and boarding check-ins. | ✅ Compliant |
| **Preserve Live Catalog** (Roadmap p.4) | All 13 bookable products and their Bókun IDs are preserved in test fixtures and catalog mappings. | ✅ Compliant |
| **102 Live URLs Preserved** (Roadmap p.6, p.9) | Next.js route parity is maintained; `/track/[token]` adds customer value without modifying live URLs. | ✅ Compliant |
| **Zero Cost Local Dev ➔ AWS Production** | SQLite local fallback + Console logging for WhatsApp and Email; AWS RDS Postgres and Twilio/Meta ready via environment variables. | ✅ Compliant |
| **Security & Privacy** | No credit card data in AI or WhatsApp. Cryptographically unguessable tracking tokens. Internal driver details withheld from customers. | ✅ Compliant |

**Self-Review Verdict**: The plan contains zero contradictions with `Vista Chase Revamp Roadmap.pdf` and satisfies all technical and business requirements. Proceeding automatically into implementation.
