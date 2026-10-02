// owner: routing-tools (used by routing-semantics, routing-tests, storage, chat, knowledge, dashboard, settings)

// Core MCP tool domain types
export interface MCPToolParameter {
  name: string;
  type: string;
  required: boolean;
  smartResolver?: {
    accepts: string[];
    examples: string[];
  };
}

export interface MCPToolConfirmation {
  level?: 'notice' | 'warning' | 'danger';
  message?: string;
  resolvedMessage?: string;
}

export interface MCPTool {
  id: string;
  name: string;
  group: string;
  description: string;
  schemaFingerprint: string;
  indexed: boolean;
  dependencies?: string[];
  parameters?: MCPToolParameter[];
  confirmation?: MCPToolConfirmation;
}

export interface JsonViewColors {
  toolName: string;
  langCode: string;
  phrase: string;
  bracket: string;
  key: string;
  string: string;
  number: string;
  background: string;
}

// View modes per feature
export type ToolsViewMode = 'table' | 'json';
export type TestRunnerViewMode = 'table' | 'json' | 'files';
export type SemanticsViewMode = 'table' | 'json' | 'files';

// Settings-owned domain types used across features
export interface LiveRoutingSettings {
  enableKnowledge: boolean;
  maxTools: number;
  topSemanticHits: number;
  similarityThreshold: number;
  fallbackOnNoMatch: 'all' | 'none';
  fallbackOnRouterError: 'all' | 'none';
  allowedLangs?: string[];
  dependencies: Record<string, string[]>;
  toolsOverride: 'auto' | 'none' | 'all';
  contextOverride: 'auto' | 'none';
}

export interface IndexSettings {
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimensions: number;
  vectorStoreDriver: string;
  dialect: string;
  allowedLangs?: string[];
}