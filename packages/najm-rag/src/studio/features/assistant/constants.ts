// owner: assistant (used by routing-semantics, routing-tests, routing-tools, knowledge, settings)

export type StudioAssistantView =
  | 'routing-semantics'
  | 'routing-tests'
  | 'routing-tools'
  | 'knowledge'
  | 'settings';

export type RefreshBucket =
  | 'routing-semantics'
  | 'routing-tests'
  | 'routing-tools'
  | 'knowledge'
  | 'settings'
  | 'embedding-health';

export const STUDIO_VIEW_TOOL_MAP: Record<StudioAssistantView, string[]> = {
  'routing-semantics': [
    'rag_studio_tool_list',
    'rag_studio_list_semantics',
    'rag_studio_semantic_groups',
    'rag_studio_export_semantics',
    'rag_studio_get_semantic',
    'rag_studio_create_semantic',
    'rag_studio_import_semantics',
    'rag_studio_reindex_semantics',
    'rag_studio_update_semantic',
    'rag_studio_delete_semantics_batch',
    'rag_studio_delete_semantic',
    'rag_studio_preview_routing',
  ],
  'routing-tests': [
    'rag_studio_tool_list',
    'rag_studio_list_routing_tests',
    'rag_studio_export_routing_tests',
    'rag_studio_get_routing_test',
    'rag_studio_create_routing_test',
    'rag_studio_run_all_routing_tests',
    'rag_studio_import_routing_tests',
    'rag_studio_update_routing_test',
    'rag_studio_run_routing_test',
    'rag_studio_delete_routing_tests_batch',
    'rag_studio_delete_all_routing_tests',
    'rag_studio_delete_routing_test',
  ],
  'routing-tools': [
    'rag_studio_tool_list',
    'rag_studio_reindex_tools',
  ],
  knowledge: [
    'rag_studio_search_knowledge',
  ],
  settings: [
    'rag_studio_status',
  ],
};

export const TOOL_REFRESH_BUCKETS: Record<string, RefreshBucket[]> = {
  rag_studio_create_semantic: ['routing-semantics'],
  rag_studio_import_semantics: ['routing-semantics'],
  rag_studio_reindex_semantics: ['routing-semantics', 'embedding-health'],
  rag_studio_update_semantic: ['routing-semantics'],
  rag_studio_delete_semantics_batch: ['routing-semantics'],
  rag_studio_delete_semantic: ['routing-semantics'],

  rag_studio_create_routing_test: ['routing-tests'],
  rag_studio_import_routing_tests: ['routing-tests'],
  rag_studio_update_routing_test: ['routing-tests'],
  rag_studio_run_routing_test: ['routing-tests'],
  rag_studio_run_all_routing_tests: ['routing-tests'],
  rag_studio_delete_routing_tests_batch: ['routing-tests'],
  rag_studio_delete_all_routing_tests: ['routing-tests'],
  rag_studio_delete_routing_test: ['routing-tests'],

  rag_studio_reindex_tools: ['routing-tools', 'embedding-health'],
};

export function normalizeStudioView(workspace: string): StudioAssistantView | null {
  if (workspace === 'routing-semantics') return 'routing-semantics';
  if (workspace === 'routing-tests') return 'routing-tests';
  if (workspace === 'routing-tools') return 'routing-tools';
  if (workspace.startsWith('knowledge-')) return 'knowledge';
  if (workspace === 'dashboard') return 'settings';
  return null;
}