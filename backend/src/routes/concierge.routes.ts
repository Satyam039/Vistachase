import { Router } from "express";
import { getAIProvider, ChatMessage } from "@/lib/ai/ai.provider";
import { getMapsProvider } from "@/lib/maps/maps.provider";
import { createReservationHold } from "@/modules/reservations/reservation.repository";
import prisma from "@/lib/db/prisma";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const messages: ChatMessage[] = req.body?.messages || [];

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid messages array." });
    }

    const aiProvider = getAIProvider();
    const mapsProvider = getMapsProvider();

    // 1. Send chat to AI provider (with built-in credit card refusal guardrail)
    const response = await aiProvider.chat(messages);

    let attachedData: Record<string, unknown> | null = null;
    let checkoutUrl: string | null = null;
    let holdToken: string | null = null;

    // 2. Execute safe backend actions if tool calls were requested
    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const call of response.toolCalls) {
        if (call.name === "findPickup") {
          const q = (call.arguments.query as string) || "Banff";
          const stops = await mapsProvider.searchPickups(q);
          attachedData = { type: "pickups", stops: stops.slice(0, 5) };
        } else if (call.name === "checkAvailability") {
          const departures = await prisma.tourDeparture.findMany({
            where: {
              status: "SCHEDULED",
            },
            include: {
              tour: true,
              shuttleRoute: true,
            },
            take: 4,
            orderBy: { date: "asc" },
          });

          attachedData = {
            type: "availability",
            departures: departures.map((d) => ({
              id: d.id,
              date: d.date,
              departureTime: d.departureTime,
              title: d.tour?.title || d.shuttleRoute?.name,
              price: d.price,
              currency: d.currency,
              availableSeats: Math.max(0, d.capacityTotal - (d.capacityBooked + d.capacityHeld)),
            })),
          };
        } else if (call.name === "createVoiceReservationHold") {
          // Find first available scheduled departure
          const departure = await prisma.tourDeparture.findFirst({
            where: {
              status: "SCHEDULED",
            },
            include: { tour: true, shuttleRoute: true },
          });

          if (departure) {
            const seatsToHold = 2; // Default party of 2 for concierge voice holds
            const holdResult = await createReservationHold({
              departureId: departure.id,
              seatsCount: seatsToHold,
              customerName: "Concierge Guest",
              customerEmail: "concierge.guest@vistachase.com",
            });

            if (holdResult.success && holdResult.holdToken) {
              holdToken = holdResult.holdToken;
              checkoutUrl = `/book?departureId=${departure.id}&holdToken=${holdResult.holdToken}&seats=${seatsToHold}`;
              attachedData = {
                type: "hold",
                holdToken: holdResult.holdToken,
                expiresAt: holdResult.expiresAt,
                departure: {
                  id: departure.id,
                  title: departure.tour?.title || departure.shuttleRoute?.name,
                  date: departure.date,
                  departureTime: departure.departureTime,
                  seats: seatsToHold,
                },
                checkoutUrl,
              };
            }
          }
        }
      }
    }

    return res.json({
      success: true,
      message: response.message,
      hasSafetyRefusal: response.hasSafetyRefusal || false,
      toolCalls: response.toolCalls,
      data: attachedData,
      checkoutUrl,
      holdToken,
    });
  } catch (error) {
    console.error("Concierge API error:", error);
    return res.status(500).json({ error: "Failed to communicate with Concierge." });
  }
});

export default router;
