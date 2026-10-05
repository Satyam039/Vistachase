# VISTA CHASE — AI VOICE ASSISTANT & CONVERSATIONAL BOOKING ARCHITECTURE PLAN
**Authoritative Specification:** `VISTACHASE_AI_VOICE_BOOKING_PLAN.md`  
**Date:** October 5, 2026  
**Status:** In Progress / Implementation Ready  

---

## 1. Executive Summary & Core Objective

Rebuild and elevate the Vista Chase AI Concierge into a premium, luxury **AI Voice Assistant** that guides guests seamlessly from initial inquiry to confirmed boarding voucher:

$$\text{Voice Question} \longrightarrow \text{Instant Answer} \longrightarrow \text{Tour Search} \longrightarrow \text{Bókun Availability} \longrightarrow \text{Booking Details} \longrightarrow \text{Review} \longrightarrow \text{Secure Payment} \longrightarrow \text{Confirmation}$$

### Real-World Golden Path Scenario:
1. **Inquiry:** Guest speaks: *"I want information about Moraine Lake."*  
   $\rightarrow$ AI immediately answers with accurate Parks Canada access rules (private vehicle ban, guaranteed commercial access).
2. **Booking Intent:** Guest speaks: *"I want to book the sunrise tour for two adults."*  
   $\rightarrow$ AI naturally extracts intent, asks for travel date or suggests available upcoming sunrise departures.
3. **Bókun Availability Check:** Guest specifies date: *"Tomorrow"* or *"October 6th"*.  
   $\rightarrow$ AI queries validated Bókun availability tool, confirms exact seats remaining, price in CAD, and departure time.
4. **Pickup & Guest Details:** AI asks: *"Which hotel are you staying at in Banff or Canmore?"*  
   $\rightarrow$ Guest speaks hotel and contact name/email/phone; AI resolves exact pickup stop via Maps provider.
5. **Review & Guaranteed 10-Minute Hold:**  
   $\rightarrow$ AI displays booking summary and places an atomic 10-minute hold (`createReservationHold`) preventing double-booking.
6. **PCI-DSS Secure Payment Handoff:**  
   $\rightarrow$ AI strictly refuses credit card/CVV/expiry over voice; generates secure encrypted payment link (`/book?departureId=...&holdToken=...`).
7. **Confirmation & Voucher:**  
   $\rightarrow$ AI confirms payment, generates official booking reference (`VC-2026-XXXXX`), QR code boarding pass, and direct link to `/booking/[ref]/voucher`.
8. **Operations & Tracking Readiness:**  
   $\rightarrow$ AI is connected to live shuttle tracking (`/track/[token]`) and WhatsApp T-60 trigger engine.

---

## 2. Architectural Non-Negotiables & Guardrails

| Constraint | Enforcement Mechanism |
| :--- | :--- |
| **Bókun System of Record** | All product definitions, prices, availability checks, and bookings map directly to Bókun catalog and departure IDs. No rogue or parallel booking database is created. |
| **No Direct Prisma in AI** | The AI engine (whether LLM or dialog state machine) interacts **strictly** via validated backend tools in `ai.tools.ts`. AI cannot run raw queries. |
| **Zero Voice Payment Collection** | Strictly enforced regex and semantic guardrail in both backend and frontend. If user says card numbers, CVV, or expiry, the AI triggers an immediate security refusal and directs to encrypted checkout. |
| **Honest Availability (Zero Hallucination)** | AI checks real-time active departures and seat holds. If a date is sold out or unavailable, it truthfully states availability and suggests alternative dates. |
| **Multi-Turn Conversational Memory** | Conversation session state maintains accumulated booking slots (`tourSlug`, `date`, `departureId`, `seats`, `pickup`, `customerName`, `email`, `phone`) so the user never repeats details. |
| **Natural Interruption** | Web Speech API speech synthesis can be cancelled mid-sentence immediately when the guest speaks or taps the microphone. |
| **Bidirectional Voice + Text** | Simultaneous live microphone input, speech synthesis (with mute toggle), visual interactive companion cards, and standard text input. |
| **Global Accessibility** | In addition to `/concierge`, a global luxury Voice Orb widget is available across the entire site for instant access. |

---

## 3. Detailed Component Architecture

### A. Backend (`backend/src/lib/ai/`)
1. **`ai.provider.ts`**:
   - `ConversationalBookingEngine`: Slot-filling dialog manager that accurately tracks state:
     - `INQUIRY` $\rightarrow$ `TOUR_SELECTED` $\rightarrow$ `DATE_REQUESTED` $\rightarrow$ `AVAILABILITY_CHECKED` $\rightarrow$ `PICKUP_REQUESTED` $\rightarrow$ `DETAILS_COLLECTED` $\rightarrow$ `REVIEW_SUMMARY` $\rightarrow$ `HOLD_ACTIVE` $\rightarrow$ `PAYMENT_PENDING` $\rightarrow$ `CONFIRMED`.
   - Advanced NLP pattern matching for dates (e.g., "tomorrow", "next Monday", ISO dates), passenger counts ("2 adults", "party of 4"), hotel names ("Fairmont Banff Springs"), and cancellation/tracking inquiries.
   - Strict card rejection guardrail (`CREDIT_CARD_REGEX`).
   - Gemini / Mock provider integration with identical tool-calling contracts.

2. **`ai.tools.ts`**:
   - `searchTours({ query, category })`: Filter tours by keyword or category.
   - `getTourDetails({ tourSlugOrBokunId })`: Retrieve full inclusions, vehicle specs, and pricing.
   - `checkBokunAvailability({ date, tourSlug })`: Live departure seat counts from Bókun provider.
   - `getAvailableDates({ tourSlug })`: Honest list of upcoming dates with seats (guaranteeing no hallucinated availability).
   - `getPickup({ hotelNameQuery })`: Fuzzy matching Banff, Canmore, Lake Louise hotel pickups.
   - `createVoiceReservationHold({ departureId, seatsCount, customerName, customerEmail, customerPhone })`: Atomically locks seats for 10 minutes.
   - `createVoiceBookingPaymentIntent({ ... })`: Generates secure payment link (`/book?departureId=...&holdToken=...&guests=...`).
   - `confirmVoiceBooking({ ... })`: Finalizes booking atomically, generating voucher code and link.
   - `getLiveTracking({ tokenOrRef })`: Live shuttle GPS telemetry and WhatsApp T-60 readiness.
   - `getETA({ tokenOrRef })`: Real-time shuttle arrival estimate.

3. **`backend/src/routes/concierge.routes.ts`**:
   - `POST /api/concierge`: Extended to support conversation state preservation (`sessionState`), structured visual card data, checkout URLs, and tool execution logs.
   - `POST /api/concierge/tool`: Validated direct tool execution with role-based access control.

### B. Frontend (`frontend/src/`)
1. **`frontend/src/components/voice/`**:
   - `VoiceAssistantOrb.tsx`: Cinematic Bentley-inspired glowing orb reflecting audio states: `idle`, `listening`, `thinking`, `speaking`, `error`.
   - `VoiceBookingCardStream.tsx`: Companion visual UI rendering rich cards for:
     - Tour Recommendation Cards
     - Departure Date & Time Chips with live remaining seat counts
     - Hotel Pickup Stop Selector
     - 10-Minute Reservation Hold Timer
     - Secure Payment Link Button (PCI-DSS compliant)
     - Boarding Pass Voucher Card with QR code & Reference
     - Live Tracking Telemetry Card
   - `GlobalVoiceAssistantDrawer.tsx`: Global floating launcher and drawer accessible from every page on the site.
2. **`frontend/src/app/concierge/page.tsx`**:
   - Luxury, accessible (WCAG 2.2 AA) full-screen voice concierge featuring voice orb, transcript feed, speech synthesis, microphone controls, and responsive quick prompts.

---

## 4. Implementation Phasing & Milestones

1. **Phase 1: Backend AI & Tool Execution Upgrade**
   - Enhance `ai.tools.ts` with complete voice booking suite.
   - Enhance `ai.provider.ts` with robust multi-turn conversational dialog state machine and slot filling.
   - Update `concierge.routes.ts` with session context preservation.
2. **Phase 2: Backend Vitest Test Suite Validation**
   - Add new comprehensive tests in `backend/tests/ai-voice-booking.test.ts` validating:
     - Voice inquiry $\rightarrow$ instant response
     - Sunrise tour booking $\rightarrow$ date query $\rightarrow$ availability check $\rightarrow$ pickup query $\rightarrow$ guest details $\rightarrow$ review summary $\rightarrow$ hold creation $\rightarrow$ secure payment link $\rightarrow$ booking confirmation
     - Zero credit card collection over voice (safety refusal)
     - Zero hallucination of dates/seats
     - Live tracking & ETA retrieval
   - Run vitest suite across entire backend.
3. **Phase 3: Frontend Voice Components & Visual Card Stream**
   - Build `VoiceAssistantOrb.tsx`.
   - Build `VoiceBookingCardStream.tsx`.
   - Build `GlobalVoiceAssistantDrawer.tsx`.
   - Integrate into `SiteFrame.tsx`.
   - Upgrade `frontend/src/app/concierge/page.tsx`.
4. **Phase 4: Full Quality Assurance, Typecheck & Builds**
   - Run `npm run typecheck` in frontend and backend.
   - Run vitest tests in backend.
   - Verify frontend production build (`npm run build`).
5. **Phase 5: Status Documentation**
   - Update `IMPLEMENTATION_STATUS.md`.
