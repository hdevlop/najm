// ============================================================================
// startupLog.ts - Buffering for server.log() calls made before boot
// ============================================================================

/**
 * Holds server.log() entries emitted before the logger is ready, then
 * replays them once the server reaches READY.
 */
export class StartupLogBuffer {
   private readonly entries: unknown[][] = [];

   public get length(): number {
      return this.entries.length;
   }

   public push(entry: unknown[]): void {
      this.entries.push(entry);
   }

   public flush(log: (message: string) => void): void {
      if (!this.entries.length) return;

      for (const entry of this.entries.splice(0)) {
         log(stringifyLogEntry(entry));
      }
   }
}

export function stringifyLogEntry(values: unknown[]): string {
   return values.map(stringifyLogValue).join(' ');
}

function stringifyLogValue(value: unknown): string {
   if (typeof value === 'string') {
      return value;
   }

   if (value === null) {
      return 'null';
   }

   if (value === undefined) {
      return 'undefined';
   }

   if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
   }

   if (value instanceof Error) {
      return value.stack ?? `${value.name}: ${value.message}`;
   }

   try {
      return JSON.stringify(value);
   } catch {
      return String(value);
   }
}
