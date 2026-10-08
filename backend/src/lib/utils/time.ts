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
