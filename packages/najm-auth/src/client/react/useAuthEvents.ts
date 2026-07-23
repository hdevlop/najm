import { useEffect, useRef, useState } from 'react';
import { useAuthClient } from './context';
import type { AuthEvent, AuthEventMap, AuthEventHandler } from '../types';

const ALL_EVENTS: AuthEvent[] = [
  'login',
  'logout',
  'logoutError',
  'tokenRefresh',
  'sessionExpired',
  'stateChange',
  'userUpdated',
];

export interface AuthEventEntry {
  event: AuthEvent;
  data: unknown;
  timestamp: number;
}

/**
 * Subscribe to all auth events. Returns a log of recent events.
 * Useful for logging, debug panels, or analytics.
 *
 * @example
 * ```tsx
 * const events = useAuthEvents({ maxEntries: 50 });
 * // events = [{ event: 'login', data: {...}, timestamp: 1234 }, ...]
 * ```
 */
export function useAuthEvents(opts?: { maxEntries?: number }): AuthEventEntry[] {
  const client = useAuthClient();
  const max = opts?.maxEntries ?? 100;
  const [entries, setEntries] = useState<AuthEventEntry[]>([]);
  const maxRef = useRef(max);
  maxRef.current = max;

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    for (const event of ALL_EVENTS) {
      const handler = ((data: AuthEventMap[typeof event]) => {
        setEntries((prev) => {
          const next = [...prev, { event, data, timestamp: Date.now() }];
          return next.length > maxRef.current ? next.slice(-maxRef.current) : next;
        });
      }) as AuthEventHandler<typeof event>;
      client.on(event, handler);
      cleanups.push(() => client.off(event, handler));
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [client]);

  return entries;
}
