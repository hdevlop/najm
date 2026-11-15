/** Threshold for an embedder without a preset below. */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.45;

export interface EmbeddingPreset {
  queryPrefix: string;
  documentPrefix: string;
  /** Prompts lower every score, so the threshold moves with them. */
  similarityThreshold: number;
}

/**
 * EmbeddingGemma's retrieval prompts (model card, "Prompt Instructions").
 * Measured on the playground routing benchmark: the right first tool rose
 * from 59% to 85% together with per-tool ranking, and small talk stopped
 * matching tools, at threshold 0.35.
 */
export const EMBEDDINGGEMMA_PRESET: EmbeddingPreset = {
  queryPrefix: 'task: search result | query: ',
  documentPrefix: 'title: none | text: ',
  similarityThreshold: 0.35,
};

/**
 * The preset for a model, used only when the app sets neither prefix: an app
 * that sets one (even to '') keeps its own prompts and the default threshold.
 */
export function embeddingPresetFor(embedding: {
  provider?: string;
  model?: string;
  queryPrefix?: string;
  documentPrefix?: string;
} | undefined): EmbeddingPreset | null {
  if (embedding?.queryPrefix !== undefined || embedding?.documentPrefix !== undefined) return null;
  const model = (embedding?.model ?? 'embeddinggemma').toLowerCase();
  return /(^|[/:_-])embeddinggemma/.test(model) || model.startsWith('embeddinggemma') ? EMBEDDINGGEMMA_PRESET : null;
}
