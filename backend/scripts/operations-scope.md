# Operations Scope: Vista Chase vs. Mornby

## Overview
As Vista Chase scales, operational logic splits between our custom internal systems and external commercial off-the-shelf (COTS) products like Mornby (if adopted).

## Vista Chase Internal Module (Our Code)
Our internal operations module is strictly responsible for:
1. **Core E-Commerce & Availability**: Managing the frontend catalog, calculating pricing, checking Bókun availability, and processing Stripe payments.
2. **Customer Communications**: Sending branded email receipts, WhatsApp tracking alerts (via Meta Cloud), and post-trip review requests.
3. **Driver Dispatch & GPS**: The live `vistaQueue` (BullMQ) jobs, basic vehicle assignment, and emitting live GPS tracking links.
4. **Basic Admin & Reconciliation**: The admin panel for manual booking edits, audit logs, and nightly financial reconciliation with Stripe + Bókun.

## Mornby's Scope (External Operations System)
If Mornby is integrated, it handles advanced fleet and staff operations:
1. **Complex Fleet Logistics**: Predictive vehicle maintenance, DVIR (Driver Vehicle Inspection Reports), and complex bus routing logic.
2. **HR & Compliance**: Driver shift scheduling, maximum hours-of-service compliance, and payroll calculations.
3. **Deep Operational Reporting**: Cost-per-mile analysis, fuel tracking, and driver performance scores.

## Integration Point
We treat Mornby as a downstream consumer. When a booking is confirmed locally and synced to Bókun, our backend can emit a webhook to Mornby to update their manifest. Mornby handles the driver shift, and our internal module handles the customer-facing tracking link.
