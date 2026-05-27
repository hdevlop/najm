import { useState, useCallback, useEffect } from 'react';
import { getStudioBasePath } from '../utils/studioBasePath';

export type Workspace =
  | 'dashboard'
  | 'knowledge-documents'
  | 'knowledge-chunks'
  | 'knowledge-chat'
  | 'routing-tools'
  | 'routing-semantics'
  | 'routing-lab'
  | 'routing-tests'
  | 'storage-semantics'
  | 'storage-tests'
  | 'chat'
  | 'logs'
  | 'logs-unmatched';

export type KnowledgeView = 'documents' | 'chunks' | 'chat';
export type RoutingView = 'tools' | 'semantics' | 'lab' | 'tests';
export type StorageView = 'semantics' | 'tests';

const WORKSPACE_PATHS: Array<[string, Workspace]> = [
  ['/semantics', 'routing-semantics'],
  ['/tests', 'routing-tests'],
  ['/routing-tests', 'routing-tests'],
  ['/tools', 'routing-tools'],
  ['/lab', 'routing-lab'],
  ['/chat', 'chat'],
  ['/logs', 'logs'],
  ['/unmatched', 'logs-unmatched'],
];

let cachedBasePath: string | null = null;

function getBasePath(): string {
  if (typeof window === 'undefined') return '';
  const explicit = getStudioBasePath();
  if (explicit !== null) return explicit;
  if (cachedBasePath !== null) return cachedBasePath;
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  let base = '';
  for (const [suffix] of WORKSPACE_PATHS) {
    if (path === suffix || path.endsWith(suffix)) {
      base = path.slice(0, path.length - suffix.length);
      break;
    }
  }
  if (!base) {
    if (path === '/storage/semantics' || path === '/storage/tests') {
      base = '';
    } else {
      base = path === '/' ? '' : path;
    }
  }
  cachedBasePath = base;
  return base;
}

function stripBase(path: string): string {
  const base = getBasePath();
  if (base && path.startsWith(base)) {
    const rest = path.slice(base.length);
    return rest || '/';
  }
  return path;
}

function rewriteLocation(path: string) {
  if (typeof window === 'undefined') return;
  window.history.replaceState(window.history.state, '', getBasePath() + path);
}

function workspaceFromLocation(): Workspace {
  if (typeof window === 'undefined') return 'dashboard';
  const raw = window.location.pathname.replace(/\/+$/, '') || '/';
  const path = stripBase(raw);
  for (const [suffix, workspace] of WORKSPACE_PATHS) {
    if (path === suffix) return workspace;
  }
  if (path === '/storage/semantics') {
    rewriteLocation('/semantics?view=files');
    return 'routing-semantics';
  }
  if (path === '/storage/tests') {
    rewriteLocation('/tests?view=files');
    return 'routing-tests';
  }
  return 'dashboard';
}

function pathForWorkspace(workspace: Workspace): string {
  const base = getBasePath();
  const suffix = (() => {
    switch (workspace) {
      case 'routing-semantics': return '/semantics';
      case 'routing-tests': return '/tests';
      case 'routing-tools': return '/tools';
      case 'routing-lab': return '/lab';
      case 'chat': return '/chat';
      case 'logs': return '/logs';
      case 'logs-unmatched': return '/unmatched';
      case 'storage-semantics': return '/semantics?view=files';
      case 'storage-tests': return '/tests?view=files';
      default: return '/';
    }
  })();
  if (suffix === '/') return base || '/';
  return base + suffix;
}

function normalizeWorkspace(workspace: Workspace): Workspace {
  if (workspace === 'storage-semantics') return 'routing-semantics';
  if (workspace === 'storage-tests') return 'routing-tests';
  return workspace;
}

export function useWorkspace() {
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace>(() => workspaceFromLocation());

  const navigateTo = useCallback((workspace: Workspace) => {
    const nextWorkspace = normalizeWorkspace(workspace);
    setActiveWorkspaceState(nextWorkspace);
    if (typeof window === 'undefined') return;
    const path = pathForWorkspace(workspace);
    window.history.pushState(window.history.state, '', path);
  }, []);

  useEffect(() => {
    const handlePopState = () => setActiveWorkspaceState(workspaceFromLocation());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return { activeWorkspace, setActiveWorkspace: navigateTo };
}
