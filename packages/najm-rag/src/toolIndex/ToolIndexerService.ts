import { Service, Inject, Meta, LoggerService } from 'najm-core';
import { McpRegistryService } from 'najm-mcp';
import { RAG_CONFIG } from '../tokens';
import type { RagMergedConfig } from '../config';
import { EmbeddingService } from '../embeddings';
import { ToolIndexRepository } from './ToolIndexRepository';
import type { ToolIndexEntry } from './ToolIndexDto';
import { createFingerprint, buildIndexText } from './ToolIndexUtils';
import { getRoutableTools } from '../toolVisibility';

@Service()
@Meta({ layer: 'plugin', order: 55 })
export class ToolIndexerService {
  private indexingPromise: Promise<{ indexed: number; skipped: number }> | null = null;

  constructor(
    @Inject(RAG_CONFIG) private config: RagMergedConfig,
    @Inject() private registry: McpRegistryService,
    @Inject() private embedding: EmbeddingService,
    @Inject() private repository: ToolIndexRepository,
    @Inject(LoggerService) private log: LoggerService,
  ) {}

  get isIndexing(): boolean {
    return this.indexingPromise !== null;
  }

  onReady(): void {
    const rag = this.config.rag;
    const routing = this.config.toolRouting;

    const enabled = rag?.enabled === true || routing?.enabled === true;
    const indexOnBoot = rag?.indexOnBoot ?? (routing as any)?.indexOnBoot;

    if (!enabled || indexOnBoot === false) {
      return;
    }

    this.log.info('[chatbot-rag] Starting tool indexing on boot (background)...');

    this.indexTools()
      .then((result) => {
        this.log.info('[chatbot-rag] Tool indexing complete.', result);
      })
      .catch((error) => {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('no such table') || msg.includes('does not exist')) {
          this.log.error?.(
            `[chatbot-rag] Tool indexing failed on boot: RAG tables not found. ` +
            `Did you run migrations? (${msg})`,
          );
        } else {
          this.log.error?.('[chatbot-rag] Tool indexing failed on boot:', error);
        }
      });
  }

  async indexTools(): Promise<{ indexed: number; skipped: number }> {
    if (this.indexingPromise) {
      return this.indexingPromise;
    }

    this.indexingPromise = this.runIndexTools();

    try {
      return await this.indexingPromise;
    } finally {
      this.indexingPromise = null;
    }
  }

  private async runIndexTools(): Promise<{ indexed: number; skipped: number }> {
    const tools = getRoutableTools(this.registry.tools);
    const existing = await this.repository.listEmbeddings();
    const fingerprintMap = new Map(existing.map((e) => [e.toolName, e.fingerprint]));

    const toIndex: ToolIndexEntry[] = [];

    for (const tool of tools) {
      const input = {
        name: tool.name,
        description: tool.description,
        group: tool.group ?? null,
        localName: tool.localName ?? null,
        argNames: tool.validationArgs ?? null,
        annotations: tool.annotations as Record<string, unknown> | null,
      };

      const fingerprint = createFingerprint(input);

      if (fingerprintMap.get(tool.name) === fingerprint) {
        continue;
      }

      toIndex.push({ ...input, fingerprint, text: buildIndexText(input) });
    }

    if (toIndex.length === 0) {
      return { indexed: 0, skipped: tools.length };
    }

    const embeddings = await this.embedding.embedBatch(toIndex.map((t) => t.text));

    for (let i = 0; i < toIndex.length; i++) {
      const item = toIndex[i];
      await this.repository.upsertEmbedding({
        toolName: item.name,
        description: item.description,
        group: item.group,
        localName: item.localName,
        argNames: item.argNames,
        annotations: item.annotations,
        fingerprint: item.fingerprint,
        embedding: embeddings[i],
      });
    }

    return { indexed: toIndex.length, skipped: tools.length - toIndex.length };
  }
}
