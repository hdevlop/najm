if (process.env.NAJM_NO_DEPRECATION_WARNINGS !== '1') {
  console.warn('[najm-chatbot deprecation] RAG exports moved from "najm-chatbot" to "najm-rag". Import from "najm-rag" directly.');
}

export {
  EmbeddingService,
  ToolIndexRepository,
  ToolIndexerService,
  ToolRouterService,
  ChatbotRagValidator,
  ChatbotRagController,
  semanticPhraseDto,
  semanticImportItemDto,
  importSemanticsDto,
  normalizeQuery,
  normalizeArabic,
  ToolRoutingLoader,
  DEFAULT_DANGEROUS_PATTERNS,
  DEFAULT_INTENT_KEYWORDS,
  chatbotEmbeddingSchema,
  chatbotRagSchema,
  chatbotToolRoutingSchema,
  chatbotLoggingSchema,
  chatbotRoutingJsonSchema,
} from 'najm-rag';
export type {
  SemanticMatch,
  ToolEmbeddingRow,
  SemanticPhraseRow,
  SemanticPhraseDto,
  SemanticImportItemDto,
  ImportSemanticsDto,
  ImportSemanticStatus,
  ImportSemanticResult,
  SemanticPhraseEntry,
  SemanticImportState,
  ChatbotRoutingConfigProvider,
} from 'najm-rag';
