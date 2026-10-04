# 🚐 Mornby Operations & Dispatch Architecture • Vista Chase

> **Authoritative Operational Reference**: Mornby Workflow by Cavero Labs & `Vista Chase Revamp Roadmap.pdf`  
> **Core Principle**: **Bókun is the System of Record** for all customer inventory and OTA channel bookings (Viator, GetYourGuide). Mornby Operations serves as the daily run planning, dispatching, driver rostering, and passenger check-in layer.

---

## 1. System Overview

```
                      BÓKUN PLATFORM
                 (Booking System of Record)
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
         Webhook Push            Automated CSV / Poll
               │                         │
               └────────────┬────────────┘
                            ▼
              IBookingOperationsProvider
               (Ingestion & Idempotency)
                            │
                            ▼
              Mornby Operations Database
            (Runs, Vehicles, Stops, Manifests)
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
    Dispatch Board      Fleet & Guides    Live GPS & T-60
   (/admin/operations)  (14-Vans & SUVs)   (/track/[token])
```

---

## 2. Operational Status Lifecycle

Every departure and vehicle run strictly executes the following finite-state lifecycle:

```
[PLANNED] ──> [READY] ──> [DISPATCHED] ──> [BOARDING] ──> [IN_PROGRESS] ──> [COMPLETED]
    │            │             │               │
    └───[CANCELLED]            └───[DELAYED]───┘
```

1. **`PLANNED`**: Departures scheduled, bookings synced from Bókun, awaiting fleet and driver assignment.
2. **`READY`**: Vehicle and driver assigned; vehicle inspection complete; T-60 notifications queued.
3. **`DISPATCHED`**: Shuttle has departed Canmore fleet depot en route to the first hotel pickup point.
4. **`BOARDING`**: Shuttle arrived at hotel pickup stop; driver actively scanning QR vouchers and checking in passengers.
5. **`IN_PROGRESS`**: All guests boarded; shuttle navigating to Lake Louise & Moraine Lake destinations.
6. **`COMPLETED`**: Return drop-offs finished; post-trip vehicle inspection complete.
7. **`DELAYED`**: Road blockage (Trans-Canada Hwy 1 / Bow Valley Parkway) or weather delay flagged with guest alerts.
8. **`CANCELLED`**: Weather / Parks Canada closure or zero bookings.

---

## 3. Operations Data Model

* **`Vehicle`**: Commercial fleet (Sprinters #4 and #2, Yukon Denali XL VIP #1, Escalade ESV #3) with seating capacity, license plates, VIN numbers, and tracking device IDs.
* **`Driver`**: Staff registry separating internal operational records (legal name, phone, commercial license class) from customer-visible public attributes (first name, bio, photo, ratings).
* **`OperationRun`**: Grouping departures into executable vehicle runs with capacity tracking.
* **`RunBooking`**: Ordered pickup sequence connecting bookings to runs with 1-click boarding check-in.
* **`TrackingSession`**: Cryptographically secure 64-character token session connecting vehicle telemetry to guest tracking pages.

---

## 4. REST API Endpoints

All operations endpoints require `ADMIN`, `OPERATOR`, or `DISPATCHER` RBAC permissions:

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/api/operations/dashboard` | `GET` | Aggregates daily departures, runs, fleet utilization, and unboarded passengers. |
| `/api/operations/runs/:runId` | `GET` | Fetches single run manifest with ordered stops and passenger details. |
| `/api/operations/runs` | `POST` | Creates or updates an operational run, assigning fleet and driver. |
| `/api/operations/runs/:runId/status` | `POST` | Updates run lifecycle status (`PLANNED` ➔ `READY` ➔ `DISPATCHED` etc.). |
| `/api/operations/runs/:runId/optimize-pickups` | `POST` | Orders hotel pickup sequence East to West along the Canmore-Banff-Lake Louise corridor. |
| `/api/operations/runs/check-in` | `POST` | Toggles passenger boarding status with atomic timestamp recording. |
| `/api/operations/sync-bokun` | `POST` | Triggers on-demand synchronization with Bókun booking stream. |
| `/api/operations/fleet` | `GET` | Lists all active commercial vehicles. |
| `/api/operations/drivers` | `GET` | Lists all certified staff naturalist drivers. |
