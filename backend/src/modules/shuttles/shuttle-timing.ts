/**
 * Single source of truth for shuttle departure and pickup timings.
 * - Banff pickup is the departure time.
 * - Canmore pickup is exactly 30 minutes before Banff pickup.
 * - Samson Mall (Lake Louise) pickup is exactly 40 minutes after Banff pickup.
 */

export function addMinutesToTime(time: string, minutes: number): string {
  const match = time.match(/(\d{1,2}):(\d{2})/);
  if (!match) return time;
  const h = Number(match[1]);
  const m = Number(match[2]);
  const total = ((h * 60 + m + minutes) % 1440 + 1440) % 1440;
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

export function calculateCanmorePickup(banffTime: string): string {
  return addMinutesToTime(banffTime, -30);
}

export function calculateSamsonPickup(banffTime: string): string {
  return addMinutesToTime(banffTime, 40);
}

export function resolveShuttlePickupTime(params: {
  departureTime: string;
  town?: string | null;
  stopName?: string | null;
  customText?: string | null;
  storedPickupTime?: string | null;
}): string {
  const town = (params.town || "").toLowerCase();
  const name = (params.stopName || "").toLowerCase();
  const text = (params.customText || "").toLowerCase();

  const timeMatch = params.departureTime.match(/(\d{1,2}):(\d{2})/);
  const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : params.departureTime.slice(0, 5);

  const isCanmore = town.includes("canmore") || name.includes("canmore") || text.includes("canmore");
  const isSamson = town.includes("louise") || name.includes("samson") || text.includes("samson") || text.includes("lake louise");

  if (params.storedPickupTime && params.storedPickupTime.trim()) {
    const stored = params.storedPickupTime.trim();
    // If stored pickup time is the departure time but the stop is Canmore or Samson, resolve the actual stop pickup time
    const storedMatch = stored.match(/(\d{1,2}):(\d{2})/);
    const storedHHMM = storedMatch ? `${storedMatch[1].padStart(2, "0")}:${storedMatch[2]}` : stored;
    if (isCanmore && storedHHMM === time) {
      return calculateCanmorePickup(time);
    }
    if (isSamson && storedHHMM === time) {
      return calculateSamsonPickup(time);
    }
    return stored;
  }

  if (isCanmore) {
    return calculateCanmorePickup(time);
  }
  if (isSamson) {
    return calculateSamsonPickup(time);
  }
  return time;
}
