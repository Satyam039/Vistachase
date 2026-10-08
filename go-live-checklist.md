# Go-live checklist

The deployment steps, settings and incident guide live in [docs/production-runbook.md](docs/production-runbook.md). Launch when every item below is true on production.

- [ ] All services in `render.yaml` are running, including `vistachase-worker`
- [ ] Release applied migrations; the catalog was loaded once; no demo accounts exist
- [ ] First admin created with a strong password
- [ ] Stripe live keys set; webhook registered for succeeded / failed / canceled events; a real card booking confirmed and refunded end to end
- [ ] Emails arrive from the verified vistachase.com domain (confirmation, cancellation, password reset)
- [ ] `PROMO_CODES` matches Bókun; the 100%-off test code doesn't work (production)
- [ ] Bókun product IDs filled in `backend/prisma/catalog/product-map.json`, and the live Bókun booking calls implemented and tested (see open items)
- [ ] Uptime alert on `/api/health`; Sentry DSNs set; `OPS_ALERT_EMAIL` set
- [ ] Database restore rehearsed
- [ ] 301 redirects for the Webflow URLs in place; sitemap submitted to Search Console
- [ ] Rollback steps rehearsed

## Open items before launch

- Live Bókun booking calls: `createReservation`, `confirmReservation` and `cancelBooking` in `backend/src/modules/bokun/bokun.provider.ts` still log instead of calling Bókun. Paid bookings for Bókun products become `PAID_UNSYNCED` (listed nightly) until this is built against Bókun's API with real keys.
- Bókun availability sync is manual (admin) only; price categories and pickup places still come from our database.
- Pickup-day SMS/WhatsApp needs a provider, consent at checkout and approved templates.
- Live GPS tracking needs a vendor feed; the tracking page stays off (`FEATURE_TRACKING=false`).
- Media (971 MB) still ships inside the backend image; move it to object storage and a CDN.
