import { getStudioBasePath } from './studioBasePath';

export type FileBackedViewMode = 'table' | 'json' | 'files';

export interface FileViewUrlState {
  view?: FileBackedViewMode;
  group?: string;
  lang?: string;
}

const VIEW_MODES = new Set<FileBackedViewMode>(['table', 'json', 'files']);

export function readFileViewUrlState(): FileViewUrlState {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const rawView = params.get('view');
  return {
    view: rawView && VIEW_MODES.has(rawView as FileBackedViewMode)
      ? rawView as FileBackedViewMode
      : undefined,
    group: params.get('group') || undefined,
    lang: params.get('lang') || undefined,
  };
}

export function getStoredFileViewMode(
  key: string,
  legacyKey: string,
  fallback: FileBackedViewMode = 'table',
): FileBackedViewMode {
  if (typeof window === 'undefined') return fallback;
  for (const candidateKey of [key, legacyKey]) {
    try {
      const raw = window.localStorage.getItem(candidateKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (VIEW_MODES.has(parsed)) return parsed;
    } catch {
      // Ignore malformed localStorage values.
    }
  }
  return fallback;
}

export function writeFileViewUrl(pathname: string, state: FileViewUrlState) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);

  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const explicitBase = getStudioBasePath();
  let base: string;
  if (explicitBase !== null) {
    base = explicitBase;
  } else {
    const current = url.pathname.replace(/\/+$/, '') || '/';
    base = current.endsWith(normalized)
      ? current.slice(0, current.length - normalized.length)
      : current === normalized
        ? ''
        : current;
  }
  url.pathname = `${base}${normalized}`;

  if (state.view) url.searchParams.set('view', state.view);
  else url.searchParams.delete('view');

  if (state.group) url.searchParams.set('group', state.group);
  else url.searchParams.delete('group');

  if (state.lang) url.searchParams.set('lang', state.lang);
  else url.searchParams.delete('lang');

  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}
