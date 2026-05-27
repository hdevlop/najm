export type StorageStudioPanel = 'dashboard' | 'explorer';
export type StorageStudioView = 'list' | 'grid';

export interface StorageStudioUrlState {
  panel: StorageStudioPanel;
  bucket: string | null;
  prefix: string;
  view: StorageStudioView;
}

function isView(value: string | null): value is StorageStudioView {
  return value === 'list' || value === 'grid';
}

export function readStorageStudioUrlState(): StorageStudioUrlState {
  if (typeof window === 'undefined') {
    return { panel: 'dashboard', bucket: null, prefix: '', view: 'grid' };
  }

  const params = new URLSearchParams(window.location.search);
  const bucket = params.get('bucket');
  const view = params.get('view');
  const panel = bucket ? 'explorer' : 'dashboard';

  return {
    panel,
    bucket,
    prefix: params.get('prefix') ?? '',
    view: isView(view) ? view : 'grid',
  };
}

export function writeStorageStudioUrlState(
  state: StorageStudioUrlState,
  mode: 'push' | 'replace' = 'replace',
) {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const params = url.searchParams;
  params.delete('panel');
  params.delete('bucket');
  params.delete('prefix');
  params.delete('view');

  if (state.panel === 'explorer' && state.bucket) {
    params.set('bucket', state.bucket);
    if (state.prefix) params.set('prefix', state.prefix);
    if (state.view !== 'grid') params.set('view', state.view);
  } else if (state.panel !== 'dashboard') {
    params.set('panel', state.panel);
  }

  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
  if (mode === 'push') window.history.pushState(window.history.state, '', next);
  else window.history.replaceState(window.history.state, '', next);
}
