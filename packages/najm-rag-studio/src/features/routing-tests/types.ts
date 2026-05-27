// owner: routing-tests (used by storage)

// Routing test domain types
export interface RoutingTestCase {
  id: string;
  name: string;
  query: string;
  expectedTools: string[];
  forbiddenTools: string[];
  enabled: boolean;
  createdAt: string;
}

export interface TestResult {
  actualTools: string[];
  confidence: number;
  status: 'pass' | 'fail' | 'low_confidence';
  missingTools: string[];
  scores: Array<{
    toolName: string;
    similarity: number;
    matchLevel: 'primary' | 'secondary' | 'below_threshold';
  }>;
}

export interface TestCase {
  id: string;
  name: string;
  query: string;
  lang: string;
  expectedTools: string[];
}

// Cross-feature re-exports
export type { JsonViewColors } from './routing-tools/types';
export type { TestRunnerViewMode } from './routing-tools/types';