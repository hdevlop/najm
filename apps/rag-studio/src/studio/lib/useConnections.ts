import { useCallback, useSyncExternalStore } from 'react';
import {
  subscribe,
  listConnections,
  getActiveId,
  setActiveId,
  addConnection,
  updateConnection,
  removeConnection,
  type StudioConnection,
} from './connectionsStore';

export interface UseConnections {
  connections: StudioConnection[];
  activeId: string | null;
  active: StudioConnection | null;
  setActive: (id: string | null) => void;
  add: (input: { name: string; apiBaseUrl: string }) => StudioConnection;
  update: (id: string, patch: Partial<Omit<StudioConnection, 'id'>>) => void;
  remove: (id: string) => void;
}

const EMPTY: StudioConnection[] = [];

export function useConnections(): UseConnections {
  const connections = useSyncExternalStore(subscribe, listConnections, () => EMPTY);
  const activeId = useSyncExternalStore(subscribe, getActiveId, () => null);
  const active = connections.find((c) => c.id === activeId) ?? null;

  const setActive = useCallback((id: string | null) => setActiveId(id), []);
  const add = useCallback((input: { name: string; apiBaseUrl: string }) => addConnection(input), []);
  const update = useCallback(
    (id: string, patch: Partial<Omit<StudioConnection, 'id'>>) => updateConnection(id, patch),
    [],
  );
  const remove = useCallback((id: string) => removeConnection(id), []);

  return { connections, activeId, active, setActive, add, update, remove };
}
