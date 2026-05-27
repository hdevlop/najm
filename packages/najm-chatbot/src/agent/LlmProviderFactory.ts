import type { LanguageModelV1 } from 'ai';
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export type LlmProvider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'zai'
  | 'opencode'
  | 'openrouter'
  | 'minimax'
  | 'qwen'
  | 'ollama'
  | 'custom';

export interface ProviderMeta {
  label: string;
  description: string;
  defaultModel: string;
  modelSuggestions: string[];
  needsKey: boolean;
  needsUrl: boolean;
  defaultBaseUrl: string;
  apiKeyUrl: string | null;
}

export interface LlmSettings {
  provider: LlmProvider;
  apiKey?: string | null;
  baseUrl?: string | null;
  model: string;
}

export const PROVIDERS: Record<LlmProvider, ProviderMeta> = {
  anthropic: {
    label: 'Anthropic (Claude)',
    description: 'Claude models',
    defaultModel: 'claude-sonnet-4-6',
    modelSuggestions: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
    needsKey: true,
    needsUrl: false,
    defaultBaseUrl: '',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    label: 'OpenAI',
    description: 'GPT-5.4 and GPT-4.1 model families',
    defaultModel: 'gpt-5.4-mini',
    modelSuggestions: [
      'gpt-5.4',
      'gpt-5.4-mini',
      'gpt-5.4-nano',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
    ],
    needsKey: true,
    needsUrl: false,
    defaultBaseUrl: '',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
  },
  google: {
    label: 'Google Gemini',
    description: 'Gemini 2.5 plus hosted Gemma 4 models',
    defaultModel: 'gemini-2.5-flash',
    modelSuggestions: [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite-preview-06-17',
      'gemini-2.0-flash',
      'gemma-4-31b-it',
      'gemma-4-26b-a4b-it',
    ],
    needsKey: true,
    needsUrl: false,
    defaultBaseUrl: '',
    apiKeyUrl: 'https://aistudio.google.com/apikey',
  },
  zai: {
    label: 'Z.AI (GLM)',
    description: 'GLM models via OpenAI-compatible API',
    defaultModel: 'glm-5.1',
    modelSuggestions: [
      'glm-5.1',
      'glm-5',
      'glm-5-turbo',
      'glm-4.7',
      'glm-4.6',
      'glm-4.5',
      'glm-4.5-air',
      'glm-4.5-flash',
    ],
    needsKey: true,
    needsUrl: true,
    defaultBaseUrl: 'https://api.z.ai/api/paas/v4',
    apiKeyUrl: 'https://z.ai/manage-apikey/apikey-list',
  },
  opencode: {
    label: 'OpenCode Go',
    description: 'GLM, Kimi, DeepSeek, MiniMax, MiMo and Qwen via OpenCode Go',
    defaultModel: 'kimi-k2.6',
    modelSuggestions: [
      'kimi-k2.6',
      'kimi-k2.5',
      'glm-5.1',
      'glm-5',
      'deepseek-v4-pro',
      'deepseek-v4-flash',
      'minimax-m2.7',
      'minimax-m2.5',
      'mimo-v2.5',
      'mimo-v2.5-pro',
      'qwen3.6-plus',
      'qwen3.5-plus',
    ],
    needsKey: true,
    needsUrl: true,
    defaultBaseUrl: 'https://opencode.ai/zen/go/v1',
    apiKeyUrl: 'https://opencode.ai/zen',
  },
  openrouter: {
    label: 'OpenRouter',
    description: 'Hundreds of hosted models via OpenAI-compatible API',
    defaultModel: 'openrouter/auto',
    modelSuggestions: [
      'openrouter/auto',
      'anthropic/claude-sonnet-4.6',
      'openai/gpt-5.2',
      'openai/gpt-5.2-mini',
      'google/gemini-2.5-pro',
      'google/gemini-2.5-flash',
      'deepseek/deepseek-chat-v3.1',
      'qwen/qwen3-max',
      'moonshotai/kimi-k2',
      'x-ai/grok-4.1-fast',
    ],
    needsKey: true,
    needsUrl: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    apiKeyUrl: 'https://openrouter.ai/settings/keys',
  },
  minimax: {
    label: 'MiniMax',
    description: 'MiniMax M2 models via OpenAI-compatible API',
    defaultModel: 'MiniMax-M2.7',
    modelSuggestions: [
      'MiniMax-M2.7',
      'MiniMax-M2.7-highspeed',
      'MiniMax-M2.5',
      'MiniMax-M2.5-highspeed',
      'MiniMax-M2.1',
      'MiniMax-M2.1-highspeed',
      'MiniMax-M2',
    ],
    needsKey: true,
    needsUrl: true,
    defaultBaseUrl: 'https://api.minimax.io/v1',
    apiKeyUrl: 'https://platform.minimax.io/docs/guides/quickstart',
  },
  qwen: {
    label: 'Qwen',
    description: 'Alibaba Qwen via DashScope OpenAI-compatible API',
    defaultModel: 'qwen3.6-plus',
    modelSuggestions: [
      'qwen3-max',
      'qwen3.6-plus',
      'qwen3.6-flash',
      'qwen-plus',
      'qwen-flash',
      'qwen-turbo',
      'qwen3-coder-plus',
      'qwq-plus',
    ],
    needsKey: true,
    needsUrl: true,
    defaultBaseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    apiKeyUrl: 'https://help.aliyun.com/zh/model-studio/get-api-key',
  },
  ollama: {
    label: 'Ollama (Local)',
    description: 'Run models locally',
    defaultModel: 'llama3.1',
    modelSuggestions: [
      'llama3.1',
      'llama3.2',
      'qwen3',
      'qwen2.5',
      'gemma3',
      'gemma3:12b',
      'gemma3:27b',
      'mistral',
    ],
    needsKey: false,
    needsUrl: true,
    defaultBaseUrl: 'http://localhost:11434',
    apiKeyUrl: null,
  },
  custom: {
    label: 'Custom / OpenAI-compatible',
    description: 'Any OpenAI-compatible endpoint',
    defaultModel: 'your-model-name',
    modelSuggestions: [],
    needsKey: false,
    needsUrl: true,
    defaultBaseUrl: '',
    apiKeyUrl: null,
  },
};

export const PROVIDER_OPTIONS = (Object.entries(PROVIDERS) as [LlmProvider, ProviderMeta][]).map(
  ([value, meta]) => ({ value, label: meta.label }),
);

export function buildModel(settings: LlmSettings): LanguageModelV1 {
  const { provider, apiKey, baseUrl, model } = settings;

  switch (provider) {
    case 'anthropic':
      return anthropic(model as any, { ...(apiKey ? { apiKey } : {}) } as never);

    case 'openai': {
      const openai = createOpenAI({ apiKey: apiKey ?? '', baseURL: baseUrl ?? undefined });
      return openai(model);
    }

    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey: apiKey ?? '' });
      return google(model as any);
    }

    case 'zai': {
      const zai = createOpenAI({
        apiKey: apiKey ?? '',
        baseURL: baseUrl ?? 'https://api.z.ai/api/paas/v4',
      });
      return zai.chat(model);
    }

    case 'opencode': {
      if (model.toLowerCase().startsWith('minimax-')) {
        const opencodeMiniMax = createAnthropic({
          apiKey: apiKey ?? '',
          baseURL: baseUrl ?? 'https://opencode.ai/zen/go/v1',
        });
        return opencodeMiniMax(model as any);
      }

      const opencode = createOpenAI({
        apiKey: apiKey ?? '',
        baseURL: baseUrl ?? 'https://opencode.ai/zen/go/v1',
      });
      return opencode.chat(model);
    }

    case 'openrouter': {
      const openrouter = createOpenAI({
        apiKey: apiKey ?? '',
        baseURL: baseUrl ?? 'https://openrouter.ai/api/v1',
      });
      return openrouter.chat(model);
    }

    case 'minimax': {
      const minimax = createOpenAI({
        apiKey: apiKey ?? '',
        baseURL: baseUrl ?? 'https://api.minimax.io/v1',
      });
      return minimax.chat(model);
    }

    case 'qwen': {
      const qwen = createOpenAI({
        apiKey: apiKey ?? '',
        baseURL: baseUrl ?? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      });
      return qwen.chat(model);
    }

    case 'ollama': {
      const ollama = createOpenAI({
        apiKey: 'ollama',
        baseURL: (baseUrl ?? 'http://localhost:11434') + '/v1',
      });
      return ollama(model);
    }

    default: {
      const custom = createOpenAI({ apiKey: apiKey ?? 'custom', baseURL: baseUrl ?? '' });
      return custom(model);
    }
  }
}
