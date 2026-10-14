// Staff admin API. Every route needs a staff session (the site's vc_token cookie, or a Bearer
// token for scripts); some need ADMIN. Inputs are validated, writes are limited to named fields
// and recorded in the audit log, and errors never echo internal messages.

import { Router, type Request, type Response, type NextFunction } from "express";
import prisma from "@/lib/db/prisma";
import { getAuthenticatedStaff } from "@/lib/auth/admin-guard";
import type { TokenPayload, UserRole } from "@/lib/auth/auth";
import {
  getAdminMetrics,
  getDepartureManifest,
  getDispatchManifest,
  manifestCsv,
  listDepartureInventory,
  setDepartureInventorySource,
  toggleBoardingStatus,
  updateDepartureCapacity,
} from "@/modules/admin/admin.repository";
import { listFlags, markRefunded, OFFLINE_METHODS, quickBook, recordPayment, resolveFlag, staffCancelBooking, staffRefundsViaProvider } from "@/modules/admin/booking-admin";
import { createDepartures, departureProducts, listDepartures, setDepartureStatus, updateDeparture } from "@/modules/admin/departure-admin";
import { createStop, listStops, updateStop } from "@/modules/admin/pickup-admin";
import { emailDeliveryConfigured, getEmailProvider } from "@/lib/email/email.provider";
import { hashPassword } from "@/lib/auth/auth";
import { ASSIGNABLE_ROLES, STAFF_LIST_ROLES } from "@/lib/auth/permissions";
import crypto from "node:crypto";
import { siteUrl } from "@/lib/security/signed-links";
import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import { verifyBookingLink, voucherLink } from "@/lib/security/signed-links";
import { emailSchema, parseOr400, referenceSchema, z } from "@/lib/security/validate";
import { dateOnly, getMountainTimeInstant, timeOfDay, todayInMountainTime } from "@/lib/utils/time";

const router = Router();
type StaffRequest = Request & { staff: TokenPayload };

const STAFF: UserRole[] = ["ADMIN", "OPERATOR", "DISPATCHER"];

// The role is read from the database on every request, so a demotion takes effect at once.
function requireStaff(roles: UserRole[] = STAFF) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const staff = await getAuthenticatedStaff(req, roles);
      if (!staff) return res.status(403).json({ success: false, error: "Access denied. Staff privileges required." });
      (req as StaffRequest).staff = staff;
      next();
    } catch (e) {
      next(e);
    }
  };
}

const MANAGERS: UserRole[] = ["ADMIN", "OPERATOR"];
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const id = (req: Request) => String(req.params.id);
const staffId = (req: Request) => (req as StaffRequest).staff.userId;

/** Sends a repository result ({ status, error } or { status, ...data }) as the response. */
function send(res: Response, result: { status: number; error?: string } & Record<string, unknown>) {
  const { status, error, ...data } = result;
  return error ? res.status(status).json({ success: false, error }) : res.status(status).json({ success: true, ...data });
}

async function audit(req: Request, action: string, entityType: string, entityId: string, details: Record<string, unknown>) {
  await prisma.auditLog
    .create({ data: { userId: (req as StaffRequest).staff.userId, action, entityType, entityId, details: details as object } })
    .catch((e) => console.error("Audit log write failed:", (e as Error).message));
}

router.use(requireStaff());

// Dashboard and dispatch (frontend app/admin and app/admin/dispatch)
router.get("/metrics", async (_req, res, next) => {
  try {
    res.json({ success: true, metrics: await getAdminMetrics() });
  } catch (e) {
    next(e);
  }
});

router.get("/dispatch", async (req, res, next) => {
  try {
    const q = parseOr400(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }), req.query, res);
    if (!q) return;
    const date = q.date ?? todayInMountainTime();
    res.json({ success: true, date, manifests: await getDispatchManifest(date) });
  } catch (e) {
    next(e);
  }
});

router.post("/dispatch/check-in", async (req, res, next) => {
  try {
    const body = parseOr400(z.object({ bookingId: z.string().min(1).max(64), isBoarded: z.boolean() }), req.body, res);
    if (!body) return;
    const updated = await toggleBoardingStatus(body.bookingId, body.isBoarded);
    await audit(req, body.isBoarded ? "CHECK_IN" : "UNDO_CHECK_IN", "Booking", updated.id, {});
    res.json({ success: true, booking: { id: updated.id, isBoarded: updated.isBoarded } });
  } catch (e) {
    next(e);
  }
});

// Scanning a voucher QR code: verifies its signature, then checks the guest in.
router.post("/checkin", async (req, res, next) => {
  try {
    const body = parseOr400(z.object({ ref: referenceSchema, sig: z.string().max(64) }), req.body, res);
    if (!body) return;
    if (!verifyBookingLink(body.ref, "checkin", body.sig)) return res.status(400).json({ success: false, error: "This QR code is not a valid Vista Chase voucher." });
    const booking = await prisma.booking.findUnique({ where: { bookingReference: body.ref }, include: { tourDeparture: { include: { tour: true, shuttleRoute: true } } } });
    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });
    if (booking.status !== "CONFIRMED" && booking.status !== "PAID_UNSYNCED") {
      return res.status(409).json({ success: false, error: `This booking is ${booking.status.toLowerCase().replace("_", " ")}.` });
    }
    const updated = await toggleBoardingStatus(booking.id, true);
    await audit(req, "CHECK_IN_QR", "Booking", booking.id, {});
    res.json({
      success: true,
      booking: {
        bookingReference: booking.bookingReference,
        customerName: booking.customerName,
        totalSeats: booking.totalSeats,
        experience: booking.tourDeparture.tour?.title ?? booking.tourDeparture.shuttleRoute?.name,
        date: booking.tourDeparture.date,
        departureTime: booking.tourDeparture.departureTime,
        isBoarded: updated.isBoarded,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.post("/departures/capacity", requireStaff(["ADMIN", "OPERATOR"]), async (req, res, next) => {
  try {
    const body = parseOr400(z.object({ departureId: z.string().min(1), newTotalCapacity: z.number().int().min(0).max(100) }), req.body, res);
    if (!body) return;
    const result = await updateDepartureCapacity(body.departureId, body.newTotalCapacity);
    if (!result.success) return res.status(400).json({ success: false, error: result.error });
    await audit(req, "UPDATE_CAPACITY", "TourDeparture", body.departureId, { capacityTotal: body.newTotalCapacity });
    res.json({ success: true, departure: result.departure });
  } catch (e) {
    next(e);
  }
});

// Inventory: staff confirm which departures are real (LOCAL, sold online) or take them off sale
// (UNVERIFIED). Pick departures by id, or by tour and date range. GET lists them with their source.
const inventoryFilter = z
  .object({
    departureIds: z.array(z.string().min(1).max(64)).min(1).max(500).optional(),
    tourSlug: z.string().min(1).max(120).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .refine((f) => f.departureIds || f.tourSlug, "Give departureIds or a tourSlug");

router.get("/departures/inventory", requireStaff(["ADMIN", "OPERATOR"]), async (req, res, next) => {
  try {
    const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
    const query = parseOr400(z.object({ tourSlug: z.string().min(1).max(120), from: day, to: day }), req.query, res);
    if (!query) return;
    const departures = await listDepartureInventory(query.tourSlug, query.from, query.to);
    res.json({ success: true, departures });
  } catch (e) {
    next(e);
  }
});

router.post("/departures/inventory", requireStaff(["ADMIN", "OPERATOR"]), async (req, res, next) => {
  try {
    const body = parseOr400(inventoryFilter.and(z.object({ inventorySource: z.enum(["LOCAL", "UNVERIFIED"]) })), req.body, res);
    if (!body) return;
    const updated = await setDepartureInventorySource(body, body.inventorySource);
    await audit(req, "SET_INVENTORY_SOURCE", "TourDeparture", body.departureIds?.join(",").slice(0, 190) || `tour:${body.tourSlug}`, {
      inventorySource: body.inventorySource,
      tourSlug: body.tourSlug ?? null,
      from: body.from ?? null,
      to: body.to ?? null,
      count: updated,
    });
    res.json({ success: true, updated });
  } catch (e) {
    next(e);
  }
});

// Enquiry inbox
router.get("/enquiries", async (req, res, next) => {
  try {
    const q = parseOr400(z.object({ status: z.enum(["NEW", "REPLIED", "CLOSED"]).optional() }), req.query, res);
    if (!q) return;
    const enquiries = await prisma.enquiry.findMany({ where: q.status ? { status: q.status } : undefined, orderBy: { createdAt: "desc" }, take: 200 });
    res.json({ success: true, enquiries });
  } catch (e) {
    next(e);
  }
});

router.patch("/enquiries/:id", async (req, res, next) => {
  try {
    const body = parseOr400(z.object({ status: z.enum(["NEW", "REPLIED", "CLOSED"]) }), req.body, res);
    if (!body) return;
    const enquiry = await prisma.enquiry.update({ where: { id: String(req.params.id) }, data: { status: body.status } });
    await audit(req, "UPDATE_ENQUIRY", "Enquiry", enquiry.id, body);
    res.json({ success: true, enquiry });
  } catch (e) {
    next(e);
  }
});

// Bookings: search, staff edits (named fields only), resend voucher
const bookingSelect = {
  id: true, bookingReference: true, status: true, customerName: true, customerEmail: true, customerPhone: true,
  totalSeats: true, totalAmount: true, currency: true, pickupTime: true, pickupCustomText: true, specialRequests: true,
  adminNotes: true, isBoarded: true, createdAt: true, bokunBookingId: true, tourDepartureId: true,
  flags: { where: { status: "OPEN" }, select: { id: true, type: true } },
  tourDeparture: { select: { date: true, departureTime: true, tour: { select: { title: true } }, shuttleRoute: { select: { name: true } } } },
} as const;

router.get("/bookings", async (req, res, next) => {
  try {
    const q = parseOr400(
      z.object({ q: z.string().trim().max(120).optional(), status: z.string().max(20).optional(), departureId: z.string().max(64).optional(), flagged: z.enum(["true"]).optional() }),
      req.query,
      res,
    );
    if (!q) return;
    const text = q.q;
    const bookings = await prisma.booking.findMany({
      where: {
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.departureId ? { tourDepartureId: q.departureId } : {}),
        ...(q.flagged ? { flags: { some: { status: "OPEN" } } } : {}),
        ...(text
          ? { OR: [{ bookingReference: { contains: text, mode: "insensitive" } }, { customerEmail: { contains: text, mode: "insensitive" } }, { customerName: { contains: text, mode: "insensitive" } }] }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: bookingSelect,
    });
    res.json({ success: true, bookings: bookings.map((b) => ({ ...b, totalAmount: b.totalAmount / 100 })) });
  } catch (e) {
    next(e);
  }
});

const bookingEdit = z
  .object({
    pickupTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    pickupStopId: z.string().max(64).nullable().optional(),
    pickupCustomText: z.string().trim().max(200).nullable().optional(),
    specialRequests: z.string().trim().max(1000).nullable().optional(),
    adminNotes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict(); // status, prices and contact details change only through their own flows

router.patch("/bookings/:id", async (req, res, next) => {
  try {
    const body = parseOr400(bookingEdit, req.body, res);
    if (!body) return;
    const booking = await prisma.booking.update({ where: { id: String(req.params.id) }, data: body, select: bookingSelect });
    await audit(req, "UPDATE_BOOKING", "Booking", booking.id, body);
    res.json({ success: true, booking: { ...booking, totalAmount: booking.totalAmount / 100 } });
  } catch (e) {
    next(e);
  }
});

router.post("/bookings/:id/resend-voucher", async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: String(req.params.id) } });
    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });
    const link = voucherLink(booking.bookingReference);
    await getEmailProvider().sendEmail({
      to: booking.customerEmail,
      subject: `Your Vista Chase voucher: ${booking.bookingReference}`,
      html: `<p>Hi ${booking.customerName.replace(/[<>&]/g, "")},</p><p>Here is your voucher for booking <strong>${booking.bookingReference}</strong>: <a href="${link}">open your voucher</a>.</p>`,
      text: `Your voucher for booking ${booking.bookingReference}: ${link}`,
    });
    await audit(req, "RESEND_VOUCHER", "Booking", booking.id, {});
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// Booking detail: payments, open and closed flags, and the booking's own audit trail.
router.get("/bookings/:id", async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: id(req) },
      select: {
        ...bookingSelect,
        adultsCount: true, childrenCount: true, infantsCount: true, pickupStopId: true, tourDepartureId: true, paymentExpiresAt: true,
        pickupStop: { select: { name: true, town: true } },
        items: { select: { name: true, price: true, quantity: true } },
        payments: { select: { id: true, amount: true, currency: true, provider: true, status: true, createdAt: true } },
        flags: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });
    const history = await prisma.auditLog.findMany({
      where: { entityType: "Booking", entityId: booking.id },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: { user: { select: { name: true, email: true } } },
    });
    res.json({
      success: true,
      booking: {
        ...booking,
        totalAmount: booking.totalAmount / 100,
        items: booking.items.map((i) => ({ ...i, price: i.price / 100 })),
        payments: booking.payments.map((p) => ({ ...p, amount: p.amount / 100 })),
        flags: booking.flags.map((f) => ({ ...f, amount: f.amountCents != null ? f.amountCents / 100 : null })),
      },
      history,
      refundsViaProvider: staffRefundsViaProvider(),
    });
  } catch (e) {
    next(e);
  }
});

// Staff cancellation: no 72-hour window; seats are released and the refund decision is recorded
// (sent through the payment provider only when STAFF_REFUNDS_VIA_PROVIDER=true).
const cancelSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  refund: z.enum(["POLICY", "FULL", "NONE"]),
  notifyGuest: z.boolean().default(true),
});

router.post("/bookings/:id/cancel", requireStaff(MANAGERS), async (req, res, next) => {
  try {
    const body = parseOr400(cancelSchema, req.body, res);
    if (!body) return;
    const result = await staffCancelBooking(id(req), body, staffId(req));
    if (result.status !== 200) return send(res, result);
    send(res, { ...result, paid: result.paidCents / 100, refundOwed: result.refundOwedCents / 100, refunded: result.refundedCents / 100, refundDue: result.refundDueCents / 100 });
  } catch (e) {
    next(e);
  }
});

// Quick Book: staff book for a guest on the phone or at the desk, paid offline or still due.
const quickBookSchema = z.object({
  departureId: z.string().min(1).max(64),
  customerName: z.string().trim().min(2).max(120),
  customerEmail: emailSchema,
  customerPhone: z.string().trim().min(7).max(32),
  pickupStopId: z.string().max(64).optional(),
  pickupCustomText: z.string().trim().max(200).optional(),
  pickupTime: clock.optional(),
  adultsCount: z.number().int().min(1).max(30),
  childrenCount: z.number().int().min(0).max(30).default(0),
  infantsCount: z.number().int().min(0).max(10).default(0),
  specialRequests: z.string().trim().max(1000).optional(),
  addOns: z.array(z.object({ id: z.string().max(40).optional(), name: z.string().max(120).optional() })).max(10).default([]),
  promoCode: z.string().trim().max(40).optional(),
  payment: z.object({ method: z.enum([...OFFLINE_METHODS, "UNPAID"]), reference: z.string().trim().max(120).optional() }),
  notifyGuest: z.boolean().default(true),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/).optional(),
});

router.post("/quick-book", requireStaff(MANAGERS), async (req, res, next) => {
  try {
    const body = parseOr400(quickBookSchema, req.body, res);
    if (!body) return;
    send(res, await quickBook(body, staffId(req)));
  } catch (e) {
    next(e);
  }
});

// Flags: payments that didn't match or came late, refunds owed, Quick Book payments due.
const FLAG_TYPES = ["PAYMENT_AMOUNT_MISMATCH", "LATE_PAYMENT", "REFUND_DUE", "PAYMENT_DUE", "OTHER"] as const;

router.get("/flags", async (req, res, next) => {
  try {
    const q = parseOr400(z.object({ status: z.enum(["OPEN", "RESOLVED"]).optional(), type: z.enum(FLAG_TYPES).optional(), bookingId: z.string().max(64).optional() }), req.query, res);
    if (!q) return;
    res.json({ success: true, ...(await listFlags(q)), refundsViaProvider: staffRefundsViaProvider() });
  } catch (e) {
    next(e);
  }
});

router.post("/flags/:id/resolve", requireStaff(MANAGERS), async (req, res, next) => {
  try {
    const body = parseOr400(z.object({ resolution: z.string().trim().min(3).max(500) }), req.body, res);
    if (!body) return;
    send(res, await resolveFlag(id(req), body.resolution, staffId(req)));
  } catch (e) {
    next(e);
  }
});

router.post("/flags/:id/mark-refunded", requireStaff(["ADMIN"]), async (req, res, next) => {
  try {
    const body = parseOr400(z.object({ reference: z.string().trim().min(2).max(120), note: z.string().trim().max(500).optional() }), req.body, res);
    if (!body) return;
    send(res, await markRefunded(id(req), body, staffId(req)));
  } catch (e) {
    next(e);
  }
});

router.post("/flags/:id/record-payment", requireStaff(MANAGERS), async (req, res, next) => {
  try {
    const body = parseOr400(z.object({ method: z.enum(OFFLINE_METHODS), reference: z.string().trim().max(120).optional() }), req.body, res);
    if (!body) return;
    send(res, await recordPayment(id(req), body, staffId(req)));
  } catch (e) {
    next(e);
  }
});

// Departures: list, add, edit price and seats, take off sale or put back on sale.
router.get("/departures", async (req, res, next) => {
  try {
    const q = parseOr400(
      z.object({ tourSlug: z.string().max(120).optional(), routeSlug: z.string().max(120).optional(), from: day.optional(), to: day.optional(), status: z.enum(["ACTIVE", "FULL", "CANCELLED"]).optional() }),
      req.query,
      res,
    );
    if (!q) return;
    if (q.from && q.to && q.from > q.to) return res.status(400).json({ success: false, error: "The start date is after the end date." });
    res.json({ success: true, ...(await listDepartures(q)) });
  } catch (e) {
    next(e);
  }
});

router.get("/departures/products", async (_req, res, next) => {
  try {
    res.json({ success: true, ...(await departureProducts()) });
  } catch (e) {
    next(e);
  }
});

const dollars = z.number().min(0).max(100_000);
const newDepartures = z
  .object({
    tourSlug: z.string().max(120).optional(),
    routeSlug: z.string().max(120).optional(),
    dates: z.array(day).min(1).max(92),
    times: z.array(clock).min(1).max(8),
    returnTime: clock.nullable().optional(),
    capacityTotal: z.number().int().min(1).max(100),
    price: dollars,
    childPrice: dollars.nullable().optional(),
  })
  .refine((d) => Boolean(d.tourSlug) !== Boolean(d.routeSlug), "Choose a tour or a shuttle route");

router.post("/departures", requireStaff(MANAGERS), async (req, res, next) => {
  try {
    const body = parseOr400(newDepartures, req.body, res);
    if (!body) return;
    const result = await createDepartures(body);
    if (result.status === 201) {
      await audit(req, "CREATE_DEPARTURES", "TourDeparture", (result.created[0] ?? "none").slice(0, 190), { ...body, created: result.created.length, skipped: result.skipped });
    }
    send(res, result);
  } catch (e) {
    next(e);
  }
});

const departureEdit = z
  .object({ capacityTotal: z.number().int().min(0).max(100).optional(), price: dollars.optional(), childPrice: dollars.nullable().optional(), returnTime: clock.nullable().optional() })
  .strict(); // date and time are fixed: cancel the departure and add a new one instead

router.patch("/departures/:id", requireStaff(MANAGERS), async (req, res, next) => {
  try {
    const body = parseOr400(departureEdit, req.body, res);
    if (!body) return;
    const result = await updateDeparture(id(req), body);
    if (result.status === 200) await audit(req, "UPDATE_DEPARTURE", "TourDeparture", id(req), { changes: body, before: result.before });
    send(res, result);
  } catch (e) {
    next(e);
  }
});

router.post("/departures/:id/status", requireStaff(MANAGERS), async (req, res, next) => {
  try {
    const body = parseOr400(z.object({ status: z.enum(["ACTIVE", "CANCELLED"]), reason: z.string().trim().max(500).optional() }), req.body, res);
    if (!body) return;
    const result = await setDepartureStatus(id(req), body.status);
    if (result.status === 200) await audit(req, body.status === "CANCELLED" ? "CANCEL_DEPARTURE" : "REOPEN_DEPARTURE", "TourDeparture", id(req), { reason: body.reason ?? null, previous: result.previous });
    send(res, result);
  } catch (e) {
    next(e);
  }
});

// Passenger manifest for one departure: JSON for the printable page, or ?format=csv.
router.get("/departures/:id/manifest", async (req, res, next) => {
  try {
    const manifest = await getDepartureManifest(id(req));
    if (!manifest) return res.status(404).json({ success: false, error: "Departure not found" });
    await audit(req, req.query.format === "csv" ? "EXPORT_MANIFEST" : "VIEW_MANIFEST", "TourDeparture", manifest.departureId, {});
    res.setHeader("Cache-Control", "no-store");
    if (req.query.format === "csv") {
      const name = `manifest-${manifest.date}-${(manifest.departureTime ?? "").replace(":", "")}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
      return res.send("﻿" + manifestCsv(manifest));
    }
    res.json({ success: true, manifest });
  } catch (e) {
    next(e);
  }
});

// Pickup stops: every stop (turned-off ones too); changes are audited.
router.get("/pickup-stops", async (_req, res, next) => {
  try {
    res.json({ success: true, stops: await listStops() });
  } catch (e) {
    next(e);
  }
});

const stopSchema = z.object({
  name: z.string().trim().min(2).max(120),
  town: z.string().trim().min(2).max(60),
  address: z.string().trim().min(3).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  instructions: z.string().trim().max(1000).default(""),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
});

router.post("/pickup-stops", requireStaff(MANAGERS), async (req, res, next) => {
  try {
    const body = parseOr400(stopSchema, req.body, res);
    if (!body) return;
    const result = await createStop(body);
    if (result.status === 201) await audit(req, "CREATE_PICKUP_STOP", "ShuttleStop", result.stop.id, body);
    send(res, result);
  } catch (e) {
    next(e);
  }
});

router.patch("/pickup-stops/:id", requireStaff(MANAGERS), async (req, res, next) => {
  try {
    const body = parseOr400(stopSchema.partial().strict(), req.body, res);
    if (!body) return;
    const result = await updateStop(id(req), body);
    if (result.status !== 200) return send(res, result);
    const before = Object.fromEntries(Object.keys(body).map((k) => [k, result.before[k as keyof typeof result.before]]));
    await audit(req, "UPDATE_PICKUP_STOP", "ShuttleStop", result.stop.id, { changes: body, before });
    send(res, { status: 200, stop: result.stop });
  } catch (e) {
    next(e);
  }
});

// Admin only: audit log and staff list (no password hashes or tokens)
// Filters: action, entity (type and id), staff member, date range (Mountain Time days); newest
// first, 100 a page, `before` = the id of the last row shown.
const auditQuery = z.object({
  action: z.string().trim().max(60).optional(),
  entityType: z.string().trim().max(40).optional(),
  entityId: z.string().trim().max(200).optional(),
  userId: z.string().trim().max(64).optional(),
  q: z.string().trim().max(120).optional(),
  from: day.optional(),
  to: day.optional(),
  before: z.string().max(64).optional(),
});

function startOfMountainDay(value: string, plusDays = 0) {
  const d = dateOnly(value);
  d.setUTCDate(d.getUTCDate() + plusDays);
  return getMountainTimeInstant(d, timeOfDay("00:00"));
}

router.get("/audit-logs", requireStaff(["ADMIN"]), async (req, res, next) => {
  try {
    const q = parseOr400(auditQuery, req.query, res);
    if (!q) return;
    // A booking reference finds that booking's rows.
    const booking = q.q ? await prisma.booking.findFirst({ where: { bookingReference: { equals: q.q, mode: "insensitive" } }, select: { id: true } }) : null;
    const where = {
      ...(q.action ? { action: q.action } : {}),
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.entityId ? { entityId: q.entityId } : {}),
      ...(q.userId ? { userId: q.userId === "system" ? null : q.userId } : {}),
      ...(q.q ? { entityId: booking?.id ?? q.q } : {}),
      ...(q.from || q.to
        ? { createdAt: { ...(q.from ? { gte: startOfMountainDay(q.from) } : {}), ...(q.to ? { lt: startOfMountainDay(q.to, 1) } : {}) } }
        : {}),
    };
    const page = await prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 101,
      ...(q.before ? { cursor: { id: q.before }, skip: 1 } : {}),
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    const [actions, entityTypes, people] = q.before
      ? [[], [], []]
      : await Promise.all([
          prisma.auditLog.groupBy({ by: ["action"], _count: true, orderBy: { action: "asc" } }),
          prisma.auditLog.groupBy({ by: ["entityType"], _count: true, orderBy: { entityType: "asc" } }),
          prisma.user.findMany({ where: { auditLogs: { some: {} } }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
        ]);
    res.json({
      success: true,
      logs: page.slice(0, 100),
      next: page.length > 100 ? page[99].id : null,
      filters: { actions: actions.map((a) => a.action), entityTypes: entityTypes.map((e) => e.entityType), people },
    });
  } catch (e) {
    next(e);
  }
});

router.get("/staff", requireStaff(["ADMIN"]), async (_req, res, next) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: STAFF_LIST_ROLES as never } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, phone: true, role: true, lockedUntil: true, createdAt: true, resetTokenExpiry: true },
    });
    // "Invited" = has never chosen a password; the link itself is never sent back here.
    const invited = new Set(
      (await prisma.auditLog.findMany({ where: { action: "STAFF_INVITED", entityId: { in: staff.map((s) => s.id) } }, select: { entityId: true } })).map((a) => a.entityId),
    );
    const passwordSet = new Set(
      (await prisma.auditLog.findMany({ where: { action: "STAFF_PASSWORD_SET", entityId: { in: [...invited] } }, select: { entityId: true } })).map((a) => a.entityId),
    );
    res.json({
      success: true,
      staff: staff.map(({ resetTokenExpiry, ...s }) => ({ ...s, pendingInvite: invited.has(s.id) && !passwordSet.has(s.id), linkExpires: resetTokenExpiry })),
      emailConfigured: emailDeliveryConfigured(),
    });
  } catch (e) {
    next(e);
  }
});

const roleChange = z.object({ role: z.enum([...ASSIGNABLE_ROLES, "CUSTOMER"]) });
const INVITE_HOURS = 72;
const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

/**
 * A one-time "choose your password" link (the same token the password-reset page uses; only its
 * hash is stored). It is emailed when email is set up, and returned once to the admin so they can
 * pass it on themselves. It is never logged or written to the audit log.
 */
async function issueSetupLink(user: { id: string; email: string; name: string }, purpose: "invite" | "reset") {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + INVITE_HOURS * 60 * 60 * 1000);
  await prisma.user.update({ where: { id: user.id }, data: { resetToken: sha256(token), resetTokenExpiry: expires } });
  const link = `${siteUrl()}/reset-password?token=${token}`;
  let emailed = false;
  if (emailDeliveryConfigured()) {
    const name = user.name.replace(/[<>&]/g, "");
    const result = await getEmailProvider()
      .sendEmail({
        to: user.email,
        subject: purpose === "invite" ? "Your Vista Chase staff account" : "Set a new Vista Chase password",
        html: `<p>Hi ${name},</p><p>${purpose === "invite" ? "An account has been created for you on the Vista Chase dashboard." : "An admin asked for a new password link for you."} <a href="${link}">Choose your password</a>. The link works once and expires in ${INVITE_HOURS} hours.</p>`,
        text: `Choose your Vista Chase password: ${link}\nThe link works once and expires in ${INVITE_HOURS} hours.`,
      })
      .catch(() => ({ success: false }));
    emailed = !!result.success;
  }
  return { link, emailed, expires };
}

// Gives an account a staff role. With a name and no existing account, it creates the account
// (no password yet) and returns a one-time link for the person to choose their own password.
// Access follows the role from the next request; role CUSTOMER ends staff access at once.
router.post("/staff", requireStaff(["ADMIN"]), rateLimitMiddleware("staff_invite", { maxRequests: 30, windowSeconds: 3600 }), async (req, res, next) => {
  try {
    const body = parseOr400(
      z.object({ email: emailSchema, role: z.enum(ASSIGNABLE_ROLES), name: z.string().trim().min(2).max(80).optional() }).strict(),
      req.body,
      res,
    );
    if (!body) return;
    const existing = await prisma.user.findFirst({ where: { email: { equals: body.email, mode: "insensitive" } }, select: { id: true, role: true } });
    if (!existing) {
      if (!body.name) return res.status(404).json({ success: false, error: "No account uses this email. Add their name to create one and send an invite link." });
      // An unguessable hash nobody knows: the account can't be signed into until the link is used.
      const passwordHash = await hashPassword(crypto.randomBytes(32).toString("hex"));
      const user = await prisma.user.create({
        data: { email: body.email.toLowerCase(), name: body.name, role: body.role, passwordHash, emailVerified: false },
        select: { id: true, email: true, name: true, role: true },
      });
      await audit(req, "STAFF_INVITED", "User", user.id, { role: body.role, email: user.email });
      const setup = await issueSetupLink(user, "invite");
      return res.status(201).json({ success: true, user, invited: true, setupLink: setup.link, emailed: setup.emailed, linkExpires: setup.expires });
    }
    if (existing.id === staffId(req)) return res.status(400).json({ success: false, error: "You can't change your own role." });
    if (existing.role === "AFFILIATE") return res.status(400).json({ success: false, error: "This is a partner account. Use a separate account for staff work." });
    const user = await prisma.user.update({ where: { id: existing.id }, data: { role: body.role }, select: { id: true, email: true, name: true, role: true } });
    await audit(req, "CHANGE_ROLE", "User", user.id, { role: body.role, previous: existing.role });
    res.json({ success: true, user, invited: false });
  } catch (e) {
    next(e);
  }
});

// A fresh one-time password link for a staff member (lost invite, forgotten password).
router.post("/staff/:id/setup-link", requireStaff(["ADMIN"]), rateLimitMiddleware("staff_invite", { maxRequests: 30, windowSeconds: 3600 }), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: String(req.params.id) }, select: { id: true, email: true, name: true, role: true } });
    if (!user || !(STAFF_LIST_ROLES as string[]).includes(user.role)) return res.status(404).json({ success: false, error: "Staff account not found" });
    const setup = await issueSetupLink(user, "reset");
    await audit(req, "STAFF_SETUP_LINK_ISSUED", "User", user.id, { emailed: setup.emailed });
    res.json({ success: true, setupLink: setup.link, emailed: setup.emailed, linkExpires: setup.expires });
  } catch (e) {
    next(e);
  }
});

router.patch("/staff/:id", requireStaff(["ADMIN"]), async (req, res, next) => {
  try {
    const body = parseOr400(roleChange, req.body, res);
    if (!body) return;
    if (String(req.params.id) === (req as StaffRequest).staff.userId) return res.status(400).json({ success: false, error: "You can't change your own role." });
    const previous = await prisma.user.findUnique({ where: { id: String(req.params.id) }, select: { role: true } });
    if (!previous) return res.status(404).json({ success: false, error: "Account not found" });
    if (previous.role === "AFFILIATE") return res.status(400).json({ success: false, error: "This is a partner account; change it on the Partners page." });
    const user = await prisma.user.update({ where: { id: String(req.params.id) }, data: { role: body.role }, select: { id: true, email: true, role: true } });
    await audit(req, "CHANGE_ROLE", "User", user.id, { ...body, previous: previous.role });
    res.json({ success: true, user });
  } catch (e) {
    next(e);
  }
});

export default router;
