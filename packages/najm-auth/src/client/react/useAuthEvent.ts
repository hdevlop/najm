import { useEffect, useRef } from 'react';
import { useAuthClient } from './context';
import type { AuthEvent, AuthEventMap, AuthEventHandler } from '../types';

/**
 * Subscribe to a specific auth event. Cleans up on unmount.
 * Uses a stable ref for the handler to avoid re-subscribing on every render.
 *
 * @example
 * ```tsx
 * useAuthEvent('sessionExpired', () => {
 *   toast.error('Session expired, please log in again');
 *   router.push('/login');
 * });
 *
 * useAuthEvent('login', (user) => {
 *   analytics.track('login', { userId: user.id });
 * });
 * ```
 */
export function useAuthEvent<K extends AuthEvent>(
  event: K,
  handler: (data: AuthEventMap[K]) => void,
): void {
  const client = useAuthClient();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener: AuthEventHandler<K> = (data) => handlerRef.current(data);
    client.on(event, listener);
    return () => client.off(event, listener);
  }, [client, event]);
}
