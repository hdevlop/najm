import { useAuth } from './useAuth';
import type { AuthUser } from '../types';

/**
 * Get the current user. Returns null if not authenticated.
 */
export function useUser(): AuthUser | null {
  const { user } = useAuth();
  return user;
}
