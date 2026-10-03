# 🔌 Vista Chase Third-Party Integration Status

> **Reference**: `Vista Chase Revamp Roadmap.pdf` (Audited 3 Oct 2026)

---

## 1. Third-Party Services Matrix

| Integration | Role | Provider In Code | Environment Variables | Current Status |
| :--- | :--- | :--- | :--- | :--- |
| **Bókun** | **System of Record** for all inventory, pricing, availability & OTAs | `IBookingOperationsProvider`<br>[`MockBokunOperationsProvider`](file:///c:/Users/satya/OneDrive/Desktop/VistaChase/backend/src/modules/bokun/bokun.provider.ts) | `BOKUN_API_KEY`<br>`BOKUN_SECRET_KEY`<br>`BOKUN_BASE_URL` | **Mock Ready with 13 Live Products**.<br>Awaiting client test/live API credentials. |
| **Mornby Operations** | Daily run planning, vehicle allocation, pickup routing & boarding check-ins | [`operations.repository.ts`](file:///c:/Users/satya/OneDrive/Desktop/VistaChase/backend/src/modules/operations/operations.repository.ts)<br>[`/admin/operations`](file:///c:/Users/satya/OneDrive/Desktop/VistaChase/frontend/src/app/admin/operations/page.tsx) | Internal DB | **Production-Ready & Fully Functional**.<br>Syncs with Bókun bookings. |
| **Live GPS Telematics** | Vehicle tracking along Bow Valley corridor | `ILiveTrackingProvider`<br>[`MockLiveTrackingProvider`](file:///c:/Users/satya/OneDrive/Desktop/VistaChase/backend/src/lib/tracking/tracking.provider.ts) | `GPS_VENDOR_API_KEY` | **Simulated with 10Hz topographics**.<br>Ready for hardware OBD-II/Samsara/driver app. |
| **WhatsApp Business** | T-60 departure notification alerts | `IWhatsAppProvider`<br>[`ConsoleWhatsAppProvider`](file:///c:/Users/satya/OneDrive/Desktop/VistaChase/backend/src/lib/whatsapp/whatsapp.provider.ts) | `WHATSAPP_PROVIDER`<br>`TWILIO_ACCOUNT_SID`<br>`META_WHATSAPP_TOKEN` | **Console Simulator Active**.<br>Twilio & Meta Cloud drivers implemented. |
| **Stripe** | Guest checkout payment processing | `IPaymentProvider`<br>`MockPaymentProvider` / `StripeProvider` | `STRIPE_SECRET_KEY`<br>`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | **Mock Simulator Active**.<br>Stripe Elements ready for keys. |
| **Email Service** | Confirmation receipts & boarding passes | `IEmailProvider`<br>`ConsoleEmailProvider` / `Resend` | `EMAIL_PROVIDER`<br>`RESEND_API_KEY` | **Console Active**.<br>Zero-cost dev simulator. |
| **Database** | Platform data store | Prisma ORM | `DATABASE_URL="file:./dev.db"` | **SQLite Active**.<br>PostgreSQL-ready for Render/RDS. |
