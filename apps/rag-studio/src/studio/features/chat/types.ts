// owner: chat (used by knowledge, routing-lab, app)

import type { ChatDebugRequest, ChatDebugResponse, ChatDebugError } from 'najm-rag';
import type { RoutingPreviewResult } from '../routing-semantics/types';

// Chat domain types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  timestamp: string;
}

export interface Citation {
  chunkId: string;
  documentId: string;
  text: string;
  score: number;
  ordinal: number;
  sourceType: string;
}

// Chat debug types — request/error aliased to the canonical najm-rag contract.
// The response is a local extension of the canonical response: the studio
// trace panel treats the routing field as a richer RoutingPreviewResult so the
// lab components can render finalToolScores/routingDecisions on top of the
// debug endpoint's output.
export type StudioChatDebugRequest = ChatDebugRequest;
export type StudioChatDebugError = ChatDebugError;
export type StudioChatDebugResponse = Omit<ChatDebugResponse, 'routing'> & {
  routing?: RoutingPreviewResult;
};

// Re-exports
export type { PendingRoutingLabQuery, PendingTestDraft, PendingSemanticDraft } from '../../lib/chatDraftsContext';
export type { MCPTool } from '../routing-tools/types';
export type { JsonViewColors } from '../routing-tools/types';
export type { SemanticPhraseResponse } from '../routing-semantics/types';
export type { RoutingPreviewResult } from '../routing-semantics/types';
