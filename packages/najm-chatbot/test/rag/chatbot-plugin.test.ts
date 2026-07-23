import { describe, test, expect } from 'bun:test';
import { chatbot } from '../../src/ChatbotPlugin';

describe('ChatbotPlugin dialect guard', () => {
  test('chatbot runtime entry does not import najm-rag directly', async () => {
    const pluginSource = await Bun.file(new URL('../../src/ChatbotPlugin.ts', import.meta.url)).text();
    const indexSource = await Bun.file(new URL('../../src/index.ts', import.meta.url)).text();

    expect(pluginSource).not.toContain('najm-rag');
    expect(indexSource).not.toContain('najm-rag');
  });

  test('does not throw when legacy routing config is enabled with sqlite dialect', () => {
    expect(() =>
      chatbot({
        dialect: 'sqlite',
        toolRouting: { enabled: true },
      }),
    ).not.toThrow();
  });

  test('does not own RAG dialect validation after RAG extraction', () => {
    expect(() =>
      chatbot({
        dialect: 'mysql',
        toolRouting: { enabled: true },
      }),
    ).not.toThrow();
  });

  test('does not throw when routing enabled with pg dialect', () => {
    expect(() =>
      chatbot({
        dialect: 'pg',
        toolRouting: { enabled: true },
      }),
    ).not.toThrow();
  });

  test('does not throw when routing disabled with any dialect', () => {
    expect(() =>
      chatbot({
        dialect: 'sqlite',
        toolRouting: { enabled: false },
      }),
    ).not.toThrow();
  });

  test('merges toolRouting defaults', () => {
    const plugin = chatbot({
      dialect: 'pg',
      toolRouting: { enabled: true, maxTools: 5 },
    });
    const config = (plugin as any).config;
    expect(config.toolRouting.enabled).toBe(true);
    expect(config.toolRouting.maxTools).toBe(5);
    expect(config.toolRouting.similarityThreshold).toBe(0.45);
    expect(config.rag.embedding.provider).toBe('ollama');
    expect(config.rag.embedding.model).toBe('embeddinggemma');
  });

  test('does not require mcp when routing is disabled', () => {
    const plugin = chatbot({
      dialect: 'sqlite',
      toolRouting: { enabled: false },
    });

    expect((plugin as any).dependencies).not.toContain('mcp');
  });

  test('requires mcp when routing is enabled', () => {
    const plugin = chatbot({
      dialect: 'sqlite',
      toolRouting: { enabled: true },
    });

    expect((plugin as any).dependencies).toContain('mcp');
  });

  test('preserves dialect in merged config', () => {
    const pgPlugin = chatbot({
      dialect: 'pg',
      toolRouting: { enabled: true },
    });
    expect((pgPlugin as any).config.dialect).toBe('pg');

    const sqlitePlugin = chatbot({
      dialect: 'sqlite',
      toolRouting: { enabled: true },
    });
    expect((sqlitePlugin as any).config.dialect).toBe('sqlite');
  });

  test('does not register RAG services or vector strategy', () => {
    const plugin = chatbot({
      dialect: 'pg',
      rag: { enabled: true },
      toolRouting: { enabled: true },
    });

    const services = ((plugin as any).services ?? []).flatMap((entry: any) =>
      typeof entry === 'object' && !entry.name ? Object.values(entry) : [entry],
    );
    const serviceNames = services.map((service: any) => service?.name).filter(Boolean);
    const vectorEntry = (plugin as any).tokens?.find(
      (t: any) => t[0] === Symbol.for('najm:chatbot:vector-strategy'),
    );

    expect(serviceNames).not.toContain('EmbeddingService');
    expect(serviceNames).not.toContain('ToolRouterService');
    expect(serviceNames).not.toContain('ChatbotRagService');
    expect(vectorEntry).toBeUndefined();
  });

  test('throws when both mode and tools are set', () => {
    expect(() =>
      chatbot({
        mode: 'routing',
        tools: 'all',
      }),
    ).toThrow('Use `tools` only — `mode` is deprecated.');
  });

  test('requires mcp when tools is all', () => {
    const plugin = chatbot({
      dialect: 'sqlite',
      tools: 'all',
    });
    expect((plugin as any).dependencies).toContain('mcp');
  });

  test('does not require mcp when tools is none', () => {
    const plugin = chatbot({
      dialect: 'sqlite',
      tools: 'none',
    });
    expect((plugin as any).dependencies).not.toContain('mcp');
  });
});
