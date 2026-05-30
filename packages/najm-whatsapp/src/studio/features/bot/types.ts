export type MatchType = 'exact' | 'prefix' | 'regex';

export interface AutoReplyRule {
  id: string;
  instanceId: string;
  pattern: string;
  response: string;
  matchType: MatchType;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiConfig {
  instanceId: string;
  enabled: boolean;
  provider: string | null;
  model: string | null;
  systemPrompt: string | null;
  temperature: string | null;
  updatedAt: string;
}
