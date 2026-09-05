// ============================================================================
// najm-auth/client/edge — Edge Runtime helpers
// ============================================================================
//
// Keep this entrypoint free of browser-only and Node-only imports. Next.js
// middleware is analyzed as an Edge bundle, so importing the wider server
// surface can pull in helpers that use APIs like crypto or BroadcastChannel.

export {
  withAuthMiddleware,
  type AuthMiddlewareConfig,
  type AuthProxyOptions,
  type ProxySessionMode,
} from './server/withAuthMiddleware';
export type {
  SessionRecoveryErrorDetails,
  SessionRecoveryFailure,
  SessionRecoveryFailureReason,
} from './sessionRecovery';
