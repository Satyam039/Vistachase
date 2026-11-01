// "Manage booking" (owner, 2026-11-01: a manage option in the email so the guest can change the
// date, name and so on later). Opened from the voucher page with the emailed signed link, or as
// the signed-in owner.
//
// - Lead guest name and phone: changed straight away (audit log + a note to staff). The email
//   address stays as booked: it is where the voucher link and any refund notice go.
// - Date or time: a request for staff, because moving a booking means checking seats on the new
//   departure, a possible price difference and the Bókun booking. It is raised as an OPEN "Other"
//   flag starting "Change request" (Admin → Bookings → Flags), and the guest and staff are emailed.
//   Nothing about the booking changes until staff move it.

import type { BookingStatus } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { z } from "@/lib/security/validate";
import { formatDateOnly } from "@/lib/utils/time";
import { guestEmail, opsEmail, titleOf } from "@/modules/admin/booking-requests";

const LIVE: BookingStatus[] = ["PENDING_PAYMENT", "CONFIRMED", "PAID_UNSYNCED"];
const CHANGE_PREFIX = "Change request";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const guestDetailsSchema = z.object({
  customerName: z.string().trim().min(2, "Enter the lead guest's full name").max(100).optional(),
  customerPhone: z
    .string()
    .trim()
    .min(6, "Enter a phone number we can reach on the day")
    .max(30)
    .regex(/^[+()\d\s.-]+$/, "Use digits, spaces and + ( ) - only")
    .optional(),
});

export const changeRequestSchema = z.object({
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  preferredTime: z.string().trim().max(40).default(""),
  note: z.string().trim().max(500).default(""),
});

type Refusal = { status: 400 | 404 | 409; error: string };

async function liveBooking(reference: string) {
  const booking = await prisma.booking.findUnique({
    where: { bookingReference: reference },
    include: { tourDeparture: { include: { tour: true, shuttleRoute: true } } },
  });
  const refuse = (status: Refusal["status"], error: string) => ({ booking: null, refusal: { status, error } as Refusal });
  if (!booking) return refuse(404, "Booking not found");
  if (!LIVE.includes(booking.status)) return refuse(409, "This booking can't be changed any more.");
  if (formatDateOnly(booking.tourDeparture.date) < new Date().toISOString().slice(0, 10)) return refuse(409, "This trip has already taken place.");
  return { booking, refusal: null };
}

/** Changes the lead guest's name and/or phone. */
export async function updateGuestDetails(
  reference: string,
  input: z.infer<typeof guestDetailsSchema>,
  userId: string | null,
): Promise<Refusal | { status: 200; changed: boolean; booking: { customerName: string; customerPhone: string } }> {
  const { booking, refusal } = await liveBooking(reference);
  if (!booking) return refusal!;
  const data: { customerName?: string; customerPhone?: string } = {};
  if (input.customerName && input.customerName !== booking.customerName) data.customerName = input.customerName;
  if (input.customerPhone && input.customerPhone !== booking.customerPhone) data.customerPhone = input.customerPhone;
  if (Object.keys(data).length === 0) return { status: 200, changed: false, booking: { customerName: booking.customerName, customerPhone: booking.customerPhone } } as const;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.booking.update({ where: { id: booking.id }, data, select: { customerName: true, customerPhone: true } });
    await tx.auditLog.create({
      data: {
        userId,
        action: "GUEST_DETAILS_CHANGED",
        entityType: "Booking",
        entityId: booking.id,
        details: { from: { customerName: booking.customerName, customerPhone: booking.customerPhone }, to: data },
      },
    });
    return row;
  });
  const changes = [
    data.customerName ? `name "${booking.customerName}" to "${data.customerName}"` : null,
    data.customerPhone ? `phone ${booking.customerPhone} to ${data.customerPhone}` : null,
  ]
    .filter(Boolean)
    .join(" and ");
  opsEmail(
    `Guest details changed ${booking.bookingReference}`,
    `The guest changed the ${changes} on ${booking.bookingReference} (${titleOf(booking)}, ${formatDateOnly(booking.tourDeparture.date)}). Update the Bókun booking by hand if it is there.`,
  );
  return { status: 200, changed: true, booking: updated } as const;
}

/** Asks staff to move the booking to another date (or time). One open request at a time. */
export async function requestDateChange(
  reference: string,
  input: z.infer<typeof changeRequestSchema>,
  userId: string | null,
): Promise<Refusal | { status: 201; request: { id: string; createdAt: Date } }> {
  const { booking, refusal } = await liveBooking(reference);
  if (!booking) return refusal!;
  if (input.newDate < new Date().toISOString().slice(0, 10)) return { status: 400, error: "Choose a date in the future." } as const;

  const current = formatDateOnly(booking.tourDeparture.date);
  const note = `${CHANGE_PREFIX}: move from ${current} to ${input.newDate}${input.preferredTime ? ` (${input.preferredTime})` : ""}${input.note ? `. Guest note: ${input.note}` : ""}.`;
  const flag = await prisma.$transaction(async (tx) => {
    const open = await tx.bookingFlag.findFirst({ where: { bookingId: booking.id, type: "OTHER", status: "OPEN", note: { startsWith: CHANGE_PREFIX } } });
    if (open) return null;
    const created = await tx.bookingFlag.create({ data: { bookingId: booking.id, type: "OTHER", note } });
    await tx.auditLog.create({
      data: { userId, action: "CHANGE_REQUESTED", entityType: "Booking", entityId: booking.id, details: { flagId: created.id, ...input, from: current } },
    });
    return created;
  });
  if (!flag) return { status: 409, error: "You've already asked to change this booking. We'll email you once it's been reviewed." } as const;

  const title = titleOf(booking);
  guestEmail(booking.customerEmail, `We received your change request: ${booking.bookingReference}`, "Change request received", [
    `Hi ${escapeHtml(booking.customerName)}, we received your request to move <strong>${booking.bookingReference}</strong> (${escapeHtml(title)}) from ${current} to <strong>${input.newDate}</strong>${input.preferredTime ? ` (${escapeHtml(input.preferredTime)})` : ""}.`,
    "Your booking stays as it is until our team confirms the new date and seats, usually within one business day. If the new date costs more or less, we'll tell you before anything changes.",
  ]);
  opsEmail(`Change request ${booking.bookingReference}`, `${booking.customerName} asked to move ${booking.bookingReference} (${title}) from ${current} to ${input.newDate}${input.preferredTime ? ` (${input.preferredTime})` : ""}${input.note ? `. Note: ${input.note}` : ""}. See Admin → Bookings → Flags.`);
  return { status: 201, request: { id: flag.id, createdAt: flag.createdAt } } as const;
}
