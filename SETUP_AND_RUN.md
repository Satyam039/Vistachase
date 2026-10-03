# 🏔️ Vista Chase - Local Setup & Execution Guide

This document describes **exactly how to set up, configure, and run the Vista Chase custom travel booking platform locally from zero**, based directly on the actual current codebase.

The repository is split into two independent apps:

* **`backend/`** — Express REST API (port `4000`): Prisma schema & seed, domain modules, provider abstractions, auth, and the test suite.
* **`frontend/`** — Next.js UI (port `3000`): pages and components only. It reads data from the backend over HTTP, and proxies browser calls to `/api/*` to the backend (see `frontend/next.config.mjs`).

---

## 1. Prerequisites

Before setting up the project, ensure your environment meets the following specifications:

| Requirement | Supported Versions | Notes |
| :--- | :--- | :--- |
| **Operating System** | Windows 10/11, macOS, Linux | Developed and verified on Windows 11 with PowerShell / Bash |
| **Node.js** | `v20.x` or `v21.x` (Recommended: `v20.12.0+` or `v21.7.1`) | Check with `node -v` |
| **npm** | `v10.x` (Recommended: `10.5.0+`) | Check with `npm -v` |
| **Git** | `v2.40+` | For repository management |
| **Docker Desktop** | *Optional for local dev* | Local dev uses zero-cost SQLite & memory cache; Docker is provided for containerized testing |

---

## 2. Project Architecture

The application is split into a **Next.js frontend** and an **Express backend API** (the backend keeps the modular, provider-based structure). This enables seamless, zero-cost development locally with zero external paid dependencies while keeping the system 100% cloud-ready.

### Tech Stack Breakdown
* **Frontend**: Next.js 14.2.15 (React 18.3.1, App Router, Server Components)
* **Backend**: Express 5 REST API (Node.js 20, bundled with tsup, `tsx` for dev)
* **Language**: TypeScript 5.4.5 (Strict mode)
* **Styling**: Tailwind CSS 3.4.3 with custom alpine luxury theme tokens
* **Database ORM**: Prisma Client 5.22.0
* **Testing**: Vitest 1.6.1 with `@testing-library` patterns

### Architecture by Environment

| Component | Local Development (Current) | Render Staging | Future AWS Production |
| :--- | :--- | :--- | :--- |
| **Hosting** | Local Express API + Next.js Dev Server | Two Render Web Services (`render.yaml`) | AWS ECS / Fargate or Amplify |
| **Database** | **SQLite** (`prisma/dev.db` - zero setup) | Render PostgreSQL (Free Tier) | AWS RDS (PostgreSQL Multi-AZ) |
| **Cache & Holds** | **In-Memory TTL Cache** (`MemoryCacheProvider`) | Render Redis / In-Memory | AWS ElastiCache (Redis) |
| **Storage** | **Local Disk** (`public/uploads`) | Render Persistent Disk / S3 | AWS S3 + CloudFront CDN |
| **Payments** | **Mock Sandbox** (`MockPaymentProvider`) | Stripe Test Mode | Stripe Live Elements / Apple Pay |
| **Email** | **Terminal Console Logger** (`ConsoleEmailProvider`) | Resend Free Tier | AWS SES (Simple Email Service) |
| **AI Concierge** | **Rockies Rule & Knowledge Engine** (`MockAIProvider`) | Google Gemini / OpenAI Free Tier | Gemini 1.5 Pro / GPT-4o Production |
| **Maps** | **Mock Geo Database** (`MockMapsProvider`) | Mock / Google Maps Free Tier | Google Maps Platform / Mapbox API |

---

## 3. Database

### Local Database Engine
* **Engine**: **SQLite**
* **File Location**: `backend/prisma/dev.db` (automatically generated inside the `backend/prisma/` folder)
* **Environment Variable**: `DATABASE_URL="file:./dev.db"`
* **Prisma Schema File**: `backend/prisma/schema.prisma`
* **Seed File**: `backend/prisma/seed.js`
* All database commands below are run from inside `backend/`.

### Database Management Commands

| Action | Exact Command | Description |
| :--- | :--- | :--- |
| **Generate Prisma Client** | `npx prisma generate` | Regenerates `@prisma/client` types |
| **Sync Database Schema** | `npx prisma db push` | Creates or updates SQLite tables from `schema.prisma` |
| **Seed Database** | `npm run prisma:seed` | Populates tours, shuttles, stops, departures, and demo accounts |
| **Inspect Database GUI** | `npx prisma studio` | Opens an interactive web browser database viewer at `http://localhost:5555` |
| **Reset Database (Safe)** | *See instructions below* | Clears all test data and re-seeds from scratch |

#### How to Safely Reset Local Database in Development:
If you need to start fresh with clean test data:
```bash
# Delete the SQLite database files
rm prisma/dev.db*   # On Linux/macOS
# On Windows PowerShell:
Remove-Item -Path "prisma\dev.db*" -Force -ErrorAction SilentlyContinue

# Re-create tables and re-seed
npx prisma db push
npm run prisma:seed
```

---

## 4. Environment Variables

Each app has its own `.env`: `backend/.env` (template: `backend/.env.example`) holds the database, cache, provider and secret settings; `frontend/.env` (template: `frontend/.env.example`) only needs `BACKEND_URL` (where the API lives, default `http://localhost:4000`) and public `NEXT_PUBLIC_*` keys. The table below lists the backend variables.

### Variables Table

| Variable | Required Locally? | Purpose | Safe Dev Value | Production Required? |
| :--- | :---: | :--- | :--- | :---: |
| `NODE_ENV` | Yes | Environment mode | `development` | Yes (`production`) |
| `PORT` | No | Local server port | `3000` | Yes (provided by host) |
| `NEXT_PUBLIC_APP_URL`| Yes | Canonical website URL | `http://localhost:3000` | Yes (`https://www.vistachase.com`) |
| `JWT_SECRET` | Yes | Secret for signing auth tokens | `super-secret-jwt-token-vista-chase-rockies-2026-development-only` | Yes (High entropy key) |
| `DB_PROVIDER` | Yes | Database abstraction selector | `prisma-sqlite` | Yes (`prisma-postgres`) |
| `DATABASE_URL` | Yes | Prisma connection string | `file:./dev.db` | Yes (PostgreSQL connection URL) |
| `CACHE_PROVIDER` | Yes | Cache & seat hold engine | `memory` | Yes (`redis`) |
| `REDIS_URL` | No | Redis connection URL | `redis://localhost:6379` | Required if `CACHE_PROVIDER=redis` |
| `STORAGE_PROVIDER` | Yes | File upload destination | `local` | Yes (`s3`) |
| `LOCAL_STORAGE_DIR`| No | Local upload folder path | `./public/uploads` | No |
| `EMAIL_PROVIDER` | Yes | Booking confirmation email driver | `console` | Yes (`resend` or `ses`) |
| `EMAIL_FROM` | Yes | Default sender email header | `Vista Chase Bookings <bookings@vistachase.com>` | Yes |
| `PAYMENT_PROVIDER` | Yes | Checkout payment gateway | `mock` | Yes (`stripe`) |
| `AI_VOICE_PROVIDER`| Yes | Travel concierge AI driver | `mock` | Yes (`gemini` or `openai`) |
| `MAPS_PROVIDER` | Yes | Hotel pickup coordinate locator | `mock` | Yes (`google` or `mapbox`) |
| `ADMIN_EMAIL` | No | Initial admin email for seed | `admin@vistachase.com` | Optional |
| `ADMIN_PASSWORD` | No | Initial admin password for seed | `VistaChaseAdmin2026!` | Optional |

### Current Provider Status Summary
* **Mock**: Payments (`MockPaymentProvider`), AI Voice (`MockAIProvider`), Maps (`MockMapsProvider`).
* **Local**: Database (SQLite `dev.db`), Cache (Node memory with TTL), Storage (`./public/uploads`).
* **Console**: Email (prints formatted HTML/text email notifications to your terminal).
* **Real API / Paid Accounts**: **ZERO required right now.** You do not need to spend any money or register credit cards to run the app.

---

## 5. Installation

Follow these exact steps to clone and install the project:

```bash
# 1. Clone the repository (if downloading fresh)
git clone <repository-url>
cd VistaChase

# 2. Install dependencies for both apps
npm run install:all

# 3. Create the local environment files
# On Linux/macOS:
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# On Windows PowerShell:
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Ensure `backend/.env` contains the local SQLite defaults:
```ini
DATABASE_URL="file:./dev.db"
CACHE_PROVIDER=memory
STORAGE_PROVIDER=local
EMAIL_PROVIDER=console
PAYMENT_PROVIDER=mock
AI_VOICE_PROVIDER=mock
MAPS_PROVIDER=mock
```

---

## 6. Database Setup

Once `backend/.env` is created, run the database setup commands from the `backend/` folder:

```bash
cd backend

# 1. Generate the Prisma Client
npx prisma generate

# 2. Push schema to create SQLite tables
npx prisma db push

# 3. Seed database with authentic Vista Chase tours and test data
npm run prisma:seed
```

Expected output from seed:
```text
🌲 Seeding Vista Chase Canadian Rockies Platform...
✅ Seed completed successfully!
- Sample Admin: admin@vistachase.com / VistaChaseAdmin2026!
- Sample Booking: VC-2026-98412 (Voucher: VC-VOUCH-7891)
```

---

## 7. Run Application

Start both servers, each in its own terminal:

```bash
# Terminal 1 - Express API on http://localhost:4000
npm run dev:backend

# Terminal 2 - Next.js website on http://localhost:3000
npm run dev:frontend
```

* **Local Website URL**: [http://localhost:3000](http://localhost:3000)
* **Backend API URL**: [http://localhost:4000/api/health](http://localhost:4000/api/health)
* **Default Ports**: `3000` (frontend), `4000` (backend). The frontend needs the backend running — every page loads its data from the API.
* **Network Access**: Accessible across local devices on your network via `http://<your-local-ip>:3000`

---

## 8. Demo Accounts

The following development accounts are seeded directly into `dev.db` by `backend/prisma/seed.js`:

> ⚠️ **DEVELOPMENT ONLY — DO NOT USE IN PRODUCTION**

| Email | Password | Role | Purpose |
| :--- | :--- | :---: | :--- |
| `admin@vistachase.com` | `VistaChaseAdmin2026!` | `ADMIN` | Full administrative control, fleet management, and audit logs |
| `operator@vistachase.com` | `Operator2026!` | `OPERATOR` | Fleet management, departure scheduling, and vehicle capacity |
| `dispatch@vistachase.com` | `Dispatch2026!` | `DISPATCHER` | Daily passenger manifests and driver check-in boards |
| `sarah.traveler@example.com` | `Traveler2026!` | `CUSTOMER` | Sample guest with confirmed booking reference `VC-2026-98412` |

---

## 9. Important URLs

All listed routes are implemented and functional in the current codebase:

### Customer & Booking Pages
* **Homepage**: [http://localhost:3000/](http://localhost:3000/)
* **Hotel Pickup Finder**: [http://localhost:3000/pickup-finder](http://localhost:3000/pickup-finder)
* **Search & Live Availability**: [http://localhost:3000/search](http://localhost:3000/search)
* **Multi-Step Booking Checkout**: [http://localhost:3000/book](http://localhost:3000/book)
* **Customer Account & My Trips**: [http://localhost:3000/account/trips](http://localhost:3000/account/trips)
* **Customer Login**: [http://localhost:3000/login](http://localhost:3000/login)
* **Customer Register**: [http://localhost:3000/register](http://localhost:3000/register)
* **AI Rockies Voice Concierge**: [http://localhost:3000/concierge](http://localhost:3000/concierge)
* **Digital Boarding Pass (Sample)**: [http://localhost:3000/booking/VC-2026-98412/voucher](http://localhost:3000/booking/VC-2026-98412/voucher)

### Staff & Operations Management
* **Admin Operations Dashboard**: [http://localhost:3000/admin](http://localhost:3000/admin)
* **Live Driver & Dispatch Board**: [http://localhost:3000/admin/dispatch](http://localhost:3000/admin/dispatch)
* **System Health Check**: [http://localhost:3000/api/health](http://localhost:3000/api/health) (proxied to the backend at `http://localhost:4000/api/health`)

### Product Catalogs & Preserved URLs
* **Shuttles Product Page**: [http://localhost:3000/shuttles](http://localhost:3000/shuttles)
* **Shared Tours (Max 12)**: [http://localhost:3000/shared-tours](http://localhost:3000/shared-tours)
* **Private Luxury SUV Tours**: [http://localhost:3000/private-tours](http://localhost:3000/private-tours)
* **Multi-Day 3-Day Package**: [http://localhost:3000/multi-day-tour-package-for-banff](http://localhost:3000/multi-day-tour-package-for-banff)
* **Banff Highlights Tour (#6 in Canada)**: [http://localhost:3000/banff-highlights-tour](http://localhost:3000/banff-highlights-tour)
* **Banff Private SUV Tour**: [http://localhost:3000/banff-private-tour](http://localhost:3000/banff-private-tour)
* **Banff & Yoho Custom Tour**: [http://localhost:3000/banff-yoho-custom-private-tour](http://localhost:3000/banff-yoho-custom-private-tour)
* **Icefields Parkway & Jasper Tour**: [http://localhost:3000/icefields-jasper-private-tour](http://localhost:3000/icefields-jasper-private-tour)
* **Jasper Custom Private Tour**: [http://localhost:3000/jasper-custom-private-tour](http://localhost:3000/jasper-custom-private-tour)

### Destinations & Information
* **Destinations Catalog**: [http://localhost:3000/destinations](http://localhost:3000/destinations)
* **Moraine Lake Destination Guide**: [http://localhost:3000/destinations/moraine-lake](http://localhost:3000/destinations/moraine-lake)
* **Lake Louise Destination Guide**: [http://localhost:3000/destinations/lake-louise](http://localhost:3000/destinations/lake-louise)
* **Banff Destination Guide**: [http://localhost:3000/destinations/banff-national-park](http://localhost:3000/destinations/banff-national-park)
* **Rockies Photo Gallery**: [http://localhost:3000/gallery](http://localhost:3000/gallery)
* **About Vista Chase**: [http://localhost:3000/about-us](http://localhost:3000/about-us)
* **Contact & Canmore HQ**: [http://localhost:3000/contact-us](http://localhost:3000/contact-us)
* **FAQ & Road Advisory**: [http://localhost:3000/faq](http://localhost:3000/faq)
* **Terms & Conditions**: [http://localhost:3000/terms-and-conditions](http://localhost:3000/terms-and-conditions)
* **Privacy Policy**: [http://localhost:3000/privacy-policy](http://localhost:3000/privacy-policy)

---

## 10. Verification Commands

Before committing code or deploying, run these four verification scripts from the repository root (they call into `backend/` and `frontend/`):

```bash
# 1. Run automated unit & integration test suites
npm run test
```
*Verifies: 37 test cases across 9 suites covering cache TTL, payment mock, AI credit card safety refusal, Banff hotel maps, auth JWT signing, domain repositories, over-capacity rejection, pickup matching, checkout holding engine, customer trips & 48h cancellation, verified reviews, dispatch manifests, boarding toggles, rate limiting, and audit logging.*

```bash
# 2. Check TypeScript static types
npm run typecheck
```
*Verifies: Executes `tsc --noEmit` in both apps to ensure 0 TypeScript compilation or type errors.*

```bash
# 3. Run ESLint code quality checks
npm run lint
```
*Verifies: Runs `next lint` on the frontend using the Next.js core web vitals rules.*

```bash
# 4. Compile optimized production build
npm run build
```
*Verifies: Bundles the backend with tsup (`backend/dist/server.js`) and runs the full Next.js production build for the frontend.*

---

## 11. Common Problems & Troubleshooting

### Problem: `npm install` warning regarding unsupported Node engine
* **Symptom**: `npm WARN EBADENGINE Unsupported engine`
* **Solution**: You can safely ignore warnings if running on Node 21. For long-term production, using Node 20 LTS (`v20.12.0+`) is optimal.

### Problem: Prisma Client error (`Cannot find module '@prisma/client'`)
* **Symptom**: TypeScript or runtime errors claiming `@prisma/client` is missing.
* **Solution**: Run `npx prisma generate` to rebuild the local Prisma Client inside `node_modules`.

### Problem: Port 3000 already in use
* **Symptom**: `Error: listen EADDRINUSE: address already in use :::3000`
* **Solution**: 
  1. Specify a different port when launching: `npx next dev -p 3001` in `frontend/` (or set `PORT` in `backend/.env` for the API, and update `BACKEND_URL` in `frontend/.env` to match).
  2. Or stop the process holding port 3000:
     - On Windows: `Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process`
     - On Linux/macOS: `lsof -ti:3000 | xargs kill -9`

### Problem: Database out of sync or seed error
* **Symptom**: `SQLite database dev.db table does not exist` or foreign key constraint error during seed.
* **Solution**: Delete `backend/prisma/dev.db` and run (inside `backend/`):
  ```bash
  npx prisma db push
  npm run prisma:seed
  ```

### Problem: Redis connection warning in terminal
* **Symptom**: `[RedisCacheProvider] Redis connection error, falling back`
* **Solution**: This is expected if you don't have a local Redis server running. Set `CACHE_PROVIDER=memory` in `backend/.env` to use the built-in in-memory cache with zero external dependencies.

---

## 12. Important Files & Folder Structure

| Path | Purpose |
| :--- | :--- |
| `package.json` | Root convenience scripts (`install:all`, `dev:backend`, `dev:frontend`, `build`, `test`, …) |
| `docker-compose.yml` | Frontend, backend, PostgreSQL and Redis containers |
| `render.yaml` | Render Blueprint: two web services (`backend/`, `frontend/`) + PostgreSQL |
| **`backend/`** | **Express REST API** |
| `backend/.env.example` | Template for all backend environment variables and providers |
| `backend/prisma/schema.prisma` | Database schema (Users, Tours, Shuttles, Stops, Capacity, Bookings) |
| `backend/prisma/seed.js` | Complete Canadian Rockies and Vista Chase seed script |
| `backend/prisma/dev.db` | Local SQLite database file |
| `backend/src/server.ts` | API entry point (listens on `PORT`, default `4000`) |
| `backend/src/app.ts` | Express app: middleware, CORS, and `/api/*` router mounting |
| `backend/src/routes/` | HTTP route handlers (`auth`, `tours`, `shuttles`, `destinations`, `departures`, `reservations`, `bookings`, `account`, `reviews`, `pickups`, `concierge`, `admin`, `health`) |
| `backend/src/modules/` | Domain repositories: `tours`, `shuttles`, `destinations`, `departures`, `reservations`, `bookings`, `reviews`, `admin` |
| `backend/src/lib/` | Providers: cache, storage, email, payment, AI, maps, auth (JWT/RBAC + request guard), security (rate limiter, audit log), db |
| `backend/tests/` | Vitest unit and integration suites (run against the local database) |
| `backend/Dockerfile` | Production container for the API |
| **`frontend/`** | **Next.js website** |
| `frontend/.env.example` | `BACKEND_URL` and public `NEXT_PUBLIC_*` keys |
| `frontend/next.config.mjs` | Security headers and the `/api/*` → backend rewrite |
| `frontend/src/app/` | App Router pages and layouts (no API routes) |
| `frontend/src/components/` | `Navbar`, `Footer`, `TourDetailView`, `BookingCheckoutClient`, `TourSearchFilter` |
| `frontend/src/lib/api/` | Typed server-side API client (`catalog.ts`) and response types (`types.ts`) |
| `frontend/Dockerfile` | Production container for the website |

---

## 13. External Credentials

### Currently NOT Required for Local Development
The following services are fully functional locally through zero-cost mock/local providers. **You do NOT need API keys or credit cards for any of these right now**:
* **Database**: Local SQLite (No cloud account required)
* **Redis**: Local memory cache (No cloud account required)
* **Storage**: Local `backend/public/uploads` (No AWS S3 required)
* **Payments**: Built-in test sandbox (No Stripe account required)
* **Email**: Terminal console logger (No Resend or SES required)
* **AI & Voice**: Built-in deterministic Rockies concierge (No OpenAI/Gemini required)
* **Maps**: Built-in geo-database of 25+ hotels (No Google Maps API key required)

### Required Later for Production (Client-Owned Accounts)
When the client is ready to launch on production infrastructure, the following client-owned services can be plugged in by setting their environment variables without altering application code:
1. **Stripe**: Live `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
2. **AWS S3**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_S3_BUCKET_NAME`
3. **AWS SES or Resend**: Production transactional email delivery
4. **Google Gemini or OpenAI**: Production voice and travel concierge keys
5. **Google Maps Platform**: Production live map pins and autocomplete
6. **AWS RDS / ElastiCache**: Scalable cloud database and distributed seat-hold cache

---

## 14. Local ➔ Render ➔ AWS Migration Path

```text
┌─────────────────────────┐       ┌─────────────────────────┐       ┌─────────────────────────┐
│   LOCAL DEVELOPMENT     │  ──>  │     RENDER STAGING      │  ──>  │   AWS CLOUD PROD        │
│                         │       │                         │       │                         │
│ • SQLite (dev.db)       │       │ • Render PostgreSQL     │       │ • AWS RDS PostgreSQL    │
│ • Memory Cache          │       │ • Memory or Render Redis│       │ • AWS ElastiCache Redis │
│ • Local Uploads         │       │ • Local or S3 Storage   │       │ • AWS S3 + CloudFront   │
│ • Mock Payments         │       │ • Stripe Sandbox        │       │ • Stripe Live           │
│ • Console Email         │       │ • Resend / Console Email│       │ • AWS SES               │
│ • Mock Concierge        │       │ • Gemini Free Tier      │       │ • Production LLM        │
└─────────────────────────┘       └─────────────────────────┘       └─────────────────────────┘
```

1. **Local Development**: Instant startup, zero cost, completely offline capable.
2. **Render Staging**: Deployed automatically using the included `render.yaml` blueprint with free-tier PostgreSQL.
3. **AWS Production**: Enterprise cloud infrastructure with high availability, isolated VPC, auto-scaling, and client-owned AWS credentials.

---

## 15. Safety Rules

1. **Never commit `.env`**: `.env` is ignored by `.gitignore`. Only commit updates to `.env.example`.
2. **Never hardcode secrets**: All credentials, tokens, and keys must be injected through environment variables.
3. **Never use production credentials locally**: Keep sandbox and mock providers active during local development.
4. **Never run destructive commands on production databases**: Commands like `prisma db push --force-reset` must never be run against production PostgreSQL.
5. **Voice Concierge Safety Constraint**: The voice assistant must **NEVER collect or record credit card numbers**. It is architected to place a temporary 10-minute reservation hold and supply a secure encrypted web link for payment completion.

---

## 16. Quick Start

Run these commands to go from a fresh clone to a working local platform in under 2 minutes:

```bash
# 1. Install packages for both apps
npm run install:all

# 2. Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Setup and seed database
cd backend
npx prisma generate
npx prisma db push
npm run prisma:seed
cd ..

# 4. Start the API (terminal 1) and the website (terminal 2)
npm run dev:backend
npm run dev:frontend
```

Then open [http://localhost:3000](http://localhost:3000) in your web browser.
