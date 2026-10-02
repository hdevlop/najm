import { createAlsToken } from 'diject';

/**
 * Server-generated id that keys the request's DI scope. Never taken from the
 * client, so two requests can never share request-scoped instances.
 */
export const REQUEST_ID = createAlsToken<string>('requestId');

/**
 * Correlation id echoed in the request-id header: the client-supplied value
 * when present, otherwise the generated one. Use it for logs and tracing only.
 */
export const CORRELATION_ID = createAlsToken<string>('correlationId');
