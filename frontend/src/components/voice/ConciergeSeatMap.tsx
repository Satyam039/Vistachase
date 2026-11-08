"use client";

import { useState } from "react";
import { Check, Info, Lock, Sparkles, Zap, Wind, Eye } from "lucide-react";

export interface SeatInfo {
  id: string;
  label: string;
  row: number;
  type: "window" | "aisle" | "middle" | "captains_chair";
  isAvailable: boolean;
  priceDelta?: number;
}

export interface ConciergeSeatMapProps {
  vehicleType?: "sprinter_12" | "suv_7";
  vehicleName?: string;
  capacity?: number;
  legroom?: string;
  amenities?: string[];
  seats?: SeatInfo[];
  onSelectSeats?: (seatIds: string[]) => void;
}

const DEFAULT_SPRINTER_SEATS: SeatInfo[] = [
  { id: "1A", label: "1A", row: 1, type: "window", isAvailable: true },
  { id: "1B", label: "1B", row: 1, type: "window", isAvailable: true },
  { id: "1C", label: "1C", row: 1, type: "aisle", isAvailable: false },
  { id: "2A", label: "2A", row: 2, type: "window", isAvailable: true },
  { id: "2B", label: "2B", row: 2, type: "window", isAvailable: true },
  { id: "2C", label: "2C", row: 2, type: "aisle", isAvailable: true },
  { id: "3A", label: "3A", row: 3, type: "window", isAvailable: true },
  { id: "3B", label: "3B", row: 3, type: "window", isAvailable: false },
  { id: "3C", label: "3C", row: 3, type: "aisle", isAvailable: true },
  { id: "4A", label: "4A", row: 4, type: "window", isAvailable: true },
  { id: "4B", label: "4B", row: 4, type: "middle", isAvailable: true },
  { id: "4C", label: "4C", row: 4, type: "middle", isAvailable: true },
  { id: "4D", label: "4D", row: 4, type: "window", isAvailable: true },
];

export function ConciergeSeatMap({
  vehicleType = "sprinter_12",
  vehicleName = "12-Seat Modified Mercedes Sprinter (High-Roof Touring Van)",
  capacity = 12,
  legroom = "38\" Extended Touring Legroom",
  amenities = ["⚡ USB-C at Every Seat", "🪟 UV Panoramic Windows", "❄️ Dual Alpine Climate Zones"],
  seats = DEFAULT_SPRINTER_SEATS,
  onSelectSeats,
}: ConciergeSeatMapProps) {
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);

  const toggleSeat = (id: string, isAvailable: boolean) => {
    if (!isAvailable) return;
    setSelectedSeatIds((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      onSelectSeats?.(next);
      return next;
    });
  };

  const isSprinter = vehicleType === "sprinter_12";

  // Group seats by row
  const row1 = seats.filter((s) => s.row === 1);
  const row2 = seats.filter((s) => s.row === 2);
  const row3 = seats.filter((s) => s.row === 3);
  const row4 = seats.filter((s) => s.row === 4);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-obsidian-900/10 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ocean-100 text-ocean-800">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <h4 className="text-sm font-semibold text-obsidian-900">{vehicleName}</h4>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {capacity} passenger capacity · {legroom} · Front passenger door access
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-ocean-50 px-2.5 py-1 text-xs font-medium text-ocean-800">
          <span>{seats.filter((s) => s.isAvailable).length} seats open</span>
        </div>
      </div>

      {/* Amenities banner */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5">
          <Zap className="h-3 w-3 text-amber-500" /> USB-C Power
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5">
          <Eye className="h-3 w-3 text-ocean-600" /> Panoramic UV Windows
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5">
          <Wind className="h-3 w-3 text-sky-600" /> High-Output Climate
        </span>
      </div>

      {/* Vehicle Chassis Layout */}
      <div className="relative mx-auto mt-4 max-w-sm rounded-3xl border-2 border-slate-300 bg-white p-3 shadow-inner">
        {/* Windshield / Cockpit */}
        <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-100 px-4 py-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="inline-block h-6 w-6 rounded-full border border-slate-400 bg-slate-200 text-center text-[10px] leading-5 font-bold text-slate-700">
              ⎈
            </span>
            <span className="font-medium text-slate-700">Driver</span>
          </div>
          <span className="text-[11px] font-medium text-slate-400">FRONT WINDSHIELD</span>
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <span>Guide / Entry</span>
          </div>
        </div>

        {/* Passenger Seating Grid */}
        <div className="space-y-3 px-1 py-1">
          {/* Row 1 */}
          <div className="flex items-center justify-between gap-2">
            <SeatButton
              seat={row1.find((s) => s.id === "1A") || { id: "1A", label: "1A", row: 1, type: "window", isAvailable: true }}
              isSelected={selectedSeatIds.includes("1A")}
              onToggle={toggleSeat}
            />
            <div className="flex-1 text-center text-[10px] uppercase tracking-widest text-slate-300">Aisle</div>
            <div className="flex items-center gap-1.5">
              <SeatButton
                seat={row1.find((s) => s.id === "1B") || { id: "1B", label: "1B", row: 1, type: "window", isAvailable: true }}
                isSelected={selectedSeatIds.includes("1B")}
                onToggle={toggleSeat}
              />
              <SeatButton
                seat={row1.find((s) => s.id === "1C") || { id: "1C", label: "1C", row: 1, type: "aisle", isAvailable: false }}
                isSelected={selectedSeatIds.includes("1C")}
                onToggle={toggleSeat}
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="flex items-center justify-between gap-2">
            <SeatButton
              seat={row2.find((s) => s.id === "2A") || { id: "2A", label: "2A", row: 2, type: "window", isAvailable: true }}
              isSelected={selectedSeatIds.includes("2A")}
              onToggle={toggleSeat}
            />
            <div className="flex-1 text-center text-[10px] uppercase tracking-widest text-slate-300">Aisle</div>
            <div className="flex items-center gap-1.5">
              <SeatButton
                seat={row2.find((s) => s.id === "2B") || { id: "2B", label: "2B", row: 2, type: "window", isAvailable: true }}
                isSelected={selectedSeatIds.includes("2B")}
                onToggle={toggleSeat}
              />
              <SeatButton
                seat={row2.find((s) => s.id === "2C") || { id: "2C", label: "2C", row: 2, type: "aisle", isAvailable: true }}
                isSelected={selectedSeatIds.includes("2C")}
                onToggle={toggleSeat}
              />
            </div>
          </div>

          {/* Row 3 */}
          <div className="flex items-center justify-between gap-2">
            <SeatButton
              seat={row3.find((s) => s.id === "3A") || { id: "3A", label: "3A", row: 3, type: "window", isAvailable: true }}
              isSelected={selectedSeatIds.includes("3A")}
              onToggle={toggleSeat}
            />
            <div className="flex-1 text-center text-[10px] uppercase tracking-widest text-slate-300">Aisle</div>
            <div className="flex items-center gap-1.5">
              <SeatButton
                seat={row3.find((s) => s.id === "3B") || { id: "3B", label: "3B", row: 3, type: "window", isAvailable: false }}
                isSelected={selectedSeatIds.includes("3B")}
                onToggle={toggleSeat}
              />
              <SeatButton
                seat={row3.find((s) => s.id === "3C") || { id: "3C", label: "3C", row: 3, type: "aisle", isAvailable: true }}
                isSelected={selectedSeatIds.includes("3C")}
                onToggle={toggleSeat}
              />
            </div>
          </div>

          {/* Row 4 (Back 4-Seat Bench) */}
          <div className="border-t border-dashed border-slate-200 pt-2">
            <div className="flex items-center justify-between gap-1.5">
              <SeatButton
                seat={row4.find((s) => s.id === "4A") || { id: "4A", label: "4A", row: 4, type: "window", isAvailable: true }}
                isSelected={selectedSeatIds.includes("4A")}
                onToggle={toggleSeat}
              />
              <SeatButton
                seat={row4.find((s) => s.id === "4B") || { id: "4B", label: "4B", row: 4, type: "middle", isAvailable: true }}
                isSelected={selectedSeatIds.includes("4B")}
                onToggle={toggleSeat}
              />
              <SeatButton
                seat={row4.find((s) => s.id === "4C") || { id: "4C", label: "4C", row: 4, type: "middle", isAvailable: true }}
                isSelected={selectedSeatIds.includes("4C")}
                onToggle={toggleSeat}
              />
              <SeatButton
                seat={row4.find((s) => s.id === "4D") || { id: "4D", label: "4D", row: 4, type: "window", isAvailable: true }}
                isSelected={selectedSeatIds.includes("4D")}
                onToggle={toggleSeat}
              />
            </div>
            <p className="mt-1 text-center text-[10px] text-slate-400">Rear Luggage Compartment Behind Row 4</p>
          </div>
        </div>
      </div>

      {/* Legend & Selection Action */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3">
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded border border-ocean-600 bg-ocean-50" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded border border-amber-500 bg-amber-400" />
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded border border-slate-200 bg-slate-100" />
            <span>Occupied</span>
          </div>
        </div>

        {selectedSeatIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-obsidian-900">
              Selected: <span className="font-mono text-ocean-700">{selectedSeatIds.join(", ")}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function SeatButton({
  seat,
  isSelected,
  onToggle,
}: {
  seat: SeatInfo;
  isSelected: boolean;
  onToggle: (id: string, isAvailable: boolean) => void;
}) {
  const { id, label, isAvailable, type } = seat;

  let bgClass = "bg-ocean-50 text-ocean-950 border-ocean-300 hover:border-ocean-600 hover:bg-ocean-100";
  if (!isAvailable) {
    bgClass = "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60";
  } else if (isSelected) {
    bgClass = "bg-amber-400 text-obsidian-950 border-amber-600 font-semibold shadow-xs";
  }

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={() => onToggle(id, isAvailable)}
      title={`${label} (${type}) - ${isAvailable ? (isSelected ? "Selected" : "Click to select") : "Reserved"}`}
      className={`relative inline-flex h-11 w-11 flex-col items-center justify-center rounded-xl border text-xs transition-all ${bgClass}`}
    >
      <span className="font-mono text-[11px]">{label}</span>
      <span className="text-[9px] uppercase tracking-tighter opacity-75">
        {type === "window" ? "Win" : type === "aisle" ? "Aisle" : "Mid"}
      </span>
      {!isAvailable && (
        <span className="absolute top-1 right-1">
          <Lock className="h-2.5 w-2.5 text-slate-400" />
        </span>
      )}
      {isSelected && (
        <span className="absolute -top-1 -right-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-obsidian-900 text-amber-400">
          <Check className="h-2 w-2 stroke-[3]" />
        </span>
      )}
    </button>
  );
}
