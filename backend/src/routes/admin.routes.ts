import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyToken } from "../lib/auth/auth";

const router = Router();
const prisma = new PrismaClient();

// Only ADMIN and DISPATCHER can access these routes
router.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);
  
  if (!payload || !["ADMIN", "DISPATCHER"].includes(payload.role)) {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  
  (req as any).user = payload;
  next();
});

// A1: Enquiry Inbox
router.get("/enquiries", async (req, res) => {
  try {
    const status = req.query.status as any;
    const enquiries = await prisma.enquiry.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" }
    });
    res.json(enquiries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/enquiries/:id", async (req, res) => {
  try {
    const enquiry = await prisma.enquiry.update({
      where: { id: req.params.id },
      data: { status: req.body.status }
    });

    await prisma.auditLog.create({
      data: {
        userId: (req as any).user.id,
        action: "UPDATE_ENQUIRY",
        entityType: "Enquiry",
        entityId: enquiry.id,
        details: { status: req.body.status }
      }
    });

    res.json(enquiry);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// A2: Booking Management
router.get("/bookings", async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        tourDeparture: { include: { tour: true } },
        customer: true,
      }
    });
    res.json(bookings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/bookings/:id", async (req, res) => {
  try {
    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: req.body
    });

    await prisma.auditLog.create({
      data: {
        userId: (req as any).user.id,
        action: "UPDATE_BOOKING_ADMIN",
        entityType: "Booking",
        entityId: booking.id,
        details: req.body
      }
    });

    res.json(booking);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// A3/A5: Staff Roles & Audit Logs
router.get("/audit-logs", async (req, res) => {
  try {
    if ((req as any).user.role !== "ADMIN") return res.status(403).json({ error: "Only ADMIN can view audit logs" });
    
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { id: true, name: true, email: true, role: true } } }
    });
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/staff", async (req, res) => {
  try {
    if ((req as any).user.role !== "ADMIN") return res.status(403).json({ error: "Only ADMIN can manage staff" });
    
    const staff = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "DISPATCHER", "OPERATOR", "AFFILIATE"] } },
      orderBy: { createdAt: "desc" }
    });
    res.json(staff);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
