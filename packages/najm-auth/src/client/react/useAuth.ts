import { useSyncExternalStore } from 'react';
import { useAuthClient } from './context';
import type { AuthState } from '../types';

/**
 * Subscribe to the full auth state.
 * Re-renders when any part of the state changes.
 */
export function useAuth(): AuthState {
  const client = useAuthClient();
  return useSyncExternalStore(
    (cb) => client.subscribe(cb),
    () => client.getState(),
    () => client.getState(),
  );
}
