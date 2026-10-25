'use client';
/**
 * Stands in for `najm-auth/client/react` in an offline shell build. Inside a
 * `CachedAccountContext`, `useAuth` and `usePermissions` describe the cached
 * account: read permissions only, never an authenticated session. It never
 * hydrates the auth client or sets `isAuthenticated`.
 */
import { createContext, useContext } from 'react';
import { useAuth as useOnlineAuth, usePermissions as useOnlinePermissions } from 'najm-auth/client/react';
import type { OfflineGrant } from '../index';
export * from 'najm-auth/client/react';
export const CachedAccountContext = createContext<OfflineGrant | null>(null);
export function useAuth(): ReturnType<typeof useOnlineAuth> {
  const online = useOnlineAuth();
  const grant = useContext(CachedAccountContext);
  return grant ? { ...online, user: { ...grant.account, permissions: grant.permissions },
    isAuthenticated: false, isLoading: false, accessToken: null, permissions: grant.permissions, roles: [grant.account.role] } as ReturnType<typeof useOnlineAuth> : online;
}
export function usePermissions(): ReturnType<typeof useOnlinePermissions> {
  const online = useOnlinePermissions();
  const grant = useContext(CachedAccountContext);
  if (!grant) return online;
  return { can: (permission: string) => permission.startsWith('read:') && grant.permissions.includes(permission),
    hasRole: (role: string) => role === grant.account.role,
    hasAnyRole: (roles: string[]) => roles.includes(grant.account.role),
    permissions: grant.permissions, roles: [grant.account.role] };
}
