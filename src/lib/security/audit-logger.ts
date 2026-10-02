import prisma from "@/lib/db/prisma";

export interface LogAuditParams {
  userId?: string;
  action:
    | "HOLD_CREATED"
    | "HOLD_CONVERTED"
    | "BOOKING_CONFIRMED"
    | "BOOKING_CANCELLED"
    | "BOARDING_CHECKIN"
    | "CAPACITY_OVERRIDDEN"
    | "SECURITY_ALERT";
  entityType: "Booking" | "TourDeparture" | "ReservationHold" | "User" | "Security";
  entityId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAuditEvent(params: LogAuditParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: params.details ? JSON.stringify(params.details) : "{}",
        ipAddress: params.ipAddress,
      },
    });
  } catch (error) {
    console.error("Audit log error:", error);
    return null;
  }
}

export async function getAuditLogs(entityType?: string, limit: number = 50) {
  return await prisma.auditLog.findMany({
    where: entityType ? { entityType } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });
}
