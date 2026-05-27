// ============================================================================
// najm-auth/client/server — SSR Helpers
// ============================================================================

export { getServerSession } from './getServerSession';
export { createServerClient } from './createServerClient';
export { withAuthMiddleware } from './withAuthMiddleware';

// Next.js-aware helpers (dynamic-import next/headers + next/navigation)
export {
  getSession,
  NoSessionError,
  AuthConfigError,
  AuthTransportError,
  type ServerSession,
  type GetSessionConfig,
} from './getSession';
export { withAuth, type WithAuthOptions, type WithAuthProps } from './withAuth';

// Unified Next.js surface
export { defineAuth, type DefineAuthConfig, type AuthKit } from './defineAuth';
