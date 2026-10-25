import type { Query, QueryClient } from '@tanstack/react-query';
import { OfflineUnavailableError } from '../index';

/**
 * Removing cached queries alone can leave mounted observers displaying their old private result.
 * `which` selects the queries to hide (default all), judged before cancellation reverts any state.
 */
export async function hidePrivateQueries(client: QueryClient, which?: (query: Query) => boolean) {
  const hidden = which ? client.getQueryCache().findAll({ predicate: which }) : client.getQueryCache().getAll();
  if (!hidden.length) return;
  await client.cancelQueries(which ? { predicate: query => hidden.includes(query) } : undefined);
  for (const query of hidden) {
    query.setState({ data: undefined, error: new OfflineUnavailableError(), status: 'error', fetchStatus: 'idle' });
  }
}
