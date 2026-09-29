/**
 * Runs `run` with the process in another time zone, so a regression that only
 * shows away from UTC fails on a UTC machine too. Bun applies `TZ` at runtime.
 */
export async function inTimeZone<T>(zone: string, run: () => Promise<T> | T): Promise<T> {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

/** What PostgreSQL returns from a `timestamp without time zone` holding UTC. */
export function postgresTimestamp(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').replace('Z', '');
}
