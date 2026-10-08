import prisma from "@/lib/db/prisma";
import { getEmailProvider } from "@/lib/email/email.provider";
import { dateOnly } from "@/lib/utils/time";

export interface EnquiryInput {
  name: string;
  email: string;
  phone?: string;
  tourSlug?: string;
  guests?: number;
  date?: string;
  message: string;
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Saves an enquiry and emails the team (reply-to the guest). The record is kept even if email fails. */
export async function createEnquiry(input: EnquiryInput) {
  const tour = input.tourSlug ? await prisma.tour.findUnique({ where: { slug: input.tourSlug }, select: { title: true } }) : null;
  const enquiry = await prisma.enquiry.create({
    data: { ...input, tourSlug: tour ? input.tourSlug : undefined, date: input.date ? dateOnly(input.date) : undefined },
  });

  const lines = [
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    input.phone ? `Phone: ${input.phone}` : null,
    tour ? `Tour: ${tour.title}` : null,
    input.date ? `Preferred date: ${input.date}` : null,
    input.guests ? `Guests: ${input.guests}` : null,
    "",
    input.message,
  ].filter((l): l is string => l !== null);

  await getEmailProvider()
    .sendEmail({
      to: process.env.ENQUIRIES_TO || "info@vistachase.com",
      subject: `${tour ? `Tour request: ${tour.title}` : "Website enquiry"} from ${input.name}`,
      text: lines.join("\n"),
      html: `<p>${lines.map(escape).join("<br>")}</p>`,
    })
    .catch((err) => console.error("[enquiries] email failed", err));

  return { id: enquiry.id };
}
