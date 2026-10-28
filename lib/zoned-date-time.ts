/** Convert a wall-clock time in an explicitly selected zone; reject DST gaps and ambiguous hours. */
export function zonedDateTimeToIso(value: string, timeZone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return "";
  const wall = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 16) !== value) return "";
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    const wallAt = (timestamp: number) => {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
      return Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    };
    const offsets = new Set([-36, 0, 36].map(hours => { const instant = wall + hours * 3600000; return wallAt(instant) - instant; }));
    const matches = [...offsets].map(offset => wall - offset).filter(instant => wallAt(instant) === wall);
    return matches.length === 1 ? new Date(matches[0]).toISOString() : "";
  } catch { return ""; }
}
