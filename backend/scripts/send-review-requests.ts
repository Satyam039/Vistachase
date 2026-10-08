import { PrismaClient } from "@prisma/client";
import { getEmailProvider } from "../src/lib/email/email.provider";

const prisma = new PrismaClient();

export async function sendPostTripReviewRequests() {
  const emailProvider = getEmailProvider();
  console.log("Checking for completed trips to send review requests...");

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const departures = await prisma.tourDeparture.findMany({
    where: { date: yesterdayStr, status: { not: "CANCELLED" } },
    include: {
      bookings: {
        where: { status: { in: ["CONFIRMED", "COMPLETED"] } }
      },
      tour: true
    }
  });

  let sent = 0;
  for (const dep of departures) {
    for (const booking of dep.bookings) {
      // Check if review already requested (in a real system we'd track this in the DB)
      // For now, we just send it.
      
      const tourTitle = dep.tour?.title || "Vista Chase Canadian Rockies";
      const subject = `How was your trip to ${tourTitle}?`;
      
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #072019; text-align: center;">
          <h2>We'd love to hear from you!</h2>
          <p>Hi ${booking.customerName},</p>
          <p>We hope you had a fantastic time yesterday on the <strong>${tourTitle}</strong>.</p>
          <p>As a small local business, your feedback means the world to us. If you enjoyed your experience, please take a minute to leave us a review.</p>
          <a href="https://vistachase.com/review/${booking.bookingReference}" style="display: inline-block; background-color: #072019; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 15px;">Leave a Review</a>
          <p style="font-size: 12px; color: #64748b; margin-top: 30px;">
            Vista Chase | Banff, Alberta<br/>
            Canadian Anti-Spam Legislation (CASL) compliance active. You received this because you recently traveled with us.
          </p>
        </div>
      `;

      await emailProvider.sendEmail({
        to: booking.customerEmail,
        subject,
        html,
        text: `Hi ${booking.customerName}, we hope you enjoyed ${tourTitle}. Please leave a review at https://vistachase.com/review/${booking.bookingReference}`
      }).catch(console.error);

      // Mark booking as completed if not already
      if (booking.status === "CONFIRMED") {
        await prisma.booking.update({ where: { id: booking.id }, data: { status: "COMPLETED" }});
      }

      sent++;
    }
  }

  console.log(`Sent ${sent} review requests.`);
}


