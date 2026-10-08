// Staff admin API. Every route needs a staff session (the site's vc_token cookie, or a Bearer
// token for scripts); some need ADMIN. Inputs are validated, writes are limited to named fields
// and recorded in the audit log, and errors never echo internal messages.

import { Router, type Request, type Response, type NextFunction } from "express";
import prisma from "@/lib/db/prisma";
import { getAuthenticatedStaff } from "@/lib/auth/admin-guard";
import type { TokenPayload, UserRole } from "@/lib/auth/auth";
import { getAdminMetrics, getDispatchManifest, toggleBoardingStatus, updateDepartureCapacity } from "@/modules/admin/admin.repository";
import { getEmailProvider } from "@/lib/email/email.provider";
import { verifyBookingLink, voucherLink } from "@/lib/security/signed-links";
import { parseOr400, referenceSchema, z } from "@/lib/security/validate";
import { todayInMountainTime } from "@/lib/utils/time";

const router = Router();
type StaffRequest = Request & { staff: TokenPayload };

const STAFF: UserRole[] = ["ADMIN", "OPERATOR", "DISPATCHER"];

function requireStaff(roles: UserRole[] = STAFF) {
  return (req: Request, res: Response, next: NextFunction) => {
    const staff = getAuthenticatedStaff(req, roles);
    if (!staff) return res.status(403).json({ success: false, error: "Access denied. Staff privileges required." });
    (req as StaffRequest).staff = staff;
    next();
  };
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
  adminNotes: true, isBoarded: true, createdAt: true, bokunBookingId: true,
  tourDeparture: { select: { date: true, departureTime: true, tour: { select: { title: true } }, shuttleRoute: { select: { name: true } } } },
} as const;

router.get("/bookings", async (req, res, next) => {
  try {
    const q = parseOr400(z.object({ q: z.string().trim().max(120).optional(), status: z.string().max(20).optional() }), req.query, res);
    if (!q) return;
    const text = q.q;
    const bookings = await prisma.booking.findMany({
      where: {
        ...(q.status ? { status: q.status as never } : {}),
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

// Admin only: audit log and staff list (no password hashes or tokens)
router.get("/audit-logs", requireStaff(["ADMIN"]), async (_req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { id: true, name: true, email: true, role: true } } } });
    res.json({ success: true, logs });
  } catch (e) {
    next(e);
  }
});

router.get("/staff", requireStaff(["ADMIN"]), async (_req, res, next) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "DISPATCHER", "OPERATOR"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, phone: true, role: true, lockedUntil: true, createdAt: true },
    });
    res.json({ success: true, staff });
  } catch (e) {
    next(e);
  }
});

const roleChange = z.object({ role: z.enum(["ADMIN", "OPERATOR", "DISPATCHER", "CUSTOMER"]) });

router.patch("/staff/:id", requireStaff(["ADMIN"]), async (req, res, next) => {
  try {
    const body = parseOr400(roleChange, req.body, res);
    if (!body) return;
    if (String(req.params.id) === (req as StaffRequest).staff.userId) return res.status(400).json({ success: false, error: "You can't change your own role." });
    const user = await prisma.user.update({ where: { id: String(req.params.id) }, data: { role: body.role }, select: { id: true, email: true, role: true } });
    await audit(req, "CHANGE_ROLE", "User", user.id, body);
    res.json({ success: true, user });
  } catch (e) {
    next(e);
  }
});

export default router;
