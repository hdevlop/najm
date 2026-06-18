// owner: assistant (used by routing-semantics, routing-tests, routing-tools, knowledge, settings)
//
// STUDIO_VIEW_TOOL_MAP and normalizeStudioView are imported from
// `najm-rag/studio-contract` (the canonical source of truth) to avoid drift
// between the UI and the assistant provider.

export {
  STUDIO_VIEW_TOOL_MAP,
  normalizeStudioAssistantView as normalizeStudioView,
  type StudioAssistantView,
} from 'najm-rag/studio-contract';

export type RefreshBucket =
  | 'routing-semantics'
  | 'routing-tests'
  | 'routing-tools'
  | 'knowledge'
  | 'settings'
  | 'embedding-health';

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