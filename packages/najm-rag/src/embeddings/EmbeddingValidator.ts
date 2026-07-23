import { Service } from 'najm-core';
import type { EmbeddingResponse } from './EmbeddingDto';

@Service()
export class EmbeddingValidator {
  assertResponse(data: EmbeddingResponse, expectedCount: number): number[][] {
    if (!data.embeddings || !Array.isArray(data.embeddings)) {
      throw new Error('Embedding response missing embeddings array');
    }

    if (data.embeddings.length !== expectedCount) {
      throw new Error(
        `Embedding count mismatch: expected ${expectedCount}, got ${data.embeddings.length}`,
      );
    }

    return data.embeddings.map((emb, i) => {
      if (!Array.isArray(emb) || emb.length !== 768) {
        throw new Error(
          `Invalid embedding dimensions at index ${i}: expected 768, got ${Array.isArray(emb) ? emb.length : typeof emb}`,
        );
      }
      return emb;
    });
  }
}
