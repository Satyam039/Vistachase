import { getBokunOperationsProvider } from "@/modules/bokun/bokun.provider";
import { getMountainTimeInstant } from "@/lib/utils/time";
import prisma from "@/lib/db/prisma";
import QRCode from "qrcode";
import { getPaymentProvider } from "@/lib/payment/payment.provider";
import { getEmailProvider } from "@/lib/email/email.provider";
import { fareSubtotal, isVehicleDeparture, partySizeError, seatsToReserve } from "@/modules/pricing/departure-pricing";
import { findActiveAffiliateByCode } from "@/modules/affiliates/affiliate.repository";

export interface BookingAddOnInput {
  name: string;
  price: number;
  quantity: number;
}

export interface CreateBookingInput {
  holdToken?: string;
  departureId: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupStopId?: string;
  pickupCustomText?: string;
  pickupTime?: string;
  adultsCount: number;
  childrenCount: number;
  infantsCount: number;
  specialRequests?: string;
  addOns?: BookingAddOnInput[];
  paymentProvider?: "mock" | "stripe";
  promoCode?: string;
  /** Referral code from the vc_ref cookie; credited only to an ACTIVE partner. */
  affiliateCode?: string;
}

export interface BookingResult {
  success: boolean;
  booking?: {
    id: string;
    bookingReference: string;
    voucherCode: string;
    totalAmount: number;
    currency: string;
    status: string;
    qrCodeUrl: string | null;
  };
  error?: string;
}

export async function createBooking(input: CreateBookingInput): Promise<BookingResult> {
  const totalSeats = input.adultsCount + input.childrenCount;
  const paymentProvider = getPaymentProvider();
  const emailProvider = getEmailProvider();

  // 1. Execute booking transaction
  const result = await prisma.$transaction(async (tx) => {
    let holdRecord = null;
    if (input.holdToken) {
      holdRecord = await tx.reservationHold.findUnique({
        where: { holdToken: input.holdToken },
      });

      if (!holdRecord || holdRecord.status !== "ACTIVE" || holdRecord.expiresAt < new Date()) {
        return { success: false, error: "Reservation hold expired. Please select your seats again." };
      }
      if (holdRecord.tourDepartureId !== input.departureId) {
        return { success: false, error: "This reservation hold is for a different departure." };
      }
    }

    const departure = await tx.tourDeparture.findUnique({
      where: { id: input.departureId },
      include: {
        tour: true,
        shuttleRoute: true,
      },
    });

    if (!departure) {
      return { success: false, error: "Departure not found" };
    }

    const partyError = partySizeError(departure, totalSeats);
    if (partyError) {
      return { success: false, error: partyError };
    }

    // Capacity verification: shared departures take one seat per guest, private ones the whole vehicle
    const isVehicle = isVehicleDeparture(departure);
    const reservedSeats = seatsToReserve(departure, totalSeats);
    const currentHeldByOthers = holdRecord
      ? Math.max(0, departure.capacityHeld - holdRecord.seatsCount)
      : departure.capacityHeld;
    const realAvailable = departure.capacityTotal - (departure.capacityBooked + currentHeldByOthers);

    if (realAvailable < reservedSeats) {
      return {
        success: false,
        error: isVehicle
          ? "This private vehicle is already booked for this departure."
          : `Requested ${totalSeats} seats, but only ${Math.max(0, realAvailable)} seats are available.`,
      };
    }

    // Price calculation: per guest for shared departures, per vehicle for private ones
let discountPercent = 0;
    if (input.promoCode) {
      const code = input.promoCode.toUpperCase();
      if (code === "RIMROCKBANFF5") discountPercent = 5;
      else if (code === "TESTVISTA100") discountPercent = 100;
      else if (code === "BANFF10") discountPercent = 10;
    }

    const subtotal = fareSubtotal(departure, totalSeats);
    const discountAmount = Math.round(subtotal * (discountPercent / 100));
    const addOnsTotal = (input.addOns || []).reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
    const tax = Math.round((subtotal - discountAmount + addOnsTotal) * 0.05 * 100) / 100; // 5% GST Alberta
    const totalAmount = Math.round((subtotal - discountAmount + addOnsTotal + tax) * 100) / 100;

    // References
    const crypto = require("crypto");
    const randSuffix = crypto.randomBytes(4).toString("hex").toUpperCase();
    const bookingReference = `VC-${new Date().getFullYear()}-${randSuffix}`;
    const voucherCode = `VOUCH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

// Generate signed check-in token for QR
    const hmac = crypto.createHmac("sha256", process.env.JWT_SECRET || "super-secret");
    hmac.update(bookingReference);
    const signature = hmac.digest("hex");
    
    // Generate QR code data URL (points to admin check-in page)
    const checkinUrl = `https://vistachase.com/admin/checkin?ref=${bookingReference}&sig=${signature}`;
    const qrDataUrl = await QRCode.toDataURL(checkinUrl);

    // Create Booking

    const bokunProvider = getBokunOperationsProvider();
    
    // B5: Reserve in Bókun first
    let bokunBookingId = "pending_sync";
    if (departure.tour?.bokunId) {
      const departureDateStr = departure.date.toISOString().split("T")[0];
      const departureTimeStr = departure.departureTime.toISOString().split("T")[1].substring(0, 5);
      try {
        const reserveRes = await bokunProvider.createReservation({
          bokunBookingId: "",
          bookingReference,
          productBokunId: departure.tour.bokunId,
          departureDate: departureDateStr,
          departureTime: departureTimeStr,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone || "",
          totalSeats: totalSeats,
          pickupLocation: input.pickupCustomText || input.pickupStopId || "",
          status: "CONFIRMED",
          totalAmount: totalAmount,
          currency: "CAD",
          sourceChannel: "WEBSITE",
          promoCode: input.promoCode,
          specialRequests: input.specialRequests
        });
        bokunBookingId = reserveRes.bokunBookingId;
      } catch (e: any) {
        throw new Error("Failed to reserve seats in Bókun: " + e.message);
      }
    }

    const booking = await tx.booking.create({
      data: {
        bokunBookingId: bokunBookingId,
        bookingReference,
        customerId: input.customerId,
        affiliateId: (await findActiveAffiliateByCode(input.affiliateCode))?.id ?? null,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        tourDepartureId: input.departureId,
        pickupStopId: input.pickupStopId,
        pickupCustomText: input.pickupCustomText,
        pickupTime: input.pickupTime,
        adultsCount: input.adultsCount,
        childrenCount: input.childrenCount,
        infantsCount: input.infantsCount,
        totalSeats,
        subtotal: Math.round(subtotal * 100),
        tax: Math.round(tax * 100),
        addOnsTotal: Math.round(addOnsTotal * 100),
        totalAmount: Math.round(totalAmount * 100),
        currency: departure.currency,
        status: "CONFIRMED",
        specialRequests: input.specialRequests,
        voucherCode,
        qrCodeUrl: qrDataUrl,
        items: {
          create: (input.addOns || []).map((addon) => ({
            name: addon.name,
            price: addon.price,
            quantity: addon.quantity,
          })),
        },
      },
    });

    // Update Departure Capacity
    if (holdRecord) {
      await tx.reservationHold.update({
        where: { id: holdRecord.id },
        data: { status: "CONVERTED" },
      });
      await tx.tourDeparture.update({
        where: { id: input.departureId },
        data: {
          capacityBooked: { increment: reservedSeats },
          capacityHeld: { decrement: holdRecord.seatsCount },
        },
      });
    } else {
      await tx.tourDeparture.update({
        where: { id: input.departureId },
        data: {
          capacityBooked: { increment: reservedSeats },
        },
      });
    }

    // Process payment via payment abstraction
    const intent = await paymentProvider.createPaymentIntent({
      amount: Math.round(totalAmount * 100),
      currency: departure.currency,
      bookingReference,
      customerEmail: input.customerEmail,
    });
    const confirm = await paymentProvider.confirmPayment(intent.intentId);

    await tx.payment.create({
      data: {
        bookingId: booking.id,
        amount: totalAmount,
        currency: departure.currency,
        provider: input.paymentProvider || "mock",
        transactionId: confirm.transactionId,
        status: confirm.status === "succeeded" ? "SUCCEEDED" : "PENDING",
      },
    });

    return {
      success: true,
      booking: {
        id: booking.id,
        bookingReference: booking.bookingReference,
        voucherCode: booking.voucherCode,
        totalAmount: booking.totalAmount / 100,
        currency: booking.currency,
        status: booking.status,
        qrCodeUrl: booking.qrCodeUrl,
      },
      tourTitle: departure.tour?.title || departure.shuttleRoute?.name || "Rockies Tour",
      date: departure.date,
      time: departure.departureTime,
    };
  });

  if (result.success && result.booking) {
    // Send confirmation email asynchronously via Email Provider
    emailProvider.sendEmail({
      to: input.customerEmail,
      subject: `Vista Chase Booking Confirmed: ${result.booking.bookingReference}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #072019;">
          <h2 style="color: #0f382c;">Your Canadian Rockies Journey is Confirmed!</h2>
          <p>Thank you for choosing <strong>Vista Chase</strong>, Banff's premier tour and shuttle operator.</p>
          <div style="background: #f0faf7; border: 1px solid #c89b3c; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p><strong>Booking Reference:</strong> ${result.booking.bookingReference}</p>
            <p><strong>Digital Voucher Code:</strong> ${result.booking.voucherCode}</p>
            <p><strong>Experience:</strong> ${result.tourTitle}</p>
            <p><strong>Date & Time:</strong> ${result.date} at ${result.time}</p>
            <p><strong>Total Paid:</strong> $${result.booking.totalAmount.toFixed(2)} ${result.booking.currency}</p>
          </div>
          <p>You can view and present your mobile boarding pass voucher at:</p>
          <p><a href="${process.env.FRONTEND_URL || "https://www.vistachase.com"}/booking/${result.booking.bookingReference}/voucher" style="color: #c89b3c; font-weight: bold;">View Digital Boarding Pass Voucher</a></p>
        </div>
      `,
    }).catch((e) => console.error("Email send error:", e));
  }

  return result;
}

export async function getBookingByReference(reference: string) {
  return await prisma.booking.findUnique({
    where: { bookingReference: reference },
    include: {
      tourDeparture: {
        include: {
          tour: true,
          shuttleRoute: true,
        },
      },
      pickupStop: true,
      items: true,
      payments: true,
      review: true,
    },
  });
}

export async function cancelBooking(reference: string, customerEmail?: string) {
  const emailProvider = getEmailProvider();

  return await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { bookingReference: reference },
      include: {
        tourDeparture: {
          include: {
            tour: true,
            shuttleRoute: true,
          },
        },
      },
    });

    if (!booking) {
      return { success: false, error: "Booking reference not found" };
    }

    if (!customerEmail || booking.customerEmail.toLowerCase() !== customerEmail.toLowerCase()) {
      return { success: false, error: "Unauthorized: Booking belongs to another account or email not provided" };
    }

    if (booking.status === "CANCELLED") {
      return { success: false, error: "Booking is already cancelled" };
    }

    // Cancellation policy (vistachase.com legal terms): cancel at least 72 hours before departure.
    // 1–6 guests: full refund. 7+ guests and multi-day: refund minus the 20% non-refundable deposit.
    const departureDateTime = getMountainTimeInstant(booking.tourDeparture.date, booking.tourDeparture.departureTime as any);
    const now = new Date();
    const hoursDifference = (departureDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursDifference < 72) {
      return {
        success: false,
        error: `Cancellation window closed. Bookings can be cancelled for a refund up to 72 hours before departure. This departure is in ${Math.max(0, Math.round(hoursDifference))} hours.`,
      };
    }

    // Mark as CANCELLED
    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    });

    // Release capacity: the guests' seats, or the whole vehicle for a private departure
    const releasedSeats = Math.min(
      booking.tourDeparture.capacityBooked,
      seatsToReserve(booking.tourDeparture, booking.totalSeats)
    );
    await tx.tourDeparture.update({
      where: { id: booking.tourDepartureId },
      data: {
        capacityBooked: { decrement: releasedSeats },
      },
    });

// B6: Cancel in Bokun
    const bokunProvider = getBokunOperationsProvider();
    if (booking.bokunBookingId && booking.bokunBookingId !== "pending_sync") {
      await bokunProvider.cancelBooking(booking.bokunBookingId).catch(e => console.error("Bókun cancel error:", e));
    }

    // P5: Process Refund
    const paymentProvider = getPaymentProvider();
    const payments = await tx.payment.findMany({ where: { bookingId: booking.id, status: "SUCCEEDED" } });
    for (const payment of payments) {
      let refundAmount = payment.amount;
      // 1-6 guests: full refund. 7+ guests: minus 20% deposit
      if (booking.totalSeats >= 7) {
        refundAmount = Math.round(payment.amount * 0.8);
      }
      
      const refundResult = await paymentProvider.refundPayment(payment.transactionId, refundAmount);
      if (refundResult.success) {
         await tx.booking.update({ where: { id: booking.id }, data: { status: "REFUNDED" }});
      }
    }

    // Send cancellation notice
    emailProvider.sendEmail({
      to: booking.customerEmail,
      subject: `Vista Chase Cancellation Confirmation: ${booking.bookingReference}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #072019;">
          <h2 style="color: #991b1b;">Reservation Cancelled</h2>
          <p>Your booking <strong>${booking.bookingReference}</strong> for <strong>${booking.tourDeparture.tour?.title || "Vista Chase Rockies Tour"}</strong> on ${booking.tourDeparture.date} has been cancelled under our 72-hour cancellation policy.</p>
          <p>Bookings of 1–6 guests are refunded in full. For groups of 7 or more and multi-day trips, the 20% deposit is non-refundable and the rest is refunded. Approved refunds reach your original payment method within 5–10 business days.</p>
          <p>Questions? Email support@vistachase.com or call +1 (825) 734-9456 (6 a.m. – 9 p.m. Mountain Time).</p>
        </div>
      `,
    }).catch((e) => console.error("Cancellation email error:", e));

    return {
      success: true,
      booking: updated,
      message: "Reservation successfully cancelled and capacity released.",
    };
  });
}

export async function getCustomerBookings(customerEmail: string) {
  return await prisma.booking.findMany({
    where: { customerEmail },
    include: {
      tourDeparture: {
        include: {
          tour: true,
          shuttleRoute: true,
        },
      },
      pickupStop: true,
      review: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
