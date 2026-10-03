import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { rag } from '../src/plugin';
import { EmbeddingService } from '../src/embeddings';
import type { RagMergedConfig } from '../src/config';

const configOf = (plugin: ReturnType<typeof rag>) => plugin.config as RagMergedConfig;

describe('rag() enablement', () => {
  test('schema-only usage does not enable the embedder', () => {
    const plugin = rag({ dialect: 'sqlite' });
    expect(configOf(plugin).rag.enabled).toBe(false);
    expect(plugin.services ?? []).not.toContain(EmbeddingService);
  });

  test('embedding, routing or knowledge enables the embedder', () => {
    for (const config of [
      { dialect: 'sqlite' as const, embedding: { model: 'embeddinggemma' } },
      { dialect: 'sqlite' as const, toolRouting: { enabled: true } },
      { dialect: 'sqlite' as const, knowledge: true },
    ]) {
      const plugin = rag(config);
      expect(configOf(plugin).rag.enabled).toBe(true);
      expect(plugin.services).toContain(EmbeddingService);
    }
  });

  test('passes rewriteRoutingQuery through, and only a function', () => {
    const rewrite = (text: string) => text;
    expect(configOf(rag({ dialect: 'sqlite', toolRouting: { enabled: true }, rewriteRoutingQuery: rewrite })).rewriteRoutingQuery).toBe(rewrite);
    expect(configOf(rag({ dialect: 'sqlite', toolRouting: { enabled: true } })).rewriteRoutingQuery).toBeUndefined();
    expect(configOf(rag({ dialect: 'sqlite', rewriteRoutingQuery: 'x' as any })).rewriteRoutingQuery).toBeUndefined();
  });

  test('leaves dimensions unset unless configured', () => {
    expect(configOf(rag({ dialect: 'sqlite', knowledge: true })).rag.embedding.dimensions).toBeUndefined();
  });

  test('rejects dimensions the pg schema cannot store', () => {
    expect(() => rag({ dialect: 'pg', embedding: { dimensions: 1024 } })).toThrow('vector(768)');
    expect(() => rag({ dialect: 'pg', embedding: { dimensions: 768 } })).not.toThrow();
    expect(() => rag({ dialect: 'sqlite', embedding: { dimensions: 1024 } })).not.toThrow();
  });
});
