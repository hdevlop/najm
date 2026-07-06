import { describe, expect, test } from 'bun:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { chatbotDocumentEmbeddingsTable } from '../src/schema/pg';

describe('Postgres RAG schema', () => {
  test('declares document embedding HNSW index with native vector opclass metadata', () => {
    const { indexes } = getTableConfig(chatbotDocumentEmbeddingsTable);
    const hnswIndex = indexes.find((idx) => idx.config.name === 'chatbot_document_embeddings_hnsw_idx');

    expect(hnswIndex).toBeDefined();
    expect(hnswIndex?.config.method).toBe('hnsw');

    const [column] = hnswIndex?.config.columns ?? [];
    expect((column as any)?.name).toBe('embedding');
    expect((column as any)?.type).toBe('PgVector');
    expect((column as any)?.indexConfig?.opClass).toBe('vector_cosine_ops');
  });
});
