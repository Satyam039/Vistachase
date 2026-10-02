# 🏔️ Vista Chase - Custom Travel Booking Platform

> **Award-Winning Canadian Rockies Tours, Shuttles & Booking Platform**  
> Serving Banff National Park, Lake Louise, Moraine Lake, Yoho, and Jasper.  
> Ranked **#6 Experience in Canada** by TripAdvisor Travelers' Choice Best of the Best 2025.

---

## 📌 Executive Summary & Current Status

This repository contains the full custom travel booking platform for **Vista Chase**, built with a **modular monolith architecture** using **Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Prisma, and Redis**. 

The platform is designed for **zero-cost local and Render staging development** while maintaining an **AWS-ready enterprise architecture** for seamless production migration (RDS, S3, ElastiCache, Stripe, SES).

---

## 🚀 What Has Been Done So Far

### 🟢 Phase 0: Project Setup, Architecture & Core Foundations (COMPLETE)
- **Tech Stack Initialized**: Next.js 14, React 18, TypeScript 5, Tailwind CSS with customized alpine luxury palette (Deep Forest `#04120e` / `#072019`, Warm Gold `#c89b3c`, Alabaster, and Slate).
- **Environment & Config**: `.env` and `.env.example` with zero hardcoded secrets.
- **Provider Abstractions (Zero-Cost Dev ➔ AWS Production Ready)**:
  - **Database (`IDatabaseProvider`)**: Prisma with zero-setup local SQLite fallback and Render/AWS RDS PostgreSQL compatibility.
  - **Cache & Holds (`ICacheProvider`)**: In-memory TTL provider for zero-cost dev + `ioredis` driver for Render Redis / AWS ElastiCache.
  - **Media Storage (`IStorageProvider`)**: Local filesystem (`/public/uploads`) + AWS S3 provider abstraction.
  - **Email Service (`IEmailProvider`)**: Development console logger + Resend and AWS SES drivers.
  - **Payment Processing (`IPaymentProvider`)**: Mock sandbox simulator (instant approval & refunds) + Stripe Elements integration.
  - **AI Concierge (`IAIProvider`)**: Deterministic Canadian Rockies intelligence engine with **strict credit card refusal safeguards** + Gemini/OpenAI drivers.
  - **Maps & Coordinates (`IMapsProvider`)**: Curated geo-coordinates for 25+ premier Banff, Canmore, and Lake Louise hotels.
- **Containerization**: Multi-stage `Dockerfile`, `docker-compose.yml`, and `render.yaml` Blueprint.
- **Verification**: ESLint, TypeScript check, Vitest harness, and Next.js production build verified.

---

### 🟢 Phase 1: Domain Models, Database Schema & Seeding (COMPLETE)
- **Comprehensive Prisma Schema**:
  - `User` & RBAC roles (`ADMIN`, `OPERATOR`, `DISPATCHER`, `CUSTOMER`).
  - `Destination` (Banff, Lake Louise, Moraine Lake, Jasper, Yoho).
  - `Tour` (Shared, Private SUV, Multi-Day packages).
  - `ShuttleRoute` & `ShuttleStop` (Sunrise, Mid-day, Golden Hour shuttles).
  - `TourDeparture` with **strict real-time capacity counting** (`seatsAvailable = capacityTotal - (capacityBooked + capacityHeld)`).
  - `ReservationHold` (10-minute atomic seat lock preventing double bookings).
  - `Booking`, `BookingAddOn`, `Payment`, `Review`, and `AuditLog`.
- **Database Seeding**:
  - Seeded authentic Vista Chase routes, real pricing, genuine hotel pickup locations, and verified customer testimonials.
  - Seeded test accounts (Admin, Dispatcher, Operator, and Customer).
- **Domain Repositories**:
  - `tour.repository.ts`: Live departure queries and capacity enforcement.
  - `shuttle.repository.ts`: Route schedule lookups.
  - `reservation.repository.ts`: Atomic 10-minute reservation hold engine with auto-expiry.
  - `booking.repository.ts`: Full booking transactions, QR boarding pass generation, and automated confirmation emails.
- **Test Suite**: 11 unit and integration tests passing.

---

### 🟢 Phase 2: Core Customer Experience & Preserved URLs (COMPLETE)
- All legacy Vista Chase URLs preserved with high-converting responsive layouts.
- Schema.org JSON-LD structured data on all pages for maximum SEO authority.

---

### 🟢 Phase 3: Search, Catalog, Pickup Finder & Live Availability (COMPLETE)
- Interactive **Hotel Pickup Finder** (`/pickup-finder`) matching 25+ hotels in Banff, Canmore, and Lake Louise with walking points and maps coordinates.
- Multi-filter catalog search engine (`/search`) with real-time seat availability calculation.

---

### 🟢 Phase 4: Booking Engine, Holds & Payment Abstraction (COMPLETE)
- Multi-step checkout flow (`/book`) with live 10-minute hold countdown timer.
- Atomic seat inventory locking preventing over-capacity or double bookings.
- Pluggable payment abstraction (`mock` instant simulator & `stripe`).
- Digital Boarding Pass Voucher (`/booking/[ref]/voucher`) with offline-ready QR codes.

---

### 🟢 Phase 5: Customer Portal, My Trips & Reviews (COMPLETE)
- Customer Authentication (`/login`, `/register`, `/api/auth/*`).
- "My Trips" dashboard (`/account/trips`) with upcoming and past bookings, boarding pass vouchers, 48-hour cancellation policy enforcement, and verified review submissions.

---

### 🟢 Phase 6: Admin Panel, Dispatch Board & RBAC (COMPLETE)
- Operations Dashboard (`/admin`) with real-time revenue, booking counts, active holds, and recent guest reservations.
- **Daily Dispatch Board** (`/admin/dispatch`) with date navigation, manifests grouped by hotel pickup stop, and 1-click boarding check-in toggles.
- Capacity management with overrides protection.

---

### 🟢 Phase 7: AI Rockies Travel Concierge & Voice Reservation Engine (COMPLETE)
- Interactive AI Travel Concierge (`/concierge`) with Web Speech STT / TTS voice synthesis and audio pulse animations.
- **Strict Security Guardrail**: Intercepts and immediately refuses credit card or CVV details over voice/chat.
- Automated tool calling: searches hotel pickups, verifies seat availability, and places 10-minute reservation holds with direct checkout links.

---

### 🟢 Phase 8: Security, Analytics, Observability & Hardening (COMPLETE)
- Cache-backed sliding window rate limiter (`/lib/security/rate-limiter.ts`).
- Comprehensive operational audit logging (`/lib/security/audit-logger.ts`).
- System health and observability endpoint (`/api/health`).
- Hardened HTTP security headers (CSP, nosniff, SAMEORIGIN, Permissions-Policy).
- Docker multi-stage containerization & Render blueprint (`render.yaml`).
- **37 automated tests passing across 9 test suites**; 0 lint errors, 0 type errors.

---

## 🛠️ How to Run the Application Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` (pre-configured with working local zero-cost defaults):
```bash
cp .env.example .env
```

### 3. Initialize & Seed Database
```bash
npx prisma generate
npx prisma db push
npm run prisma:seed
```

*Seeded Test Accounts:*
- **Admin**: `admin@vistachase.com` / `VistaChaseAdmin2026!`
- **Dispatcher**: `dispatch@vistachase.com` / `Dispatch2026!`
- **Customer**: `sarah.traveler@example.com` / `Traveler2026!`

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run Verification & Test Suite
```bash
npm run test        # Runs all Vitest test suites (14 tests)
npm run typecheck   # Validates TypeScript types (tsc --noEmit)
npm run lint        # Verifies ESLint rules
npm run build       # Validates production Next.js compilation
```

---

## 🛡️ Critical Architectural Rules Enforced

1. **URL Preservation**: All legacy Vista Chase routes (`/banff-highlights-tour`, `/shuttles`, etc.) are preserved verbatim for SEO and backlinks.
2. **Over-Capacity Prevention**: Database transactions verify remaining capacity atomically before holding or booking seats.
3. **Voice Security**: AI voice concierge never collects card details; it reserves seats under a 10-minute hold and issues a secure checkout link.
4. **Clean Abstractions**: Zero vendor lock-in. Switch from Render/Local to AWS/Production via `.env` flags without changing application code.
