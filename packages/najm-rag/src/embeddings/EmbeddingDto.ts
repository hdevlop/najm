export interface EmbeddingConfig {
  provider: 'ollama' | 'openai-compatible';
  baseUrl: string;
  model: string;
  dimensions?: number;
  apiKey?: string;
  batchSize?: number;
  truncateDimensions?: boolean;
  queryPrefix?: string;
  documentPrefix?: string;
}

export interface EmbeddingResponse {
  embeddings?: number[][];
}

export interface OpenAiEmbeddingResponse {
  data?: Array<{ index: number; embedding: number[] }>;
}
