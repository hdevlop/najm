import { createContext, useContext, type Context } from 'react';
import type { NajmAuthClient } from '../NajmAuthClient';

const KEY = Symbol.for('najm:auth:client:context');
const contextStore = globalThis as Record<PropertyKey, unknown>;

function getAuthClientContext(): Context<NajmAuthClient | null> {
  const existing = contextStore[KEY];
  if (existing) {
    return existing as Context<NajmAuthClient | null>;
  }

  // Reuse one context object even when this module is evaluated multiple times.
  const context = createContext<NajmAuthClient | null>(null);
  contextStore[KEY] = context;
  return context;
}

export const AuthClientContext = getAuthClientContext();

export function useAuthClient(): NajmAuthClient {
  const client = useContext(AuthClientContext);
  if (!client) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return client;
}
