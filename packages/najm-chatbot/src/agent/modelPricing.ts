import type { LlmProvider } from './LlmProviderFactory';

export interface ModelPricing {
  input: number;
  output: number;
}

export interface UsageCost {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: 'USD';
  pricingFound: boolean;
}

const ZERO: ModelPricing = { input: 0, output: 0 };

const STATIC_PRICING: Record<string, ModelPricing> = {
  'anthropic:claude-opus-4-6': { input: 15, output: 75 },
  'anthropic:claude-sonnet-4-6': { input: 3, output: 15 },
  'anthropic:claude-haiku-4-5': { input: 0.8, output: 4 },

  'openai:gpt-5.4': { input: 2.5, output: 10 },
  'openai:gpt-5.4-mini': { input: 0.15, output: 0.6 },
  'openai:gpt-5.4-nano': { input: 0.05, output: 0.2 },
  'openai:gpt-4.1': { input: 2, output: 8 },
  'openai:gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'openai:gpt-4.1-nano': { input: 0.1, output: 0.4 },

  'google:gemini-2.5-pro': { input: 1.25, output: 10 },
  'google:gemini-2.5-flash': { input: 0.075, output: 0.3 },
  'google:gemini-2.5-flash-lite-preview-06-17': { input: 0.04, output: 0.15 },
  'google:gemini-2.0-flash': { input: 0.075, output: 0.3 },

  'openrouter:openai/gpt-oss-120b': { input: 0.039, output: 0.19 },
  'openrouter:openai/gpt-oss-20b': { input: 0.02, output: 0.08 },
  'openrouter:openai/gpt-5.2': { input: 2.5, output: 10 },
  'openrouter:openai/gpt-5.2-mini': { input: 0.15, output: 0.6 },
  'openrouter:anthropic/claude-sonnet-4.6': { input: 3, output: 15 },
  'openrouter:google/gemini-2.5-pro': { input: 1.25, output: 10 },
  'openrouter:google/gemini-2.5-flash': { input: 0.075, output: 0.3 },
  'openrouter:deepseek/deepseek-chat-v3.1': { input: 0.27, output: 1.1 },
  'openrouter:qwen/qwen3-max': { input: 0.4, output: 1.6 },
  'openrouter:moonshotai/kimi-k2': { input: 0.5, output: 2 },
  'openrouter:x-ai/grok-4.1-fast': { input: 0.2, output: 0.5 },
};

const OLLAMA_FREE: LlmProvider = 'ollama';

function key(provider: string, model: string): string {
  return `${provider.toLowerCase()}:${model}`;
}

export function getModelPricing(provider: string, model: string): ModelPricing | null {
  if (provider === OLLAMA_FREE) return ZERO;
  const exact = STATIC_PRICING[key(provider, model)];
  if (exact) return exact;
  return null;
}

export function calculateCost(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
): UsageCost {
  const pricing = getModelPricing(provider, model);
  const totalTokens = promptTokens + completionTokens;

  if (!pricing) {
    return {
      promptTokens,
      completionTokens,
      totalTokens,
      inputCost: 0,
      outputCost: 0,
      totalCost: 0,
      currency: 'USD',
      pricingFound: false,
    };
  }

  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    currency: 'USD',
    pricingFound: true,
  };
}
