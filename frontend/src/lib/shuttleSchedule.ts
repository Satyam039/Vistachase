// Moraine Lake & Lake Louise shuttle timetable, from the owner's "Update Vista Chase web" doc
// (Shuttles section). Times are local Alberta time. The shuttles page shows one card per departure
// for the date a guest picks: all seven in June–July, five in August–September. Departure numbers
// stay the same in both seasons.
//
// To change the timetable, edit SHUTTLE_DEPARTURES. Samson Mall (Lake Louise Village) times are
// not confirmed yet: fill `samson` on each departure when they are and the cards show them.

export type ShuttlePickup = "canmore" | "banff" | "samson";

export const SHUTTLE_PICKUPS: { id: ShuttlePickup; label: string; short: string }[] = [
  { id: "canmore", label: "Canmore", short: "Canmore" },
  { id: "banff", label: "Banff", short: "Banff" },
  { id: "samson", label: "Lake Louise Village (Samson Mall)", short: "Samson Mall" },
];

export interface ShuttleDeparture {
  number: number;
  name: string;
  /** 24h "HH:MM" pickup times; null until confirmed. */
  pickup: Record<ShuttlePickup, string | null>;
  moraine: [string, string];
  louise: [string, string];
  /** Estimated return, 24h "HH:MM". */
  returnBanff: string;
  returnCanmore: string;
}

export const SHUTTLE_DEPARTURES: ShuttleDeparture[] = [
  { number: 1, name: "Early Morning", pickup: { canmore: "02:45", banff: "03:15", samson: null }, moraine: ["04:30", "06:00"], louise: ["06:30", "08:00"], returnBanff: "09:00", returnCanmore: "09:30" },
  { number: 2, name: "Early Morning", pickup: { canmore: "03:45", banff: "04:15", samson: null }, moraine: ["05:30", "07:00"], louise: ["07:30", "09:30"], returnBanff: "10:30", returnCanmore: "11:00" },
  { number: 3, name: "Morning", pickup: { canmore: "06:00", banff: "06:30", samson: null }, moraine: ["07:30", "09:00"], louise: ["09:30", "12:00"], returnBanff: "13:00", returnCanmore: "13:30" },
  { number: 4, name: "Late Morning", pickup: { canmore: "09:45", banff: "10:15", samson: null }, moraine: ["11:15", "12:45"], louise: ["13:15", "14:45"], returnBanff: "15:45", returnCanmore: "16:15" },
  { number: 5, name: "Midday", pickup: { canmore: "11:00", banff: "11:30", samson: null }, moraine: ["12:30", "14:15"], louise: ["14:45", "17:00"], returnBanff: "18:00", returnCanmore: "18:30" },
  { number: 6, name: "Afternoon", pickup: { canmore: "13:30", banff: "14:00", samson: null }, moraine: ["15:00", "16:30"], louise: ["17:00", "19:30"], returnBanff: "20:30", returnCanmore: "21:00" },
  { number: 7, name: "Late Afternoon", pickup: { canmore: "16:15", banff: "16:45", samson: null }, moraine: ["17:45", "19:00"], louise: ["19:30", "21:00"], returnBanff: "22:00", returnCanmore: "22:30" },
];

/**
 * Which departures run in August–September. The doc says five but not which five; until the owner
 * confirms, the earliest (1) and latest (7) are dropped as the days get shorter.
 */
export const LATE_SEASON_DEPARTURES = [2, 3, 4, 5, 6];

/** Season months (1-12). June–July: all seven. August–September: LATE_SEASON_DEPARTURES. */
const PEAK_MONTHS = [6, 7];
const LATE_MONTHS = [8, 9];

const monthOf = (date: string) => Number(date.slice(5, 7));

export const inSeason = (date: string) => [...PEAK_MONTHS, ...LATE_MONTHS].includes(monthOf(date));

export function departuresFor(date: string): ShuttleDeparture[] {
  const m = monthOf(date);
  if (PEAK_MONTHS.includes(m)) return SHUTTLE_DEPARTURES;
  if (LATE_MONTHS.includes(m)) return SHUTTLE_DEPARTURES.filter((d) => LATE_SEASON_DEPARTURES.includes(d.number));
  return [];
}

/** "YYYY-MM-DD" today in Alberta. */
export function albertaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Today if the shuttle runs today, otherwise the next June 1st (or the next in-season day). */
export function firstShuttleDate(today: string): string {
  if (inSeason(today)) return today;
  const year = Number(today.slice(0, 4));
  return monthOf(today) < 6 ? `${year}-06-01` : `${year + 1}-06-01`;
}

/** "14:45" -> "2:45 PM". Written out by hand so server and browser print the same text. */
export function clock(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** ["07:30","09:00"] -> "7:30–9:00 AM"; ["09:30","12:00"] -> "9:30 AM–12:00 PM". */
export function clockRange([a, b]: [string, string]): string {
  const [ca, cb] = [clock(a), clock(b)];
  const sa = ca.slice(-2);
  return sa === cb.slice(-2) ? `${ca.slice(0, -3)}–${cb}` : `${ca}–${cb}`;
}
