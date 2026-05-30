import { useCallback, useMemo, useState } from 'react';
import {
  getSharedLinks,
  removeSharedLink,
  clearSharedLinks,
  type SharedLink,
} from '../../../lib/sharedLinks';

export function useSharedLinks() {
  const [version, setVersion] = useState(0);

  const data = useMemo(() => {
    void version;
    return getSharedLinks();
  }, [version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const remove = useCallback(
    (id: string) => {
      removeSharedLink(id);
      refresh();
    },
    [refresh],
  );

  const clear = useCallback(() => {
    clearSharedLinks();
    refresh();
  }, [refresh]);

  return { data, remove, clear, refresh };
}

export type UseSharedLinksReturn = ReturnType<typeof useSharedLinks>;
