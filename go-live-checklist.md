# Phase 7: Infrastructure & Go-Live Checklist

## 1. Cloud Architecture & Hosting (Vercel & Railway)
- [ ] **I1: Vercel Frontend Deployment**: Connect the `main` branch to a new Vercel project.
  - Environment Variables to set: `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_STRIPE_KEY`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_SENTRY_DSN`.
  - Override build command to: `npm run build` (Sitemap generates automatically post-build).
- [ ] **I2: Database Connection Pooling**: Configure Prisma Accelerate or PgBouncer on the production PostgreSQL cluster (e.g., Supabase or Railway) to prevent connection exhaustion. Set the generated connection string to `DATABASE_URL` in the backend.
- [ ] **I3: Redis & BullMQ**: Provision a Redis instance (Upstash or Redis Enterprise). Set `REDIS_URL` in the backend environment to enable the Job Queue and global Rate Limiting.

## 2. API & Service Cutover
- [ ] **I5: Stripe Webhooks**: In the Stripe Production Dashboard, register a new Webhook endpoint pointing to `https://api.vistachase.com/api/webhooks/stripe`. Copy the live Signing Secret and save it as `STRIPE_WEBHOOK_SECRET` in the backend.
- [ ] **I10: Final Bókun API Cutover**: Go to Bókun > Settings > API Keys. Generate a live Production Access Key and Secret. Update `BOKUN_ACCESS_KEY` and `BOKUN_SECRET_KEY` in the backend. Ensure the Online Sales Channel ID matches the live channel.
- [ ] **Meta Cloud / WhatsApp**: Submit the WhatsApp Business Account for production approval and generate a permanent access token.

## 3. Observability & Analytics
- [ ] **I6: Sentry Monitoring**: Both the Frontend and Backend are configured for Sentry. Ensure `SENTRY_DSN` is populated on the backend, and `NEXT_PUBLIC_SENTRY_DSN` on the frontend.
- [ ] **I7: Uptime Monitoring**: Configure Better Stack (Logtail/Uptime) or Pingdom to ping `https://api.vistachase.com/api/health` and `https://vistachase.com` every 1 minute.
- [ ] **I9: Google Analytics**: GA4 tag (`NEXT_PUBLIC_GA_ID`) is integrated into `layout.tsx`. Validate events using the Tag Assistant.

## 4. SEO & DNS
- [ ] **I8: Domain Configuration**: Map the A/CNAME records in DNS for `vistachase.com` to Vercel, and `api.vistachase.com` to the Backend hosting provider.
- [ ] **I11: SEO and Sitemap**: `next-sitemap` is configured. Submit `https://vistachase.com/sitemap.xml` to Google Search Console.

## 5. Security & Final Checks (I12)
- [ ] Verify AI Concierge falls back smoothly if Anthropic API degrades.
- [ ] Verify the Admin account exists and the password is secure.
- [ ] Ensure `NODE_ENV=production` is strictly enforced to block AI mutation tools and disable the mock catalog.
- [ ] Final end-to-end test of the checkout flow using a live credit card (immediately refunded).
