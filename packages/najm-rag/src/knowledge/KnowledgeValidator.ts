import { Service, Inject } from 'najm-core';
import { RAG_SCHEMA } from '../tokens';
import type { RagSchema } from '../config';

@Service()
export class KnowledgeValidator {
  @Inject(RAG_SCHEMA) private schema!: RagSchema;

  sourcesTable() {
    const table = (this.schema as any).chatbotDocumentSources;
    if (!table) throw new Error('chatbot_document_sources schema missing');
    return table;
  }

  chunksTable() {
    const table = (this.schema as any).chatbotDocumentChunks;
    if (!table) throw new Error('chatbot_document_chunks schema missing');
    return table;
  }

  embeddingsTable() {
    const table = (this.schema as any).chatbotDocumentEmbeddings;
    if (!table) throw new Error('chatbot_document_embeddings schema missing');
    return table;
  }
}
