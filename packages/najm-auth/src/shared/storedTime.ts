/**
 * Milliseconds since the epoch of a timestamp najm-auth stored itself.
 *
 * najm-auth writes UTC (`toISOString()`). A PostgreSQL `timestamp without time
 * zone` column keeps that wall time but drops the `Z`, and the driver returns
 * `2026-09-29 17:46:05.186`. `new Date()` reads such a string as the server's
 * local time, which moves every deadline by the server's UTC offset: an hour
 * early in Morocco, so a refresh grace window or a lockout had already ended
 * when it was written. A value with no zone is therefore read as UTC. A value
 * that carries one (SQLite keeps the ISO string, `timestamptz` prints `+01`)
 * or a `Date` keeps it.
 */
export function storedTimeMs(value: string | Date): number {
  if (value instanceof Date) return value.getTime();
  const text = value.trim().replace(' ', 'T');
  const time = text.split('T')[1];
  if (!time) return Date.parse(text);
  if (/Z$/i.test(time)) return Date.parse(text);
  const offset = /([+-])(\d{2}):?(\d{2})?$/.exec(time);
  if (!offset) return Date.parse(`${text}Z`);
  const [zone, sign, hours, minutes = '00'] = offset;
  return Date.parse(`${text.slice(0, -zone.length)}${sign}${hours}:${minutes}`);
}
