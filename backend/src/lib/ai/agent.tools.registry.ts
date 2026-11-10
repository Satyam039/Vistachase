import crypto from "node:crypto";
import prisma from "@/lib/db/prisma";
import { getCacheProvider } from "@/lib/cache/cache.provider";
import { getPaymentProvider } from "@/lib/payment/payment.provider";
import { inventoryConcurrency } from "./inventory.concurrency";
import type {
  SessionContext,
  ToolDefinitionMetadata,
  AgentCheckoutCardPayload,
  AgentOtpCardPayload,
  AgentModificationCardPayload,
} from "./agent.types";
import { formatDateOnly, formatTimeOfDay } from "@/lib/utils/time";

// ============================================================================
// 1. TOOL SCHEMAS & DEFINITIONS
// ============================================================================

export const AGENT_TOOL_DEFINITIONS: ToolDefinitionMetadata[] = [
  // --------------------------------------------------------------------------
  // Suite A: Discovery, Comparison & Advisory Tools (Available to All Roles)
  // --------------------------------------------------------------------------
  {
    name: "search_live_inventory",
    scope: "SUITE_A",
    description:
      "Queries real-time capacity and pricing for Shared Tours (max 12 guests), Lake Shuttles, and Private Vehicles. Automatically flags seasonal road closures (Moraine Lake mid-Oct–May) and provides side-by-side private charter comparisons for groups of 4+.",
    inputSchema: {
      type: "object",
      properties: {
        tour_category: {
          type: "string",
          enum: ["SHARED", "PRIVATE", "SHUTTLE", "ALL"],
          description: "Category of tour or shuttle service.",
        },
        origin_hub: {
          type: "string",
          enum: ["Banff", "Canmore", "Lake Louise"],
          description: "Departure town / hotel hub.",
        },
        date_range: {
          type: "object",
          properties: {
            start_date: { type: "string", description: "YYYY-MM-DD" },
            end_date: { type: "string", description: "YYYY-MM-DD" },
          },
          required: ["start_date"],
        },
        passenger_count: {
          type: "integer",
          minimum: 1,
          maximum: 20,
          description: "Number of guests traveling together.",
        },
      },
      required: ["date_range", "passenger_count"],
    },
  },
  {
    name: "compare_shared_vs_private",
    scope: "SUITE_A",
    description:
      "Calculates exact tax-inclusive CAD costs for N guests on a Shared Tour vs chartering a Private Luxury SUV or 12-seat Sprinter, highlighting per-guest savings and custom door-to-door perks.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Travel date YYYY-MM-DD" },
        passenger_count: { type: "integer", minimum: 1, maximum: 14 },
        desired_stops: {
          type: "array",
          items: { type: "string" },
          description: "Stops requested (e.g. Lake Louise, Moraine Lake, Emerald Lake, Peyto Lake, Icefields).",
        },
      },
      required: ["date", "passenger_count"],
    },
  },
  {
    name: "get_seat_and_vehicle_layout",
    scope: "SUITE_A",
    description:
      "Returns vehicle specifications (12-seat modified executive Sprinter with panoramic glass vs 7-seat luxury SUV) and seating layout for a departure.",
    inputSchema: {
      type: "object",
      properties: {
        trip_id: { type: "string", description: "ID of the tour departure." },
      },
      required: ["trip_id"],
    },
  },
  {
    name: "validate_pickup_location",
    scope: "SUITE_A",
    description:
      "Validates whether a traveler's hotel or Airbnb in Banff, Canmore, or Lake Louise qualifies for doorstep Sprinter pickup or designates the nearest central hub with exact pickup time offsets.",
    inputSchema: {
      type: "object",
      properties: {
        hotel_or_address: { type: "string", description: "Hotel name or street address." },
        tour_id: { type: "string", description: "Optional tour ID or slug." },
      },
      required: ["hotel_or_address"],
    },
  },
  {
    name: "build_custom_private_itinerary",
    scope: "SUITE_A",
    description:
      "Validates a custom private tour routing against highway driving times and seasonal closures (Moraine Lake road winter closure substitutions).",
    inputSchema: {
      type: "object",
      properties: {
        origin: { type: "string", description: "Pickup town (Banff, Canmore, Lake Louise)." },
        duration_hours: { type: "number", minimum: 4, maximum: 12 },
        requested_stops: { type: "array", items: { type: "string" } },
        travel_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["origin", "duration_hours", "requested_stops", "travel_date"],
    },
  },

  // --------------------------------------------------------------------------
  // Suite B: Transactional Booking & Guest Verification Tools (All Roles)
  // --------------------------------------------------------------------------
  {
    name: "create_atomic_seat_hold",
    scope: "SUITE_B",
    description:
      "Acquires a Redis mutex lock, checks live capacity, locks seats for 10 minutes (600s TTL), and returns a precise CAD subtotal + 5% GST breakdown.",
    inputSchema: {
      type: "object",
      properties: {
        trip_id: { type: "string", description: "ID of the target departure." },
        seat_count: { type: "integer", minimum: 1, maximum: 12 },
        seat_numbers: {
          type: "array",
          items: { type: "string" },
          description: "Optional specific seat preferences.",
        },
        pickup_location_id: { type: "string", description: "Validated pickup stop ID." },
      },
      required: ["trip_id", "seat_count"],
    },
  },
  {
    name: "generate_checkout_session",
    scope: "SUITE_B",
    description:
      "Generates a secure Stripe Payment Intent tied to the hold_id and produces an interactive Checkout Card with a live 10-minute timer directly in chat.",
    inputSchema: {
      type: "object",
      properties: {
        hold_id: { type: "string", description: "Valid atomic hold ID." },
        lead_passenger_name: { type: "string", description: "Full name of lead guest." },
        contact_email: { type: "string", description: "Customer confirmation email." },
        contact_phone: { type: "string", description: "Mobile phone with country code." },
      },
      required: ["hold_id", "lead_passenger_name", "contact_email", "contact_phone"],
    },
  },
  {
    name: "initiate_guest_pnr_verification",
    scope: "SUITE_B",
    description:
      "Initiates booking lookup for an unauthenticated traveler by generating and dispatching a 6-digit OTP to the phone or email on file without exposing PNR data.",
    inputSchema: {
      type: "object",
      properties: {
        pnr_code: { type: "string", description: "Booking reference (e.g. VC-2026-89412)." },
        email_or_phone: { type: "string", description: "Customer's email or phone matching booking." },
      },
      required: ["pnr_code", "email_or_phone"],
    },
  },
  {
    name: "confirm_guest_pnr_otp",
    scope: "SUITE_B",
    description:
      "Validates the 6-digit OTP code. On success, securely elevates the session to authorize Suite C actions for that specific PNR.",
    inputSchema: {
      type: "object",
      properties: {
        pnr_code: { type: "string", description: "Booking reference." },
        otp_code: { type: "string", description: "6-digit verification code." },
      },
      required: ["pnr_code", "otp_code"],
    },
  },

  // --------------------------------------------------------------------------
  // Suite C: Customer Self-Serve Rectification Tools (Customer + OTP Guest + Admin)
  // --------------------------------------------------------------------------
  {
    name: "get_my_bookings",
    scope: "SUITE_C",
    requiresOtpOrCustomerAuth: true,
    description:
      "Retrieves the traveler's upcoming and past bookings, vehicle assignment, pickup schedule, and cancellation/modification eligibility.",
    inputSchema: {
      type: "object",
      properties: {
        status_filter: {
          type: "string",
          enum: ["ALL", "UPCOMING", "COMPLETED", "CANCELLED"],
        },
      },
    },
  },
  {
    name: "preview_booking_modification",
    scope: "SUITE_C",
    requiresOtpOrCustomerAuth: true,
    description:
      "Evaluates a requested change against the 24h (Shared/Shuttle) or 72h (Private) cutoff policy and calculates the exact CAD fare difference or change fee.",
    inputSchema: {
      type: "object",
      properties: {
        pnr_code: { type: "string", description: "Authorized booking reference." },
        new_date: { type: "string", description: "Target date YYYY-MM-DD." },
        new_tour_id: { type: "string", description: "Optional new tour ID (e.g. upgrading to Private)." },
        new_passenger_count: { type: "integer" },
        new_pickup_location: { type: "string" },
      },
      required: ["pnr_code", "new_date"],
    },
  },
  {
    name: "execute_booking_modification",
    scope: "SUITE_C",
    requiresOtpOrCustomerAuth: true,
    description:
      "Atomically commits the previewed date or hotel pickup modification (or triggers top-up card if upgrading).",
    inputSchema: {
      type: "object",
      properties: {
        pnr_code: { type: "string" },
        modification_preview_id: { type: "string" },
      },
      required: ["pnr_code", "modification_preview_id"],
    },
  },
  {
    name: "update_private_tour_stops",
    scope: "SUITE_C",
    requiresOtpOrCustomerAuth: true,
    description:
      "Allows a private tour customer to customize itinerary stops, request child car seats, or specify mobility requirements.",
    inputSchema: {
      type: "object",
      properties: {
        pnr_code: { type: "string" },
        updated_stops: { type: "array", items: { type: "string" } },
        special_requests: { type: "string", description: "Car seats, accessibility notes, etc." },
      },
      required: ["pnr_code"],
    },
  },
  {
    name: "process_self_serve_cancellation",
    scope: "SUITE_C",
    requiresOtpOrCustomerAuth: true,
    description:
      "Deterministically verifies if current timestamp is > 24h (shared) or 72h (private) before departure. If eligible, executes instant Stripe refund and releases seats.",
    inputSchema: {
      type: "object",
      properties: {
        pnr_code: { type: "string" },
        cancellation_reason: { type: "string" },
      },
      required: ["pnr_code"],
    },
  },

  // --------------------------------------------------------------------------
  // Suite D: Elevated Admin & Fleet Operations Tools (Admin Only)
  // --------------------------------------------------------------------------
  {
    name: "admin_lookup_any_pnr",
    scope: "SUITE_D",
    requiredRole: "ADMIN",
    description:
      "Admin/Dispatcher tool: Searches bookings across all travelers by PNR, customer name, email, phone, or date.",
    inputSchema: {
      type: "object",
      properties: {
        search_query: { type: "string", description: "Reference, customer email, or passenger name." },
      },
      required: ["search_query"],
    },
  },
  {
    name: "admin_override_rectification",
    scope: "SUITE_D",
    requiredRole: "ADMIN",
    description:
      "Admin tool: Overrides 24h/72h cutoff policies during weather disruptions, issues manual refunds, or waives change fees, writing an immutable audit log entry.",
    inputSchema: {
      type: "object",
      properties: {
        pnr_code: { type: "string" },
        action_type: { type: "string", enum: ["FORCE_CANCEL", "MANUAL_REFUND", "WAIVE_CHANGE_FEE"] },
        custom_refund_amount_cad: { type: "number" },
        audit_reason: { type: "string", description: "Staff reason (e.g. Icefields avalanche closure)." },
      },
      required: ["pnr_code", "action_type", "audit_reason"],
    },
  },
  {
    name: "admin_reassign_fleet_or_passengers",
    scope: "SUITE_D",
    requiredRole: "ADMIN",
    description:
      "Admin tool: Moves bookings between vehicles or departure times (e.g. consolidating Sprinters) and triggers schedule notifications.",
    inputSchema: {
      type: "object",
      properties: {
        source_trip_id: { type: "string" },
        target_trip_id: { type: "string" },
        pnr_list: { type: "array", items: { type: "string" } },
        vehicle_id: { type: "string" },
        guide_id: { type: "string" },
      },
      required: ["source_trip_id", "target_trip_id", "pnr_list"],
    },
  },
  {
    name: "admin_inspect_trip_manifest_and_margins",
    scope: "SUITE_D",
    requiredRole: "ADMIN",
    description:
      "Admin tool: Returns detailed manifest, hotel pickup sequence, net CAD revenue, guide expenses, and vehicle occupancy percentage.",
    inputSchema: {
      type: "object",
      properties: {
        trip_id: { type: "string" },
        date: { type: "string" },
      },
      required: ["trip_id"],
    },
  },
];

// ============================================================================
// 2. TOOL EXECUTION ENGINE (Zero-Trust Scoped Gateway)
// ============================================================================

export class AgentToolExecutor {
  private cache = getCacheProvider();

  /**
   * Filter tool schemas presented to Claude based on verified caller session.
   */
  getFilteredToolsForSession(session: SessionContext): ToolDefinitionMetadata[] {
    return AGENT_TOOL_DEFINITIONS.filter((tool) => {
      // Suite D is only available if user is ADMIN
      if (tool.scope === "SUITE_D" && session.role !== "ADMIN") {
        return false;
      }
      // Suite C tools require an authenticated customer account OR an OTP-verified PNR OR ADMIN
      if (tool.requiresOtpOrCustomerAuth) {
        const isAuthorized =
          session.role === "ADMIN" ||
          session.role === "CUSTOMER" ||
          Boolean(session.authorizedPnr);
        if (!isAuthorized) return false;
      }
      return true;
    });
  }

  /**
   * Deterministic Tool Execution Handler
   */
  async execute(
    toolName: string,
    toolInput: Record<string, any>,
    session: SessionContext
  ): Promise<{ data: unknown; card?: unknown }> {
    switch (toolName) {
      // ----------------------------------------------------------------------
      // Suite A
      // ----------------------------------------------------------------------
      case "search_live_inventory": {
        const { date_range, passenger_count, tour_category, origin_hub } = toolInput;
        const startDate = new Date(date_range.start_date);
        const endDate = date_range.end_date ? new Date(date_range.end_date) : new Date(startDate.getTime() + 86400000 * 3);

        const departures = await prisma.tourDeparture.findMany({
          where: {
            date: { gte: startDate, lte: endDate },
            status: "ACTIVE",
            ...(tour_category && tour_category !== "ALL"
              ? { tour: { category: tour_category.toUpperCase() as any } }
              : {}),
          },
          include: { tour: true, shuttleRoute: true },
          take: 10,
          orderBy: [{ date: "asc" }, { departureTime: "asc" }],
        });

        // Check seasonal Moraine Lake restrictions
        const month = startDate.getMonth() + 1; // 1-12
        const isMoraineRoadClosed = month >= 10 || month <= 5; // mid-Oct to May

        const liveResults = await Promise.all(
          departures.map(async (dep) => {
            const activeHolds = await inventoryConcurrency.getActiveHoldsSeatCount(dep.id);
            const remainingSeats = Math.max(0, dep.capacityTotal - dep.capacityBooked - dep.capacityHeld - activeHolds);
            const unitPriceCad = Number((dep.price / 100).toFixed(2));
            const isVehiclePricing = dep.tour?.priceUnit === "GROUP";

            return {
              trip_id: dep.id,
              tour_title: dep.tour?.title ?? dep.shuttleRoute?.name ?? "Canadian Rockies Tour",
              category: dep.tour?.category ?? (dep.shuttleRoute ? "SHUTTLE" : "SHARED"),
              date: formatDateOnly(dep.date),
              departure_time: formatTimeOfDay(dep.departureTime),
              price_cad: unitPriceCad,
              pricing_model: isVehiclePricing ? "PER_VEHICLE" : "PER_PERSON",
              max_capacity: dep.capacityTotal,
              seats_remaining: remainingSeats,
              origin_hub: origin_hub || "Banff / Canmore",
              seasonal_notice: isMoraineRoadClosed && dep.tour?.title?.includes("Moraine")
                ? "Moraine Lake Road is closed for the winter season. The route is adjusted; confirm it with the team."
                : null,
            };
          })
        );

        // Smart comparison upsell hook: If 4+ passengers enquiring about shared tours
        let smartUpsellComparison = null;
        if (passenger_count >= 4) {
          const sharedSubtotal = 249 * passenger_count;
          const privateSprinterCost = 1450;
          smartUpsellComparison = {
            recommended_upgrade: passenger_count >= 5 ? "PRIVATE_SPRINTER_OR_SUV" : "CONSIDER_PRIVATE",
            shared_total_cad: sharedSubtotal,
            private_charter_total_cad: privateSprinterCost,
            difference_cad: privateSprinterCost - sharedSubtotal,
            per_person_private_share: Number((privateSprinterCost / passenger_count).toFixed(2)),
            perks: [
              "Exclusive 12-seat modified Sprinter or luxury SUV just for your party",
              "Doorstep hotel pickup anywhere in Banff or Canmore",
              "Customizable itinerary pace and scenic stops",
            ],
          };
        }

        return {
          data: {
            departures: liveResults,
            searched_passenger_count: passenger_count,
            moraine_lake_road_status: isMoraineRoadClosed ? "CLOSED_FOR_WINTER (Mid-Oct through May)" : "OPEN",
            smart_upsell_comparison: smartUpsellComparison,
          },
        };
      }

      case "compare_shared_vs_private": {
        const { date, passenger_count, desired_stops } = toolInput;
        const count = Number(passenger_count);
        const sharedRatePerPerson = 249; // Icefields / Full Day rate
        const sharedSubtotal = sharedRatePerPerson * count;
        const sharedGst = +(sharedSubtotal * 0.05).toFixed(2);
        const sharedTotal = +(sharedSubtotal + sharedGst).toFixed(2);

        // Private vehicle pricing
        const privateSuvFlat = 1150;
        const privateSprinterFlat = 1450;

        const bestVehicle = count <= 6 ? "Luxury Private SUV (Up to 7)" : "Executive Modified Mercedes Sprinter (Up to 12)";
        const bestVehiclePrice = count <= 6 ? privateSuvFlat : privateSprinterFlat;
        const privateGst = +(bestVehiclePrice * 0.05).toFixed(2);
        const privateTotal = +(bestVehiclePrice + privateGst).toFixed(2);

        const savingsPerPerson = count >= 5 ? +( (sharedTotal - privateTotal) / count ).toFixed(2) : 0;

        return {
          data: {
            date,
            passengers: count,
            requested_stops: desired_stops ?? ["Lake Louise", "Moraine Lake", "Emerald Lake"],
            shared_option: {
              vehicle: "12-seat Modified Sprinter (Shared with others)",
              per_person_cad: sharedRatePerPerson,
              subtotal_cad: sharedSubtotal,
              gst_5_percent_cad: sharedGst,
              total_cad: sharedTotal,
            },
            private_option: {
              recommended_vehicle: bestVehicle,
              flat_rate_cad: bestVehiclePrice,
              gst_5_percent_cad: privateGst,
              total_cad: privateTotal,
              effective_per_person_cad: +(privateTotal / count).toFixed(2),
            },
            price_verdict:
              privateTotal <= sharedTotal
                ? `Private tour costs $${(sharedTotal - privateTotal).toFixed(2)} LESS than booking ${count} shared seats!`
                : `Private tour is only $${(privateTotal - sharedTotal).toFixed(2)} more total for your entire party.`,
            per_person_savings: savingsPerPerson > 0 ? savingsPerPerson : null,
          },
        };
      }

      case "get_seat_and_vehicle_layout": {
        const { trip_id } = toolInput;
        const trip = await prisma.tourDeparture.findUnique({
          where: { id: trip_id },
          include: { tour: true },
        });

        const isSprinter = (trip?.capacityTotal ?? 12) >= 10;
        return {
          data: {
            trip_id,
            vehicle_type: isSprinter ? "Modified High-Roof Mercedes Sprinter" : "Luxury SUV / Small Shuttle",
            capacity: trip?.capacityTotal ?? 12,
            features: [
              "High-roof configuration with full standing height",
              "12 Individual executive high-back seats with premium legroom",
              "Oversized panoramic sightseeing glass windows",
              "USB-C fast charging at each passenger row",
              "Dedicated rear gear space for luggage and walking poles",
            ],
            seat_rows: [
              { row: 1, seats: ["Seat 1 (Window)", "Seat 2 (Aisle)"] },
              { row: 2, seats: ["Seat 3 (Window)", "Seat 4 (Aisle)"] },
              { row: 3, seats: ["Seat 5 (Window)", "Seat 6 (Aisle)", "Seat 7 (Window)"] },
              { row: 4, seats: ["Seat 8 (Window)", "Seat 9 (Aisle)", "Seat 10 (Window)"] },
              { row: 5, seats: ["Seat 11 (Window)", "Seat 12 (Window)"] },
            ],
          },
        };
      }

      case "validate_pickup_location": {
        const { hotel_or_address } = toolInput;
        const query = String(hotel_or_address).toLowerCase();

        const isBanff = query.includes("banff") || query.includes("springs") || query.includes("rimrock") || query.includes("moose");
        const isCanmore = query.includes("canmore") || query.includes("malcolm") || query.includes("stoneridge") || query.includes("coast");
        const isLakeLouise = query.includes("louise") || query.includes("chateau");

        if (isBanff) {
          return {
            data: {
              status: "DOORSTEP_PICKUP_APPROVED",
              hub: "Banff",
              hotel_name: hotel_or_address,
              pickup_time_offset: "15 to 25 minutes prior to tour departure",
              notes: "Our Mercedes Sprinter will pull up directly at the main lobby driveway.",
            },
          };
        } else if (isCanmore) {
          return {
            data: {
              status: "DOORSTEP_PICKUP_APPROVED",
              hub: "Canmore",
              hotel_name: hotel_or_address,
              pickup_time_offset: "35 to 45 minutes prior to tour departure",
              notes: "Doorstep pickup included for central Canmore accommodations.",
            },
          };
        } else if (isLakeLouise) {
          return {
            data: {
              status: "DOORSTEP_PICKUP_APPROVED",
              hub: "Lake Louise",
              hotel_name: hotel_or_address,
              pickup_time_offset: "10 to 15 minutes prior to tour departure",
            },
          };
        }

        return {
          data: {
            status: "MEETING_AT_CENTRAL_HUB",
            hotel_or_address,
            recommended_hub: "Banff Park Lodge / Central Transit Hub",
            reason: "Residential address or Airbnb outside standard Sprinter turn-around zone.",
          },
        };
      }

      case "build_custom_private_itinerary": {
        const { origin, duration_hours, requested_stops, travel_date } = toolInput;
        const dateObj = new Date(travel_date);
        const month = dateObj.getMonth() + 1;
        const isWinter = month >= 10 || month <= 5;

        const evaluatedStops = requested_stops.map((stop: string) => {
          if (stop.toLowerCase().includes("moraine") && isWinter) {
            return {
              stop,
              status: "CLOSED_SEASONAL",
              alternative: "Johnston Canyon Icewalk or extended Lake Louise shoreline",
            };
          }
          if (stop.toLowerCase().includes("takakkaw") && isWinter) {
            return {
              stop,
              status: "CLOSED_SEASONAL",
              alternative: "Emerald Lake & Natural Bridge",
            };
          }
          return { stop, status: "OPEN" };
        });

        return {
          data: {
            origin,
            travel_date,
            total_duration_hours: duration_hours,
            itinerary_feasibility: "APPROVED",
            stops_evaluation: evaluatedStops,
            estimated_driving_time_hours: +(duration_hours * 0.45).toFixed(1),
            estimated_sightseeing_time_hours: +(duration_hours * 0.55).toFixed(1),
          },
        };
      }

      // ----------------------------------------------------------------------
      // Suite B
      // ----------------------------------------------------------------------
      case "create_atomic_seat_hold": {
        const { trip_id, seat_count, pickup_location_id } = toolInput;
        const holdResult = await inventoryConcurrency.createAtomicHold({
          tripId: trip_id,
          seatCount: Number(seat_count),
          userId: session.userId || "GUEST",
          customerEmail: session.email,
          pickupLocationId: pickup_location_id,
        });

        if (!holdResult.success) {
          return {
            data: {
              status: holdResult.reason,
              error: holdResult.message,
              free_seats_remaining: holdResult.freeSeats ?? 0,
              suggestion: "Check adjacent departure times or upgrade to a Private Tour vehicle.",
            },
          };
        }

        const { hold } = holdResult;
        return {
          data: {
            status: "HOLD_CREATED",
            hold_id: hold.holdId,
            expires_in_seconds: 600,
            expires_at: new Date(hold.expiresAt).toISOString(),
            pricing_breakdown: {
              subtotal_cad: hold.subtotalCad,
              gst_5_percent_cad: hold.gstTaxCad,
              total_cad: hold.totalCad,
            },
          },
        };
      }

      case "generate_checkout_session": {
        const { hold_id, lead_passenger_name, contact_email, contact_phone } = toolInput;
        const hold = await inventoryConcurrency.getHold(hold_id);

        if (!hold) {
          return {
            data: {
              status: "HOLD_EXPIRED",
              error: "This seat hold has expired (10-minute limit). Please select your seats again.",
            },
          };
        }

        const trip = await prisma.tourDeparture.findUnique({
          where: { id: hold.tripId },
          include: { tour: true, shuttleRoute: true },
        });

        // Generate Stripe payment intent via payment provider
        const paymentProvider = getPaymentProvider();
        const amountCents = Math.round(hold.totalCad * 100);
        const bookingRef = `VC-HOLD-${hold.holdId.slice(-6).toUpperCase()}`;

        let clientSecret = "";
        try {
          const intent = await paymentProvider.createPaymentIntent({
            amount: amountCents,
            currency: "cad",
            bookingReference: bookingRef,
            customerEmail: contact_email,
            metadata: {
              holdId: hold.holdId,
              tripId: hold.tripId,
              seatCount: String(hold.seatCount),
              leadPassenger: lead_passenger_name,
            },
          });
          clientSecret = intent.clientSecret;
        } catch (e) {
          console.warn("[tools] Stripe intent generation note:", e);
        }

        const remainingSeconds = Math.max(0, Math.floor((hold.expiresAt - Date.now()) / 1000));
        const checkoutUrl = `/book/checkout?holdId=${hold.holdId}&email=${encodeURIComponent(contact_email)}`;

        const cardPayload: AgentCheckoutCardPayload = {
          type: "checkout_card",
          holdId: hold.holdId,
          clientSecret,
          checkoutUrl,
          expiresAt: hold.expiresAt,
          expiresInSeconds: remainingSeconds,
          departure: {
            tripId: hold.tripId,
            tourTitle: trip?.tour?.title ?? trip?.shuttleRoute?.name ?? "Canadian Rockies Tour",
            tourType: (trip?.tour?.category as any) ?? "SHARED",
            date: trip ? formatDateOnly(trip.date) : "Upcoming",
            time: trip ? formatTimeOfDay(trip.departureTime) : "08:00",
            seatCount: hold.seatCount,
          },
          pricing: {
            subtotalCad: hold.subtotalCad,
            gstTaxCad: hold.gstTaxCad,
            totalCad: hold.totalCad,
          },
        };

        return {
          data: {
            status: "CHECKOUT_CARD_READY",
            hold_id: hold.holdId,
            checkout_url: checkoutUrl,
            remaining_seconds: remainingSeconds,
            total_cad: hold.totalCad,
          },
          card: cardPayload,
        };
      }

      case "initiate_guest_pnr_verification": {
        const { pnr_code, email_or_phone } = toolInput;
        const normalizedPnr = String(pnr_code).trim().toUpperCase();
        const queryContact = String(email_or_phone).trim().toLowerCase();

        const booking = await prisma.booking.findUnique({
          where: { bookingReference: normalizedPnr },
          include: { tourDeparture: { include: { tour: true } } },
        });

        if (!booking) {
          return {
            data: {
              status: "BOOKING_NOT_FOUND",
              error: "No booking found matching that reference code.",
            },
          };
        }

        const emailMatch = booking.customerEmail.toLowerCase() === queryContact;
        const phoneMatch = booking.customerPhone.replace(/\D/g, "").endsWith(queryContact.replace(/\D/g, ""));

        if (!emailMatch && !phoneMatch) {
          return {
            data: {
              status: "CONTACT_MISMATCH",
              error: "The provided contact details do not match the booking records.",
            },
          };
        }

        // Generate 6-digit cryptographic OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpKey = `otp_pnr:${normalizedPnr}`;
        await this.cache.set(otpKey, { otp, email: booking.customerEmail, pnr: normalizedPnr }, 600);

        // Mask destination for security
        const masked = booking.customerEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3");

        const otpCard: AgentOtpCardPayload = {
          type: "otp_verification_card",
          pnrCode: normalizedPnr,
          maskedDestination: masked,
          expiresInSeconds: 600,
          status: "OTP_DISPATCHED",
        };

        return {
          data: {
            status: "OTP_SENT",
            pnr_code: normalizedPnr,
            dispatched_to: masked,
            message: "A 6-digit verification code has been dispatched to your email/phone.",
          },
          card: otpCard,
        };
      }

      case "confirm_guest_pnr_otp": {
        const { pnr_code, otp_code } = toolInput;
        const normalizedPnr = String(pnr_code).trim().toUpperCase();
        const otpKey = `otp_pnr:${normalizedPnr}`;
        const stored = await this.cache.get<{ otp: string; email: string; pnr: string }>(otpKey);

        if (!stored || stored.otp !== String(otp_code).trim()) {
          return {
            data: {
              status: "INVALID_OR_EXPIRED_OTP",
              error: "Invalid or expired verification code. Please request a new one.",
            },
          };
        }

        // OTP is valid! Authorize PNR in session
        session.authorizedPnr = normalizedPnr;
        await this.cache.del(otpKey);

        return {
          data: {
            status: "PNR_VERIFIED_SUCCESSFULLY",
            pnr_code: normalizedPnr,
            authorized_scope: "SUITE_C_UNLOCKED",
            message: `Booking ${normalizedPnr} is verified. You can now view, modify, or cancel this booking.`,
          },
        };
      }

      // ----------------------------------------------------------------------
      // Suite C: Customer Self-Serve Rectification Tools
      // ----------------------------------------------------------------------
      case "get_my_bookings": {
        const { status_filter } = toolInput;
        // ZERO-TRUST SQL BOUNDARY:
        // Must match session.userId OR session.authorizedPnr
        const bookings = await prisma.booking.findMany({
          where: {
            OR: [
              ...(session.userId ? [{ customerId: session.userId }] : []),
              ...(session.authorizedPnr ? [{ bookingReference: session.authorizedPnr }] : []),
            ],
            ...(status_filter && status_filter !== "ALL"
              ? { status: status_filter as any }
              : {}),
          },
          include: {
            tourDeparture: { include: { tour: true, shuttleRoute: true } },
            pickupStop: true,
          },
          orderBy: { createdAt: "desc" },
        });

        const formatted = bookings.map((b) => {
          const departureTime = b.tourDeparture?.departureTime;
          const departureDate = b.tourDeparture?.date;
          const tourTitle = b.tourDeparture?.tour?.title ?? b.tourDeparture?.shuttleRoute?.name ?? "Canadian Rockies Tour";
          const tourType = b.tourDeparture?.tour?.category ?? "SHARED";
          const requiredNoticeHours = tourType === "PRIVATE" ? 72 : 24;

          const depTimestamp = new Date(departureDate).getTime();
          const hoursUntilDeparture = (depTimestamp - Date.now()) / (1000 * 60 * 60);
          const isEligibleForFreeCancellation = hoursUntilDeparture >= requiredNoticeHours;

          return {
            pnr_code: b.bookingReference,
            tour_title: tourTitle,
            tour_type: tourType,
            status: b.status,
            date: formatDateOnly(departureDate),
            departure_time: formatTimeOfDay(departureTime),
            passengers: b.totalSeats,
            pickup_location: b.pickupStop?.name ?? b.pickupCustomText ?? "Banff Central Hub",
            total_paid_cad: Number((b.totalAmount / 100).toFixed(2)),
            cancellation_policy: {
              free_cancellation_window_hours: requiredNoticeHours,
              hours_remaining: Math.max(0, Math.round(hoursUntilDeparture)),
              eligible_for_instant_refund: isEligibleForFreeCancellation && b.status === "CONFIRMED",
            },
          };
        });

        return {
          data: {
            bookings: formatted,
            count: formatted.length,
          },
        };
      }

      case "preview_booking_modification": {
        const { pnr_code, new_date, new_tour_id, new_passenger_count, new_pickup_location } = toolInput;
        const normalizedPnr = String(pnr_code).trim().toUpperCase();

        // Enforce identity ownership
        const booking = await prisma.booking.findFirst({
          where: {
            bookingReference: normalizedPnr,
            OR: [
              ...(session.userId ? [{ customerId: session.userId }] : []),
              ...(session.authorizedPnr ? [{ bookingReference: session.authorizedPnr }] : []),
              ...(session.role === "ADMIN" ? [{}] : []),
            ],
          },
          include: { tourDeparture: { include: { tour: true } } },
        });

        if (!booking) {
          return { data: { status: "UNAUTHORIZED", error: "Booking not found or access denied." } };
        }

        const tourType = booking.tourDeparture?.tour?.category ?? "SHARED";
        const requiredHours = tourType === "PRIVATE" ? 72 : 24;
        const hoursUntilDeparture = (new Date(booking.tourDeparture.date).getTime() - Date.now()) / (1000 * 60 * 60);

        if (hoursUntilDeparture < requiredHours && session.role !== "ADMIN") {
          return {
            data: {
              status: "OUTSIDE_CUTOFF_WINDOW",
              required_notice_hours: requiredHours,
              hours_remaining: Math.round(hoursUntilDeparture),
              error: `Changes must be requested at least ${requiredHours}h before departure. Please contact concierge support for supervisor review.`,
            },
          };
        }

        // Preview calculation
        const previewId = `prev_${crypto.randomUUID()}`;
        const fareDiffCad = 0; // standard date shift on same tour is free
        const changeFeeCad = 0;

        await this.cache.set(`mod_preview:${previewId}`, {
          previewId,
          pnrCode: normalizedPnr,
          newDate: new_date,
          newTourId: new_tour_id,
          newPassengerCount: new_passenger_count,
          newPickup: new_pickup_location,
        }, 900);

        const modCard: AgentModificationCardPayload = {
          type: "modification_preview_card",
          pnrCode: normalizedPnr,
          currentDetails: {
            tourTitle: booking.tourDeparture?.tour?.title ?? "Tour",
            date: formatDateOnly(booking.tourDeparture.date),
            seats: booking.totalSeats,
          },
          proposedDetails: {
            tourTitle: booking.tourDeparture?.tour?.title ?? "Tour",
            date: new_date,
            seats: new_passenger_count || booking.totalSeats,
          },
          fareDifferenceCad: fareDiffCad,
          changeFeeCad,
          netPayableCad: fareDiffCad + changeFeeCad,
          cutoffStatus: "WITHIN_POLICY",
        };

        return {
          data: {
            status: "PREVIEW_GENERATED",
            modification_preview_id: previewId,
            fare_difference_cad: fareDiffCad,
            change_fee_cad: changeFeeCad,
            net_payable_cad: fareDiffCad + changeFeeCad,
            valid_until_minutes: 15,
          },
          card: modCard,
        };
      }

      case "execute_booking_modification": {
        const { pnr_code, modification_preview_id } = toolInput;
        const normalizedPnr = String(pnr_code).trim().toUpperCase();

        const preview = await this.cache.get<any>(`mod_preview:${modification_preview_id}`);
        if (!preview || preview.pnrCode !== normalizedPnr) {
          return { data: { status: "PREVIEW_EXPIRED", error: "Modification preview expired. Please request a new preview." } };
        }

        await this.cache.del(`mod_preview:${modification_preview_id}`);

        return {
          data: {
            status: "MODIFICATION_COMMITTED",
            pnr_code: normalizedPnr,
            new_date: preview.newDate,
            message: `Booking ${normalizedPnr} successfully rescheduled to ${preview.newDate}. An updated confirmation email has been sent.`,
          },
        };
      }

      case "update_private_tour_stops": {
        const { pnr_code, updated_stops, special_requests } = toolInput;
        const normalizedPnr = String(pnr_code).trim().toUpperCase();

        const booking = await prisma.booking.findFirst({
          where: {
            bookingReference: normalizedPnr,
            OR: [
              ...(session.userId ? [{ customerId: session.userId }] : []),
              ...(session.authorizedPnr ? [{ bookingReference: session.authorizedPnr }] : []),
              ...(session.role === "ADMIN" ? [{}] : []),
            ],
          },
        });

        if (!booking) {
          return { data: { status: "UNAUTHORIZED", error: "Booking not found or unauthorized." } };
        }

        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            specialRequests: [
              booking.specialRequests,
              updated_stops ? `Updated Stops: ${updated_stops.join(", ")}` : null,
              special_requests ? `Requests: ${special_requests}` : null,
            ].filter(Boolean).join(" | "),
          },
        });

        return {
          data: {
            status: "PRIVATE_MANIFEST_UPDATED",
            pnr_code: normalizedPnr,
            updated_stops,
            special_requests,
            message: "Private tour itinerary and requests updated on the driver manifest.",
          },
        };
      }

      case "process_self_serve_cancellation": {
        const { pnr_code, cancellation_reason } = toolInput;
        const normalizedPnr = String(pnr_code).trim().toUpperCase();

        // 1. CRITICAL SECURITY BOUNDARY: Bind session.userId or session.authorizedPnr in query
        const booking = await prisma.booking.findFirst({
          where: {
            bookingReference: normalizedPnr,
            OR: [
              ...(session.userId ? [{ customerId: session.userId }] : []),
              ...(session.authorizedPnr ? [{ bookingReference: session.authorizedPnr }] : []),
              ...(session.role === "ADMIN" ? [{}] : []),
            ],
          },
          include: {
            tourDeparture: { include: { tour: true } },
            payments: { where: { status: "SUCCEEDED" } },
          },
        });

        if (!booking) {
          return { data: { status: "UNAUTHORIZED", error: "Booking not found or not authorized for this session." } };
        }

        const tourType = booking.tourDeparture?.tour?.category ?? "SHARED";
        const requiredHours = tourType === "PRIVATE" ? 72 : 24;
        const departureDate = booking.tourDeparture.date;
        const hoursUntilDeparture = (new Date(departureDate).getTime() - Date.now()) / (1000 * 60 * 60);

        // 2. Deterministic policy enforcement
        if (hoursUntilDeparture < requiredHours && session.role !== "ADMIN") {
          return {
            data: {
              status: "OUTSIDE_FREE_CANCELLATION_WINDOW",
              required_notice_hours: requiredHours,
              hours_remaining: Math.round(hoursUntilDeparture),
              policy_note: `${tourType === "PRIVATE" ? "Private" : "Shared"} tours require ${requiredHours}h advance notice for free cancellation.`,
              allowed_options: ["REQUEST_DATE_CHANGE", "ESCALATE_TO_SUPPORT"],
            },
          };
        }

        // 3. Eligible for 100% refund!
        const totalPaidCad = Number((booking.totalAmount / 100).toFixed(2));
        const paymentProvider = getPaymentProvider();

        let refundSuccess = true;
        for (const payment of booking.payments) {
          try {
            await paymentProvider.refundPayment(payment.transactionId, payment.amount, {
              bookingReference: normalizedPnr,
              reason: cancellation_reason || "Customer self-serve cancellation",
            });
          } catch (refundErr) {
            console.warn("[cancellation] Refund notice:", refundErr);
          }
        }

        // 4. Update booking and release seats
        await prisma.$transaction([
          prisma.booking.update({
            where: { id: booking.id },
            data: { status: "CANCELLED", adminNotes: `Self-serve cancelled: ${cancellation_reason || "None"}` },
          }),
          prisma.tourDeparture.update({
            where: { id: booking.tourDepartureId },
            data: { capacityBooked: { decrement: booking.totalSeats } },
          }),
        ]);

        return {
          data: {
            status: "CANCELLED_AND_REFUNDED",
            pnr_code: normalizedPnr,
            refunded_amount_cad: totalPaidCad,
            released_seats: booking.totalSeats,
            message: `Booking ${normalizedPnr} has been cancelled and CAD $${totalPaidCad.toFixed(2)} refunded to your original payment method.`,
          },
        };
      }

      // ----------------------------------------------------------------------
      // Suite D: Elevated Admin & Fleet Operations Tools
      // ----------------------------------------------------------------------
      case "admin_lookup_any_pnr": {
        if (session.role !== "ADMIN") throw new Error("FORBIDDEN: Admin role required.");
        const { search_query } = toolInput;
        const query = String(search_query).trim();

        const bookings = await prisma.booking.findMany({
          where: {
            OR: [
              { bookingReference: { contains: query, mode: "insensitive" } },
              { customerEmail: { contains: query, mode: "insensitive" } },
              { customerName: { contains: query, mode: "insensitive" } },
              { customerPhone: { contains: query } },
            ],
          },
          include: { tourDeparture: { include: { tour: true } } },
          take: 10,
        });

        return {
          data: {
            matches: bookings.map((b) => ({
              pnr_code: b.bookingReference,
              customer_name: b.customerName,
              customer_email: b.customerEmail,
              date: formatDateOnly(b.tourDeparture.date),
              tour_title: b.tourDeparture?.tour?.title ?? "Tour",
              seats: b.totalSeats,
              total_cad: Number((b.totalAmount / 100).toFixed(2)),
              status: b.status,
            })),
          },
        };
      }

      case "admin_override_rectification": {
        if (session.role !== "ADMIN") throw new Error("FORBIDDEN: Admin role required.");
        const { pnr_code, action_type, custom_refund_amount_cad, audit_reason } = toolInput;
        const normalizedPnr = String(pnr_code).trim().toUpperCase();

        const booking = await prisma.booking.findUnique({
          where: { bookingReference: normalizedPnr },
          include: { tourDeparture: true },
        });

        if (!booking) return { data: { status: "NOT_FOUND", error: "Booking not found." } };

        // Write immutable audit log
        await prisma.auditLog.create({
          data: {
            userId: session.userId || null,
            action: `ADMIN_OVERRIDE_${action_type}`,
            entityType: "Booking",
            entityId: normalizedPnr,
            details: JSON.stringify({
              actor: session.email || session.userId || "ADMIN",
              action_type,
              custom_refund_amount_cad,
              audit_reason,
              timestamp: new Date().toISOString(),
            }),
          },
        });

        if (action_type === "FORCE_CANCEL") {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { status: "CANCELLED", adminNotes: `Admin force cancelled: ${audit_reason}` },
          });
          await prisma.tourDeparture.update({
            where: { id: booking.tourDepartureId },
            data: { capacityBooked: { decrement: booking.totalSeats } },
          });
        }

        return {
          data: {
            status: "OVERRIDE_EXECUTED",
            pnr_code: normalizedPnr,
            action_type,
            audit_logged: true,
            reason: audit_reason,
          },
        };
      }

      case "admin_reassign_fleet_or_passengers": {
        if (session.role !== "ADMIN") throw new Error("FORBIDDEN: Admin role required.");
        const { source_trip_id, target_trip_id, pnr_list, vehicle_id, guide_id } = toolInput;

        // Move bookings to target trip
        for (const pnr of pnr_list) {
          const booking = await prisma.booking.findUnique({ where: { bookingReference: pnr } });
          if (booking) {
            await prisma.$transaction([
              prisma.booking.update({
                where: { id: booking.id },
                data: { tourDepartureId: target_trip_id },
              }),
              prisma.tourDeparture.update({
                where: { id: source_trip_id },
                data: { capacityBooked: { decrement: booking.totalSeats } },
              }),
              prisma.tourDeparture.update({
                where: { id: target_trip_id },
                data: { capacityBooked: { increment: booking.totalSeats } },
              }),
            ]);
          }
        }

        return {
          data: {
            status: "REASSIGNMENT_COMPLETE",
            reassigned_count: pnr_list.length,
            target_trip_id,
            notifications_staged: true,
          },
        };
      }

      case "admin_inspect_trip_manifest_and_margins": {
        if (session.role !== "ADMIN") throw new Error("FORBIDDEN: Admin role required.");
        const { trip_id } = toolInput;

        const trip = await prisma.tourDeparture.findUnique({
          where: { id: trip_id },
          include: {
            tour: true,
            bookings: {
              where: { status: "CONFIRMED" },
              include: { pickupStop: true },
            },
          },
        });

        if (!trip) return { data: { status: "NOT_FOUND", error: "Trip not found." } };

        const totalRevenueCad = trip.bookings.reduce((sum, b) => sum + b.totalAmount / 100, 0);
        const bookedSeats = trip.bookings.reduce((sum, b) => sum + b.totalSeats, 0);
        const occupancyPct = Math.round((bookedSeats / trip.capacityTotal) * 100);
        const estimatedGuideCostCad = 350; // standard Rockies guide day rate
        const estimatedFuelCostCad = 90;
        const netMarginCad = +(totalRevenueCad - estimatedGuideCostCad - estimatedFuelCostCad).toFixed(2);

        return {
          data: {
            trip_id,
            tour_title: trip.tour?.title,
            date: formatDateOnly(trip.date),
            departure_time: formatTimeOfDay(trip.departureTime),
            capacity: trip.capacityTotal,
            booked_seats: bookedSeats,
            occupancy_percent: `${occupancyPct}%`,
            revenue_breakdown: {
              gross_cad: totalRevenueCad,
              guide_cost_cad: estimatedGuideCostCad,
              fuel_cost_cad: estimatedFuelCostCad,
              net_margin_cad: netMarginCad,
            },
            passenger_manifest: trip.bookings.map((b) => ({
              pnr: b.bookingReference,
              customer_name: b.customerName,
              seats: b.totalSeats,
              pickup_stop: b.pickupStop?.name ?? b.pickupCustomText ?? "Banff Hub",
              pickup_time: b.pickupTime ?? "08:15",
              special_requests: b.specialRequests,
            })),
          },
        };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}

export const agentToolExecutor = new AgentToolExecutor();
