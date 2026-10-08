export function getMountainTimeInstant(dateObj: Date, timeObj: Date | null): Date {
  const dateStr = dateObj.toISOString().split('T')[0];
  const timeStr = timeObj ? timeObj.toISOString().split('T')[1].slice(0, 5) : "08:00";
  
  const dt = new Date(`${dateStr}T${timeStr}:00.000Z`);
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Edmonton',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
    timeZoneName: 'shortOffset'
  });
  
  const parts = formatter.formatToParts(dt);
  const tzOffsetPart = parts.find(p => p.type === 'timeZoneName');
  
  let offsetString = tzOffsetPart?.value; 
  if (!offsetString || offsetString === 'GMT') {
     offsetString = "-07:00"; 
  } else {
     offsetString = offsetString.replace('GMT', '');
     if (offsetString.length === 2) offsetString += ':00'; 
     if (offsetString.length === 3) offsetString = offsetString.slice(0,2) + ':00'; 
  }
  
  if (offsetString.length < 6) {
    const sign = offsetString[0];
    const hour = offsetString.match(/\d+/)?.[0].padStart(2, '0');
    offsetString = `${sign}${hour}:00`;
  }
  
  return new Date(`${dateStr}T${timeStr}:00.000${offsetString}`);
}

// Departure dates and times are stored as wall-clock values in Mountain Time: the date as UTC
// midnight of that calendar day, the time of day on 1970-01-01 in UTC. getMountainTimeInstant()
// turns the pair into the real instant. The API exchanges them as "YYYY-MM-DD" and "HH:MM".

/** "2026-10-08" → the stored date value. */
export function dateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Expected YYYY-MM-DD, got "${value}"`);
  return new Date(`${value}T00:00:00.000Z`);
}

/** "08:30" → the stored time-of-day value. */
export function timeOfDay(value: string): Date {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error(`Expected HH:MM, got "${value}"`);
  return new Date(`1970-01-01T${value}:00.000Z`);
}

/** Stored date value → "2026-10-08". */
export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Stored time-of-day value → "08:30". */
export function formatTimeOfDay(value: Date): string;
export function formatTimeOfDay(value: Date | null | undefined): string | null;
export function formatTimeOfDay(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(11, 16) : null;
}

/** Today's date in Banff (America/Edmonton) as "YYYY-MM-DD"; the operating day for dispatch and messages. */
export function todayInMountainTime(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
