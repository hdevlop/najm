export type Workspace =
  | 'dashboard'
  | 'knowledge-documents'
  | 'knowledge-chunks'
  | 'knowledge-chat'
  | 'routing-tools'
  | 'routing-semantics'
  | 'routing-lab'
  | 'routing-tests'
  | 'chat'
  | 'logs'
  | 'logs-unmatched'
  | 'storage-semantics'
  | 'storage-tests';

export type KnowledgeView = 'documents' | 'chunks' | 'chat';

export type StorageView = 'semantics' | 'tests';
