# 🤖 Controlled AI Operations & Concierge Architecture • Vista Chase

> **Reference**: `Vista Chase Revamp Roadmap.pdf` & Parts 12–15 of Specifications

---

## 1. Safety Principles & Controlled Orchestration

Vista Chase implements AI as a **strictly controlled tool-orchestration engine**:

```
                       CUSTOMER OR STAFF
                               │
                               ▼
                        AI Provider Layer
                     (Deterministic / LLM)
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
       [Credit Card Refusal]          [Validated Tool Call]
      (Immediate intercept of                  │
       any 13-16 digit cards)                  ▼
                                     Tool Dispatcher
                                   (RBAC Auth Enforced)
                                               │
                                ┌──────────────┴──────────────┐
                                ▼                             ▼
                         Customer Tools                  Staff Tools
                         (Search, ETA,                (Rosters, Delays,
                            Pickup)                       Manifests)
                                │                             │
                                └──────────────┬──────────────┘
                                               ▼
                                      Operations Database
                                    (Prisma Typed Queries)
```

### Inviolable Safety Guardrails:
1. **Zero Database Mutation via AI**: AI is mathematically incapable of raw SQL or Prisma update queries. It can only trigger typed, safe repository methods.
2. **Zero Financial / Credit Card Handling**: Any message matching credit card regexes (`\b(?:\d[ -]*?){13,16}\b`) or CVVs triggers an immediate polite security refusal directing the guest to the official checkout page.
3. **No Hallucinated Availability or Locations**: The AI always retrieves live numbers directly from Bókun sync or the Operations database.

---

## 2. Customer-Facing AI Tools

| Tool | Parameters | Output |
| :--- | :--- | :--- |
| `searchTours` | `query?`, `category?` | Matching tours with duration, prices in CAD, and ratings. |
| `getTourDetails` | `tourSlugOrBokunId` | Highlights, inclusions, exclusions, and gear suggestions. |
| `checkBokunAvailability` | `date`, `tourSlug?` | Real-time seat counts, departure times, and pricing. |
| `getBooking` | `bookingReference`, `customerEmail?` | Passenger count, pickup hotel, departure schedule. |
| `getPickup` | `hotelNameQuery` | Verified pickup instructions for 25+ Canadian Rockies hotels. |
| `getLiveTracking` | `tokenOrRef` | Real-time vehicle location, heading, velocity, and status. |
| `getETA` | `tokenOrRef` | Minutes remaining until shuttle arrives at guest's hotel. |
| `getOperationalStatus` | `bookingReference` | Shuttle status (`ON_THE_WAY`, `BOARDING`, `IN_TRANSIT`). |

---

## 3. Staff-Facing Operations AI Assistant Tools

Requires active `ADMIN`, `OPERATOR`, or `DISPATCHER` authentication:

| Tool | Parameters | Output |
| :--- | :--- | :--- |
| `getTodaysDepartures` | `date?` | Summary of all departures, booked seats, and assigned runs. |
| `getPendingPickups` | `runId?`, `date?` | Unboarded guests grouped by hotel pickup stop. |
| `getBoardingStatus` | `departureId?`, `date?` | Passenger headcount tally (`X / Y boarded`). |
| `getVehicleAssignments`| `date?` | Active fleet allocation and driver pairings. |
| `getDelayedDepartures` | — | Any runs flagged with weather or highway delays. |
