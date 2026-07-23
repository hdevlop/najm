import { Service, Inject } from 'najm-core';
import { RAG_SCHEMA } from '../tokens';
import type { RagSchema } from '../config';

@Service()
export class ToolIndexValidator {
  @Inject(RAG_SCHEMA) private schema!: RagSchema;

  embeddingsTable() {
    const table = this.schema.chatbotToolEmbeddings;
    if (!table) throw new Error('chatbot_tool_embeddings schema missing');
    return table;
  }

  semanticsTable() {
    const table = this.schema.chatbotToolSemantics;
    if (!table) throw new Error('chatbot_tool_semantics schema missing');
    return table;
  }
}
