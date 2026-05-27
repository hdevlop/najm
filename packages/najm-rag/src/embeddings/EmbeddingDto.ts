export interface EmbeddingConfig {
  provider: 'ollama';
  baseUrl: string;
  model: string;
}

export interface EmbeddingResponse {
  embeddings?: number[][];
}
