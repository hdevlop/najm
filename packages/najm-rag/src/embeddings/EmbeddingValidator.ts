import { Service } from 'najm-core';
import type { EmbeddingResponse, OpenAiEmbeddingResponse } from './EmbeddingDto';

@Service()
export class EmbeddingValidator {
  assertResponse(data: EmbeddingResponse, expectedCount: number, dimensions = 768): number[][] {
    if (!Array.isArray(data?.embeddings)) {
      throw new Error('Embedding response missing embeddings array');
    }

    if (data.embeddings.length !== expectedCount) {
      throw new Error(
        `Embedding count mismatch: expected ${expectedCount}, got ${data.embeddings.length}`,
      );
    }

    return data.embeddings.map((emb, i) => {
      if (!Array.isArray(emb) || emb.length !== dimensions) {
        throw new Error(
          `Invalid embedding dimensions at index ${i}: expected ${dimensions}, got ${Array.isArray(emb) ? emb.length : typeof emb}`,
        );
      }
      if (emb.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
        throw new Error(`Invalid embedding values at index ${i}: expected finite numbers`);
      }
      return emb;
    });
  }

  assertOpenAiResponse(data: OpenAiEmbeddingResponse, expectedCount: number, dimensions = 768, truncateDimensions = false): number[][] {
    if (!Array.isArray(data?.data) || data.data.length !== expectedCount) {
      throw new Error('Embedding count mismatch in OpenAI-compatible response');
    }
    const ordered: number[][] = new Array(expectedCount);
    for (const row of data.data) {
      if (!row || !Number.isInteger(row.index) || row.index < 0 || row.index >= expectedCount
        || Object.hasOwn(ordered, row.index)) {
        throw new Error('Invalid or duplicate embedding response index');
      }
      const embedding = row.embedding;
      if (truncateDimensions && Array.isArray(embedding) && embedding.length > dimensions) {
        if (embedding.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
          throw new Error(`Invalid embedding values at index ${row.index}: expected finite numbers`);
        }
        const shortened = embedding.slice(0, dimensions);
        const norm = Math.hypot(...shortened);
        if (!Number.isFinite(norm) || norm === 0) {
          throw new Error(`Cannot normalize shortened embedding at index ${row.index}`);
        }
        ordered[row.index] = shortened.map((value) => value / norm);
      } else {
        ordered[row.index] = embedding;
      }
    }
    return this.assertResponse({ embeddings: ordered }, expectedCount, dimensions);
  }
}
