export { RAG_TOOL_PROVIDER } from './provider';

export const RAG_CONFIG = Symbol.for('najm:rag:config');
export const RAG_DIAGNOSTICS = Symbol.for('najm:rag:diagnostics');
export const RAG_SCHEMA = Symbol.for('najm:rag:schema');
export const VECTOR_STRATEGY = Symbol.for('najm:chatbot:vector-strategy');
export const RAG_OCR_PROVIDER = Symbol.for('najm:rag:ocr-provider');
/** SemanticSeedService, by token: SemanticPhraseService reads its status without importing it (they import each other). */
export const RAG_SEED_STATUS = Symbol.for('najm:rag:seed-status');
