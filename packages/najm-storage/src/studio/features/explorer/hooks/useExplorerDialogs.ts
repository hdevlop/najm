import { useCallback, useState } from 'react';
import type { NewFolderState, RenameState, MoveState, DeleteState } from '../types';
import type { ExplorerMutations } from './useExplorerMutations';

const initialNewFolder: NewFolderState = { open: false, name: '', busy: false, error: null };

interface Options {
  prefix: string;
  mutations: ExplorerMutations;
  /** Called after a successful move/delete to clear multi-selection. */
  onClearSelection: () => void;
}

/**
 * Owns the four dialog states (new folder, rename, move, delete) and exposes
 * an `open` + `change` + `submit` + `close` triplet per dialog. Submit calls
 * the matching mutation and closes on success.
 */
export function useExplorerDialogs({ prefix, mutations, onClearSelection }: Options) {
  const [newFolder, setNewFolder] = useState<NewFolderState>(initialNewFolder);
  const [rename, setRename] = useState<RenameState | null>(null);
  const [move, setMove] = useState<MoveState | null>(null);
  const [del, setDel] = useState<DeleteState | null>(null);

  // ----- new folder -----
  const openNewFolder    = useCallback(() => setNewFolder({ open: true, name: '', busy: false, error: null }), []);
  const closeNewFolder   = useCallback(() => setNewFolder((s) => ({ ...s, open: false })), []);
  const changeNewFolder  = useCallback((patch: Partial<NewFolderState>) => setNewFolder((s) => ({ ...s, ...patch })), []);
  const submitNewFolder  = useCallback(async () => {
    const name = newFolder.name.trim();
    if (!name) return setNewFolder((s) => ({ ...s, error: 'Name is required.' }));
    if (name.includes('/') || name.includes('\\')) return setNewFolder((s) => ({ ...s, error: 'Name cannot contain slashes.' }));
    setNewFolder((s) => ({ ...s, busy: true, error: null }));
    try {
      await mutations.createFolder(`${prefix ?? ''}${name}`);
      setNewFolder(initialNewFolder);
    } catch (e: any) {
      setNewFolder((s) => ({ ...s, busy: false, error: e?.message ?? 'Failed to create folder' }));
    }
  }, [newFolder.name, prefix, mutations]);

  // ----- rename -----
  const openRename   = useCallback((path: string) => {
    const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
    const oldName = cleanPath.split('/').pop()!;
    setRename({ path, value: oldName, busy: false, error: null });
  }, []);
  const closeRename  = useCallback(() => setRename(null), []);
  const changeRename = useCallback((patch: Partial<RenameState>) => setRename((s) => (s ? { ...s, ...patch } : s)), []);
  const submitRename = useCallback(async () => {
    setRename((current) => {
      if (!current) return current;
      const newName = current.value.trim();
      const hasTrailingSlash = current.path.endsWith('/');
      const cleanPath = hasTrailingSlash ? current.path.slice(0, -1) : current.path;
      const oldName = cleanPath.split('/').pop()!;
      if (!newName) return { ...current, error: 'Name is required.' };
      if (newName === oldName) { return null; }
      if (newName.includes('/')) return { ...current, error: 'Name cannot contain slashes.' };

      // begin the async work — note state is captured here, not in closure
      (async () => {
        setRename((s) => (s ? { ...s, busy: true, error: null } : s));
        try {
          const parent = cleanPath.slice(0, cleanPath.length - oldName.length);
          const target = `${parent}${newName}${hasTrailingSlash ? '/' : ''}`;
          await mutations.move(current.path, target);
          mutations.refresh();
          setRename(null);
        } catch (e: any) {
          setRename((s) => (s ? { ...s, busy: false, error: e?.message ?? 'Rename failed' } : s));
        }
      })();

      return { ...current, busy: true, error: null };
    });
  }, [mutations]);

  // ----- move -----
  const openMove   = useCallback((paths: string[]) => setMove({ paths, dest: prefix ?? '', busy: false, error: null }), [prefix]);
  const closeMove  = useCallback(() => setMove(null), []);
  const changeMove = useCallback((patch: Partial<MoveState>) => setMove((s) => (s ? { ...s, ...patch } : s)), []);
  const submitMove = useCallback(async () => {
    setMove((current) => {
      if (!current) return current;
      const dest = current.dest.replace(/^\/+/, '');
      const normalized = dest && !dest.endsWith('/') ? `${dest}/` : dest;

      (async () => {
        setMove((s) => (s ? { ...s, busy: true, error: null } : s));
        try {
          for (const src of current.paths) {
            const name = src.split('/').pop()!;
            await mutations.move(src, `${normalized}${name}`);
          }
          mutations.refresh();
          onClearSelection();
          setMove(null);
        } catch (e: any) {
          setMove((s) => (s ? { ...s, busy: false, error: e?.message ?? 'Move failed' } : s));
        }
      })();

      return { ...current, busy: true, error: null };
    });
  }, [mutations, onClearSelection]);

  // ----- delete -----
  const openDelete   = useCallback((paths: string[]) => {
    if (!paths.length) return;
    setDel({ paths, busy: false, error: null });
  }, []);
  const closeDelete  = useCallback(() => setDel(null), []);
  const submitDelete = useCallback(async () => {
    setDel((current) => {
      if (!current) return current;

      (async () => {
        setDel((s) => (s ? { ...s, busy: true, error: null } : s));
        try {
          await mutations.deleteMany(current.paths);
          onClearSelection();
          setDel(null);
        } catch (e: any) {
          setDel((s) => (s ? { ...s, busy: false, error: e?.message ?? 'Delete failed' } : s));
        }
      })();

      return { ...current, busy: true, error: null };
    });
  }, [mutations, onClearSelection]);

  return {
    newFolder: { state: newFolder, open: openNewFolder, close: closeNewFolder, change: changeNewFolder, submit: submitNewFolder },
    rename:    { state: rename,    open: openRename,    close: closeRename,    change: changeRename,    submit: submitRename },
    move:      { state: move,      open: openMove,      close: closeMove,      change: changeMove,      submit: submitMove },
    delete:    { state: del,       open: openDelete,    close: closeDelete,                              submit: submitDelete },
  };
}

export type ExplorerDialogs = ReturnType<typeof useExplorerDialogs>;
