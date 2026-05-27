export const CHATBOT_CONFIG = Symbol.for('najm:chatbot:config');
export const CHATBOT_SCHEMA = Symbol.for('najm:chatbot:schema');
export const VECTOR_STRATEGY = Symbol.for('najm:chatbot:vector-strategy');
export const CHATBOT_ROUTING_PROVIDER = Symbol.for('najm:chatbot:routing-provider');
export const CHATBOT_CONTEXT_PROVIDER = Symbol.for('najm:chatbot:context-provider');

export interface ChatbotContextProvider {
  getContext(userText: string): Promise<string | null>;
  getContextTrace?: (userText: string) => Promise<{
    used: boolean;
    chunks: Array<{
      chunkId: string;
      documentId: string;
      text: string;
      score: number;
      source?: string | null;
    }>;
  } | null>;
}

export const CHATBOT_ROUTING_PREVIEW_PROVIDER = Symbol.for('najm:chatbot:routing-preview-provider');

export interface ChatbotRoutingPreviewProvider {
  previewRouting(userText: string): Promise<{
    status: string;
    finalTools: string[];
    matches: Array<{ toolName: string; similarity: number; source?: string; matchLevel?: string }>;
    dependencies: Array<{ toolName: string; reason: string }>;
    confirmations: Array<{ toolName: string; level: string; message?: string }>;
    config: {
      maxTools: number;
      topSemanticHits: number;
      similarityThreshold: number;
      fallbackOnNoMatch: string;
      fallbackOnRouterError: string;
    };
    error?: string;
  }>;
}
