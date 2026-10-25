import { expect, test } from 'bun:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { hidePrivateQueries } from './support/app';

test('access changes hide private data from mounted observers and fence a late fetch', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const key = ['students', 'previous-account', '2026-2027'];
  client.setQueryData(key, ['private previous result']);
  let finish!: (value: string[]) => void;
  const observer = new QueryObserver(client, { queryKey: key, queryFn: () => new Promise<string[]>(resolve => { finish = resolve; }) });
  const unsubscribe = observer.subscribe(() => undefined);
  try {
    expect(observer.getCurrentResult().data).toEqual(['private previous result']);
    await hidePrivateQueries(client);
    expect(observer.getCurrentResult().data).toBeUndefined();
    expect(observer.getCurrentResult().error).toHaveProperty('code', 'OFFLINE_DATA_UNAVAILABLE');
    client.clear();
    finish(['late private response']);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(observer.getCurrentResult().data).toBeUndefined();
    expect(client.getQueryData(key)).toBeUndefined();
  } finally { unsubscribe(); client.clear(); }
});

test('a filter hides only the selected queries, judged before cancellation', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['fees'], ['server result'], { updatedAt: 1000 });
  client.setQueryData(['students'], ['retained copy'], { updatedAt: 5000 });
  try {
    await hidePrivateQueries(client, query => query.state.dataUpdatedAt >= 4000);
    expect(client.getQueryData<string[]>(['fees'])).toEqual(['server result']);
    expect(client.getQueryState(['students'])?.error).toHaveProperty('code', 'OFFLINE_DATA_UNAVAILABLE');
    expect(client.getQueryData(['students'])).toBeUndefined();
  } finally { client.clear(); }
});
