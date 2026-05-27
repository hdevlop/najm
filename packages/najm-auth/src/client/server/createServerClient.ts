// ============================================================================
// createServerClient — Cookie-forwarding fetch for SSR
// ============================================================================

import { FetchClient } from '../FetchClient';

interface ServerClientConfig {
  /** API base URL (e.g., 'http://localhost:3000/api') */
  baseURL: string;
  /** Cookie header string to forward */
  cookie: string;
  /** Additional headers */
  headers?: Record<string, string>;
}

/**
 * Create a FetchClient that forwards cookies from the incoming request.
 * Use for server-side data fetching that requires authentication.
 *
 * @example
 * ```ts
 * import { createServerClient } from 'najm-auth/client/server';
 *
 * export async function loader({ request }) {
 *   const api = createServerClient({
 *     baseURL: 'http://localhost:3000/api',
 *     cookie: request.headers.get('cookie') ?? '',
 *   });
 *   const products = await api.get('/products');
 *   return { products };
 * }
 * ```
 */
export function createServerClient(config: ServerClientConfig): FetchClient {
  return new FetchClient({
    baseURL: config.baseURL,
    credentials: 'omit', // Server-side: no browser cookie jar
    getToken: () => null, // Token comes from cookie, not header
    defaultHeaders: {
      'Cookie': config.cookie,
      ...config.headers,
    },
  });
}

// Re-export FetchClient for type reference
export { FetchClient } from '../FetchClient';
